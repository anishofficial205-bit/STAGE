import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../types';
import { COLORS, ROUGHNESS } from './materials';
import { offsetPolygon, type Pt } from './shapes';

/**
 * Shared seating generator.
 *
 * Works in a local frame: the focus point (usually the stage edge centre) is the
 * origin, rows run outwards along +Z, and every seat faces back towards the
 * focus. Position/rotate the whole block with the `position` / `rotationY` props.
 *
 * - curve = 0: straight rows of width `rowWidth`.
 * - curve > 0: rows are arcs around a centre behind the first row. The curve
 *   sets the angle the first row sweeps (1 = about 117°). Rows keep the same
 *   angle, so back rows get wider, like a real fan-shaped auditorium.
 * - arcSpan: explicit angle (radians) for rows centred exactly on the focus
 *   point (e.g. seating wrapped around a round thrust). Overrides `curve`.
 * - flare (straight rows only): how much each end of a row grows per metre of
 *   distance from the focus line, as [left end (-X), right end (+X)]. Use
 *   tan(corner angle / 2) so neighbouring blocks meet in a clean mitre.
 */
export interface SeatingOptions {
  rows: number;
  /** Distance from the focus point to the first row. */
  firstRowDistance: number;
  rowSpacing: number;
  /** Rise per row (rake). */
  rise: number;
  /** Floor height of the first row. */
  baseHeight?: number;
  /** Risers are drawn down to this height (0 = the ground). Raise it for balconies. */
  riserFrom?: number;
  /** Row length (first row arc length when curved). Ignored if seatsPerRow is set. */
  rowWidth?: number;
  seatsPerRow?: number;
  seatWidth?: number;
  curve?: number;
  arcSpan?: number;
  flare?: [number, number];
  /** Number of aisles splitting each row into blocks. */
  aisles?: number;
  aisleWidth?: number;
}

export interface SeatPlacement {
  x: number;
  y: number; // floor level of the row the seat stands on
  z: number;
  rotY: number;
  width: number;
  depth: number;
  /** Bottom of the riser under this seat. */
  floor: number;
}

export const DEFAULT_SEAT_WIDTH = 0.55;
const MAX_CURVE_SPAN = Math.PI * 0.65;

const aisleCount = (o: SeatingOptions) => Math.max(0, Math.floor(o.aisles ?? 0));
const aisleW = (o: SeatingOptions) => (aisleCount(o) > 0 ? o.aisleWidth ?? 1.2 : 0);
const firstRowLength = (o: SeatingOptions) =>
  o.seatsPerRow ? o.seatsPerRow * (o.seatWidth ?? DEFAULT_SEAT_WIDTH) + aisleCount(o) * aisleW(o) : o.rowWidth ?? 10;

/** Arc layout of curved seating: centre at (0, cz), first-row radius r0, angle span. */
export function arcLayout(o: SeatingOptions): { r0: number; cz: number; span: number } | null {
  if (o.arcSpan && o.arcSpan > 0) {
    const r0 = Math.max(o.firstRowDistance, 0.5);
    return { r0, cz: o.firstRowDistance - r0, span: Math.min(o.arcSpan, Math.PI * 2) };
  }
  if ((o.curve ?? 0) > 0.001) {
    // The curve sets how far the first row sweeps: 1 = about 117°. The radius follows from the row length.
    const span = Math.min(1, o.curve!) * MAX_CURVE_SPAN;
    const r0 = firstRowLength(o) / span;
    return { r0, cz: o.firstRowDistance - r0, span };
  }
  return null;
}

