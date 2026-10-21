/**
 * Sightline maths. From a seat's eye (1.1 m above its floor) we cast rays to
 * a grid of points about 1 m above the stage floor — roughly where performers'
 * heads and bodies are — and see what gets in the way. Approximate by design,
 * and fast enough to run for every seat in batches.
 */
import * as THREE from 'three';
import { pointInPolygon } from '../helpers/stageInfo';
import type { SeatInfo, StageInfo, Vec3 } from '../types';
import { aabb, type Placed } from '../objects/geometry';

export const EYE = 1.1;
const TARGET_HEIGHT = 1.0;

export const eyeOf = (s: SeatInfo): Vec3 => [s.x, s.y + EYE, s.z];

/** Points over the acting area (raised floors if any, so the Black Box uses its platforms). */
export function stageTargets(info: StageInfo, grid = 3): Vec3[] {
  const raised = info.floors.filter((f) => f.height > 0.01);
  const floors = raised.length ? raised : info.floors;
  const pts = floors.flatMap((f) => f.outline);
  if (!pts.length) return [[info.centre[0], TARGET_HEIGHT, info.centre[1]]];
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const out: Vec3[] = [];
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      // Inset 20% from the edges: performers rarely stand right on the edge.
      const x = x0 + (x1 - x0) * (0.2 + (0.6 * i) / Math.max(1, grid - 1));
      const z = z0 + (z1 - z0) * (0.2 + (0.6 * j) / Math.max(1, grid - 1));
      const floor = floors.find((f) => pointInPolygon([x, z], f.outline));
      if (floor) out.push([x, floor.height + TARGET_HEIGHT, z]);
    }
  }
  return out.length ? out : [[info.centre[0], TARGET_HEIGHT, info.centre[1]]];
}

function excluded(o: THREE.Object3D): boolean {
  for (let cur: THREE.Object3D | null = o; cur; cur = cur.parent) if (cur.userData?.noOcclude || cur.userData?.handle) return true;
  return false;
}

/** Everything that can block a view: stage geometry and set pieces (not seats, floors, labels or overlays). */
export function collectOccluders(scene: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    if (o.type === 'Line2' || o.type === 'LineSegments2') return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
    if (mat?.userData?.surface || (mat && (mat as THREE.MeshStandardMaterial).transparent && (mat as THREE.MeshStandardMaterial).opacity < 0.5)) return;
    if (excluded(o)) return;
    out.push(m);
  });
  return out;
}

const ray = new THREE.Raycaster();
const from = new THREE.Vector3();
const dir = new THREE.Vector3();

/** First thing hit between a seat's eye and a target (null when the view is clear). */
function firstHit(eye: Vec3, target: Vec3, meshes: THREE.Mesh[]): THREE.Intersection | null {
  from.set(...eye);
  dir.set(target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]);
  const dist = dir.length();
  ray.set(from, dir.normalize());
  ray.near = 0.3; // skip the seat's own chair back
  ray.far = dist - 0.05;
  const hits = ray.intersectObjects(meshes, false);
  return hits[0] ?? null;
}

/** Fraction (0–1) of the targets visible from a seat. */
export function clearFraction(seat: SeatInfo, targets: Vec3[], meshes: THREE.Mesh[]): number {
  const eye = eyeOf(seat);
  let clear = 0;
  for (const t of targets) if (!firstHit(eye, t, meshes)) clear++;
  return clear / targets.length;
}

/** Which set objects (by id) block a seat's view, and whether stage geometry blocks part of it. */
export function whatBlocks(seat: SeatInfo, targets: Vec3[], meshes: THREE.Mesh[]) {
  const eye = eyeOf(seat);
  const ids = new Set<string>();
  let stage = false;
  let clear = 0;
  for (const t of targets) {
    const hit = firstHit(eye, t, meshes);
    if (!hit) {
      clear++;
      continue;
    }
    let id: string | undefined;
    for (let cur: THREE.Object3D | null = hit.object; cur && !id; cur = cur.parent) id = cur.userData?.objectId;
    if (id) ids.add(id);
    else stage = true;
  }
  return { ids: [...ids], stage, clear: clear / targets.length };
}

/** Run clearFraction for every seat in small batches; resolves with null if cancelled. */
export function computeAll(seats: SeatInfo[], targets: Vec3[], meshes: THREE.Mesh[], onProgress: (p: number) => void, cancelled: () => boolean): Promise<Float32Array | null> {
  const out = new Float32Array(seats.length);
  const batch = 300;
  return new Promise((resolve) => {
    let i = 0;
    const step = () => {
      if (cancelled()) return resolve(null);
      const end = Math.min(seats.length, i + batch);
      for (; i < end; i++) out[i] = clearFraction(seats[i], targets, meshes);
      onProgress(i / Math.max(1, seats.length));
      if (i < seats.length) setTimeout(step, 0);
      else resolve(out);
    };
    step();
  });
}

// --- Tall-object warnings (thrust, traverse, in-the-round) -----------------------------

export interface TallWarning {
  objectId: string;
  name: string;
  height: number;
  blocks: string[];
}

/** Does the segment a→b pass through an axis-aligned box? */
function segmentHitsBox(a: Vec3, b: Vec3, box: THREE.Box3) {
  const r = new THREE.Ray(new THREE.Vector3(...a), new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize());
  const hit = r.intersectBox(box, new THREE.Vector3());
  return !!hit && hit.distanceTo(r.origin) < Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

/**
 * Set pieces taller than `threshold` above their floor that block views from
 * a seating block: checked from the middle seat of the block's middle row to
 * every stage target. A block is listed when a quarter or more of its view is cut.
 */
export function tallWarnings(placed: Placed[], seats: SeatInfo[], targets: Vec3[], threshold: number, floorAt: (x: number, z: number) => number): TallWarning[] {
  const blocks = new Map<string, SeatInfo[]>();
  for (const s of seats) {
    if (!blocks.has(s.block)) blocks.set(s.block, []);
    blocks.get(s.block)!.push(s);
  }
  const reps = [...blocks.entries()].map(([name, list]) => {
    const rows = [...new Set(list.map((s) => s.row))].sort((a, b) => a - b);
    const row = rows[Math.floor(rows.length / 2)];
    const inRow = list.filter((s) => s.row === row).sort((a, b) => a.num - b.num);
    return { name: name || 'Audience', seat: inRow[Math.floor(inRow.length / 2)] };
  });
  const out: TallWarning[] = [];
  for (const p of placed) {
    const height = p.baseY + p.size.height - floorAt(p.wx, p.wz);
    if (height <= threshold) continue;
    const b = aabb(p);
    const box = new THREE.Box3(new THREE.Vector3(b.minX, p.baseY, b.minZ), new THREE.Vector3(b.maxX, p.baseY + p.size.height, b.maxZ));
    const hit = reps.filter((r) => {
      const eye = eyeOf(r.seat);
      const blocked = targets.filter((t) => segmentHitsBox(eye, t, box)).length;
      return blocked / targets.length >= 0.25;
    });
    if (hit.length) out.push({ objectId: p.obj.id, name: p.obj.name, height, blocks: hit.map((r) => r.name) });
  }
  return out;
}
