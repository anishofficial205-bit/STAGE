/**
 * Where lights can hang: the hanging positions (electrics, FOH, booms), the
 * stage's own rigging, truss pieces from the set — or the floor. Plus the
 * default positions a stage starts with.
 */
import * as THREE from 'three';
import { floorHeightAt, stageSnapLines } from '../helpers/stageInfo';
import { currentStage, placedAll } from '../objects/actions';
import { worldHangLines } from '../objects/geometry';
import { playingArea } from '../objects/curtains/drapes';
import { getTemplate } from '../templates/registry';
import { useProjectStore } from '../store/useProjectStore';
import { lightId, type HangPosition, type Lighting, type Vec3 } from './types';

export interface HangLine {
  a: Vec3;
  b: Vec3;
  /** Hanging position id, or 'rig' for stage rigging and truss. */
  mount: string;
  vertical?: boolean;
}

export function positionLine(p: HangPosition): HangLine {
  if (p.kind === 'boom') return { a: [p.x, p.y, p.z], b: [p.x, p.y + p.length, p.z], mount: p.id, vertical: true };
  return { a: [p.x - p.length / 2, p.y, p.z], b: [p.x + p.length / 2, p.y, p.z], mount: p.id };
}

/** Every line a light can clamp onto. */
export function hangLines(lighting: Lighting): HangLine[] {
  const { info } = currentStage();
  const rig = (info.rigging ?? []).map(([a, b]) => ({ a, b, mount: 'rig' }));
  const truss = placedAll().flatMap(worldHangLines).map(([a, b]) => ({ a, b, mount: 'rig' }));
  return [...lighting.positions.map(positionLine), ...rig, ...truss];
}

const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const onRay = new THREE.Vector3();
const onSeg = new THREE.Vector3();

/** Lights hang a little below a pipe (clamp and yoke). */
export const HANG_DROP = 0.35;

/**
 * Where a light dragged along `ray` lands: on the nearest hang line close to
 * the ray, else on the floor (the stage floor where there is one).
 */
export function snapToRig(ray: THREE.Ray, lines: HangLine[], floorOnly = false): { pos: Vec3; mount: string | null } | null {
  if (!floorOnly) {
    let best: { d: number; pos: Vec3; mount: string } | null = null;
    for (const l of lines) {
      va.set(...l.a);
      vb.set(...l.b);
      const d2 = ray.distanceSqToSegment(va, vb, onRay, onSeg);
      // Allow a bit more slack further from the camera.
      const tol = 0.35 + 0.02 * onRay.distanceTo(ray.origin);
      if (d2 < tol * tol && (!best || d2 < best.d)) best = { d: d2, pos: [onSeg.x, onSeg.y - (l.vertical ? 0 : HANG_DROP), onSeg.z], mount: l.mount };
    }
    if (best) return { pos: best.pos, mount: best.mount };
  }
  const { info } = currentStage();
  const hit = new THREE.Vector3();
  if (!ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
  const h = floorHeightAt(info, hit.x, hit.z);
  if (h > 0 && ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), hit)) return { pos: [hit.x, h + 0.05, hit.z], mount: 'floor' };
  return { pos: [hit.x, 0.05, hit.z], mount: 'floor' };
}

/** The middle of the stage at floor height (where new lights aim). */
export function stageCentre(): Vec3 {
  const { info } = currentStage();
  const [x0, z0, x1, z1] = stageSnapLines(info).bounds;
  const x = (x0 + x1) / 2;
  const z = info.opening ? (info.opening.z + info.opening.backZ) / 2 + 1.5 : (z0 + z1) / 2;
  return [x, floorHeightAt(info, x, z), z];
}

/** Default positions: on a proscenium stage 3 electrics, a FOH truss and two booms; elsewhere 2 electrics over the stage. */
export function defaultPositions(): HangPosition[] {
  const s = useProjectStore.getState();
  const { info } = currentStage();
  const a = playingArea(info);
  const floor = floorHeightAt(info, a.cx, (a.front + a.back) / 2);
  const out: HangPosition[] = [];
  const top = floor + Math.max(5, a.height + 1.5);
  const prosc = !!info.opening;
  const n = prosc ? 3 : 2;
  const ord = ['1st', '2nd', '3rd', '4th'];
  for (let i = 0; i < n; i++) {
    const z = a.front + ((a.back - a.front) * (i + (prosc ? 0.6 : 0.5))) / (n + (prosc ? 0.2 : 0));
    out.push({ id: lightId('h'), kind: 'electric', name: `${ord[i]} Electric`, x: a.cx, y: top, z, length: a.width + 4 });
  }
  const seats = getTemplate(s.templateId)?.seats?.(s.paramsByTemplate[s.templateId], s.dataByTemplate[s.templateId]) ?? [];
  if (prosc && seats.length) {
    const [, , , z1] = stageSnapLines(info).bounds;
    out.push({ id: lightId('h'), kind: 'foh', name: 'FOH truss', x: a.cx, y: top + 0.5, z: z1 + 5, length: a.width + 2 });
    const mid = (a.front + a.back) / 2;
    for (const side of [1, -1]) out.push({ id: lightId('h'), kind: 'boom', name: side > 0 ? 'SL boom' : 'SR boom', x: a.cx + side * (a.width / 2 + 1.2), y: floor, z: mid, length: 4 });
  }
  return out;
}