export function generateSeats(o: SeatingOptions): SeatPlacement[] {
  const seatWidth = o.seatWidth ?? DEFAULT_SEAT_WIDTH;
  const aisles = aisleCount(o);
  const aisleWidth = aisleW(o);
  const base = o.baseHeight ?? 0;
  const floor = o.riserFrom ?? 0;
  const rows = Math.max(0, Math.floor(o.rows));
  const firstLen = firstRowLength(o);
  const arc = arcLayout(o);
  const [flareL, flareR] = arc ? [0, 0] : o.flare ?? [0, 0];

  const out: SeatPlacement[] = [];
  for (let i = 0; i < rows; i++) {
    const y = base + i * o.rise;
    const d = o.firstRowDistance + i * o.rowSpacing;
    const r = arc ? arc.r0 + i * o.rowSpacing : 0;
    // Row extent along its length, measured from the block's centre line.
    const start = arc ? -(arc.span * r) / 2 : -firstLen / 2 - d * flareL;
    const end = arc ? (arc.span * r) / 2 : firstLen / 2 + d * flareR;
    const rowLen = end - start;
    // Full circle: no seam where the ends meet.
    const closed = !!arc && arc.span >= Math.PI * 2 - 1e-6;

    // Split the row into blocks separated by aisles, then fill each block with seats.
    const blocks = aisles + 1;
    const gaps = closed ? blocks : aisles;
    const blockLen = (rowLen - gaps * aisleWidth) / blocks;
    const perBlock = o.seatsPerRow && !arc && !o.flare ? Math.floor(o.seatsPerRow / blocks) : Math.floor(blockLen / seatWidth);
    if (perBlock <= 0) continue;

    for (let b = 0; b < blocks; b++) {
      const blockStart = start + (closed ? aisleWidth / 2 : 0) + b * (blockLen + aisleWidth);
      const first = blockStart + (blockLen - perBlock * seatWidth) / 2 + seatWidth / 2;
      for (let s = 0; s < perBlock; s++) {
        const along = first + s * seatWidth;
        if (arc) {
          const a = along / r;
          out.push({ x: r * Math.sin(a), y, z: arc.cz + r * Math.cos(a), rotY: a, width: seatWidth, depth: o.rowSpacing, floor });
        } else {
          out.push({ x: along, y, z: d, rotY: 0, width: seatWidth, depth: o.rowSpacing, floor });
        }
      }
    }
  }
  return out;
}

/** Centre of row `i` in the local frame, at floor level. Handy for preset views. */
export function rowCentre(o: SeatingOptions, i: number): Vec3 {
  const idx = Math.max(0, Math.min(i, Math.max(0, Math.floor(o.rows) - 1)));
  return [0, (o.baseHeight ?? 0) + idx * o.rise, o.firstRowDistance + idx * o.rowSpacing];
}

/** Furthest distance seating reaches from the focus point. */
export function seatingDepth(o: SeatingOptions): number {
  return o.firstRowDistance + Math.max(0, Math.floor(o.rows)) * o.rowSpacing;
}

/**
 * Local-frame footprint of a seating block (x from -halfWidth to +halfWidth,
 * z from minZ to maxZ) plus its top height. Use it in a template's bounds().
 */
export function seatingExtent(o: SeatingOptions) {
  const rows = Math.max(0, Math.floor(o.rows));
  if (rows === 0) return { halfWidth: 0, minZ: 0, maxZ: 0, top: 0 };
  const top = (o.baseHeight ?? 0) + (rows - 1) * o.rise + 1;
  const arc = arcLayout(o);
  if (!arc) {
    const flare = Math.max(...(o.flare ?? [0, 0]));
    return { halfWidth: firstRowLength(o) / 2 + seatingDepth(o) * flare, minZ: o.firstRowDistance, maxZ: seatingDepth(o), top };
  }
  const rMax = arc.r0 + rows * o.rowSpacing;
  const half = arc.span / 2;
  return {
    halfWidth: rMax * Math.sin(Math.min(half, Math.PI / 2)),
    // Arcs sweeping past 90° wrap behind their centre point.
    minZ: arc.cz + (half > Math.PI / 2 ? rMax : arc.r0) * Math.cos(Math.min(half, Math.PI)),
    maxZ: arc.cz + rMax,
    top,
  };
}

/** Largest row width (<= the requested one) whose block fits within ±maxHalf. */
export function fitRowWidth(o: SeatingOptions, maxHalf: number): number {
  const want = o.rowWidth ?? 10;
  if (seatingExtent(o).halfWidth <= maxHalf) return want;
  let lo = 0;
  let hi = want;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (seatingExtent({ ...o, rowWidth: mid }).halfWidth <= maxHalf) lo = mid;
    else hi = mid;
  }
  return lo;
}

// --- Seating that follows a stage outline (in-the-round) ---------------------

export interface ContourSeatingOptions {
  /** Stage outline: a circle, or a convex polygon of [x, z] points around the origin. */
  outline: { kind: 'circle'; radius: number } | { kind: 'polygon'; points: Pt[] };
  rows: number;
  /** Gap between the stage edge and the first row. */
  firstRowDistance: number;
  rowSpacing: number;
  rise: number;
  seatWidth?: number;
  /** Directions (radians; 0 = +Z, increasing towards +X) of the aisles between sections. */
  aisleAngles: number[];
  aisleWidth: number;
  /** Wider gaps in the front rows at each aisle, where performers enter. */
  vomitory?: { width: number; rows: number };
}

/**
 * Rows are the stage outline grown outwards by the row distance (mitred
 * corners), filled with seats facing inwards, then cut by constant-width aisles.
 */
export function generateContourSeats(o: ContourSeatingOptions): SeatPlacement[] {
  const sw = o.seatWidth ?? DEFAULT_SEAT_WIDTH;
  const rows = Math.max(0, Math.floor(o.rows));
  const dirs = o.aisleAngles.map((a) => [Math.sin(a), Math.cos(a)] as const);
  const out: SeatPlacement[] = [];

  const inAisle = (x: number, z: number, row: number) => {
    const half = (o.vomitory && row < o.vomitory.rows ? Math.max(o.vomitory.width, o.aisleWidth) : o.aisleWidth) / 2;
    return dirs.some(([ux, uz]) => x * ux + z * uz > 0 && Math.abs(x * uz - z * ux) < half + sw * 0.45);
  };
  const push = (x: number, z: number, rotY: number, y: number, row: number) => {
    if (!inAisle(x, z, row)) out.push({ x, y, z, rotY, width: sw, depth: o.rowSpacing, floor: 0 });
  };

  for (let i = 0; i < rows; i++) {
    const d = o.firstRowDistance + i * o.rowSpacing;
    const y = i * o.rise;
    if (o.outline.kind === 'circle') {
      const r = o.outline.radius + d;
      const n = Math.floor((2 * Math.PI * r) / sw);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        push(r * Math.sin(a), r * Math.cos(a), a, y, i);
      }
      continue;
    }
    const { points, normals } = offsetPolygon(o.outline.points, d);
    const count = points.length;
    for (let e = 0; e < count; e++) {
      const A = points[e];
      const B = points[(e + 1) % count];
      const n = normals[e];
      // Trim each end so chairs on neighbouring edges don't collide at the corner.
      const trim = (prev: Pt) => 0.32 * Math.tan(Math.acos(Math.max(-1, Math.min(1, prev[0] * n[0] + prev[1] * n[1]))) / 2);
      const t0 = trim(normals[(e - 1 + count) % count]);
      const t1 = trim(normals[(e + 1) % count]);
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const usable = len - t0 - t1;
      const seats = Math.floor(usable / sw);
      if (seats <= 0) continue;
      const ux = (B[0] - A[0]) / len;
      const uz = (B[1] - A[1]) / len;
      const first = t0 + (usable - seats * sw) / 2 + sw / 2;
      const rotY = Math.atan2(n[0], n[1]);
      for (let s = 0; s < seats; s++) {
        const t = first + s * sw;
        push(A[0] + ux * t, A[1] + uz * t, rotY, y, i);
      }
    }
  }
  return out;
}

// --- Rendering --------------------------------------------------------------

/** One low-poly chair, facing -Z, origin at the floor centre. Built once. */
const chairGeometry = (() => {
  const base = new THREE.BoxGeometry(0.42, 0.38, 0.36).translate(0, 0.19, 0.02);
  const seat = new THREE.BoxGeometry(0.48, 0.07, 0.46).translate(0, 0.42, 0);
  const back = new THREE.BoxGeometry(0.48, 0.48, 0.07).translate(0, 0.69, 0.2);
  return mergeGeometries([base, seat, back])!;
})();

/** Unit box with its bottom at y = 0, scaled per instance to make stepped risers. */
const riserGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

const chairMaterial = new THREE.MeshStandardMaterial({ color: COLORS.seat, roughness: ROUGHNESS });
const riserMaterial = new THREE.MeshStandardMaterial({ color: COLORS.riser, roughness: ROUGHNESS });

/** Draws seat placements with two instanced meshes (chairs + risers): cheap even for thousands of seats. */
export function SeatInstances({ seats }: { seats: SeatPlacement[] }) {
  const chairs = useRef<THREE.InstancedMesh>(null);
  const risers = useRef<THREE.InstancedMesh>(null);
  const raised = useMemo(() => seats.filter((s) => s.y - s.floor > 0.005), [seats]);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    if (chairs.current) {
      seats.forEach((s, i) => {
        m.position.set(s.x, s.y, s.z);
        m.rotation.set(0, s.rotY, 0);
        m.scale.set(1, 1, 1);
        m.updateMatrix();
        chairs.current!.setMatrixAt(i, m.matrix);
      });
      chairs.current.instanceMatrix.needsUpdate = true;
      chairs.current.computeBoundingSphere();
    }
    if (risers.current) {
      raised.forEach((s, i) => {
        m.position.set(s.x, s.floor, s.z);
        m.rotation.set(0, s.rotY, 0);
        // Slight overlap hides hairline gaps between neighbouring risers.
        m.scale.set(s.width + 0.01, s.y - s.floor, s.depth + 0.01);
        m.updateMatrix();
        risers.current!.setMatrixAt(i, m.matrix);
      });
      risers.current.instanceMatrix.needsUpdate = true;
      risers.current.computeBoundingSphere();
    }
  }, [seats, raised]);

  return (
    <>
      {seats.length > 0 && (
        <instancedMesh key={`c${seats.length}`} ref={chairs} args={[chairGeometry, chairMaterial, seats.length]} castShadow receiveShadow />
      )}
      {raised.length > 0 && (
        <instancedMesh key={`r${raised.length}`} ref={risers} args={[riserGeometry, riserMaterial, raised.length]} castShadow receiveShadow />
      )}
    </>
  );
}

interface Placement {
  position?: Vec3;
  rotationY?: number;
}

/** Drop-in seating block: <Seating rows={10} ... position={[0,0,6]} />. */
export function Seating({ position = [0, 0, 0], rotationY = 0, ...options }: SeatingOptions & Placement) {
  const key = JSON.stringify(options);
  const seats = useMemo(() => generateSeats(options), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group position={position} rotation-y={rotationY}>
      <SeatInstances seats={seats} />
    </group>
  );
}

/**
 * A low wall along the front of a seating block's first row (e.g. a balcony
 * front). Follows the row's curve. Same local frame and placement as <Seating>.
 */
export function SeatingFront({
  options,
  inset = 0.55,
  bottom,
  top,
  color = COLORS.wall,
  position = [0, 0, 0],
  rotationY = 0,
}: { options: SeatingOptions; inset?: number; bottom: number; top: number; color?: string } & Placement) {
  const arc = arcLayout(options);
  const h = top - bottom;
  return (
    <group position={position} rotation-y={rotationY}>
      {arc ? (
        <mesh position={[0, bottom + h / 2, arc.cz]} castShadow receiveShadow>
          <cylinderGeometry args={[arc.r0 - inset, arc.r0 - inset, h, 64, 1, true, -arc.span / 2, arc.span]} />
          <meshStandardMaterial color={color} roughness={ROUGHNESS} side={THREE.DoubleSide} />
        </mesh>
      ) : (
        <mesh position={[0, bottom + h / 2, options.firstRowDistance - inset]} castShadow receiveShadow>
          <boxGeometry args={[firstRowLength(options), h, 0.12]} />
          <meshStandardMaterial color={color} roughness={ROUGHNESS} />
        </mesh>
      )}
    </group>
  );
}
