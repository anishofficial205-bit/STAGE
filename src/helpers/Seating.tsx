import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../types';
import { COLORS, ROUGHNESS } from './materials';

/**
 * Shared seating generator.
 *
 * Works in a local frame: the focus point (usually the stage edge centre) is the
 * origin, rows run outwards along +Z, and every seat faces back towards the
 * focus. Position/rotate the whole block with the `position` / `rotationY` props.
 *
 * - curve = 0: straight rows of width `rowWidth`.
 * - curve > 0: rows are arcs around a centre behind the first row. curve = 1
 *   puts that centre on the focus point (strongly curved). Rows keep the same
 *   angle, so back rows get wider, like a real fan-shaped auditorium.
 * - arcSpan: explicit angle (radians) for rows centred exactly on the focus
 *   point, used for in-the-round style sections. Overrides `curve`.
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
  /** Row length (first row arc length when curved). Ignored if seatsPerRow is set. */
  rowWidth?: number;
  seatsPerRow?: number;
  seatWidth?: number;
  curve?: number;
  arcSpan?: number;
  /** Max angle a curved row may sweep. */
  maxArc?: number;
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
}

const DEFAULT_SEAT_WIDTH = 0.55;

export function generateSeats(o: SeatingOptions): SeatPlacement[] {
  const seatWidth = o.seatWidth ?? DEFAULT_SEAT_WIDTH;
  const aisles = Math.max(0, Math.floor(o.aisles ?? 0));
  const aisleWidth = aisles > 0 ? o.aisleWidth ?? 1.2 : 0;
  const base = o.baseHeight ?? 0;
  const rows = Math.max(0, Math.floor(o.rows));
  const firstLen = o.seatsPerRow ? o.seatsPerRow * seatWidth + aisles * aisleWidth : o.rowWidth ?? 10;

  // Arc geometry: centre of curvature sits at z = cz, first row radius r0.
  let curved = false;
  let r0 = 0;
  let cz = 0;
  let span = 0;
  if (o.arcSpan && o.arcSpan > 0) {
    curved = true;
    r0 = Math.max(o.firstRowDistance, 0.5);
    cz = o.firstRowDistance - r0;
    span = Math.min(o.arcSpan, Math.PI * 2);
  } else if ((o.curve ?? 0) > 0.001) {
    curved = true;
    r0 = Math.max(o.firstRowDistance, 0.5) / Math.min(1, o.curve!);
    cz = o.firstRowDistance - r0;
    span = Math.min(firstLen / r0, o.maxArc ?? Math.PI * 0.85);
  }

  const out: SeatPlacement[] = [];
  for (let i = 0; i < rows; i++) {
    const y = base + i * o.rise;
    const d = o.firstRowDistance + i * o.rowSpacing;
    const r = r0 + i * o.rowSpacing;
    const rowLen = curved ? span * r : firstLen;
    // Full circle: no seam where the ends meet.
    const closed = curved && span >= Math.PI * 2 - 1e-6;

    // Split the row into blocks separated by aisles, then fill each block with seats.
    const blocks = aisles + 1;
    const gaps = closed ? blocks : aisles;
    const blockLen = (rowLen - gaps * aisleWidth) / blocks;
    const perBlock = o.seatsPerRow && !curved ? Math.floor(o.seatsPerRow / blocks) : Math.floor(blockLen / seatWidth);
    if (perBlock <= 0) continue;

    for (let b = 0; b < blocks; b++) {
      const blockStart = -rowLen / 2 + (closed ? aisleWidth / 2 : 0) + b * (blockLen + aisleWidth);
      const used = perBlock * seatWidth;
      const first = blockStart + (blockLen - used) / 2 + seatWidth / 2;
      for (let s = 0; s < perBlock; s++) {
        const along = first + s * seatWidth; // distance along the row from its centre
        if (curved) {
          const a = along / r;
          out.push({ x: r * Math.sin(a), y, z: cz + r * Math.cos(a), rotY: a, width: seatWidth, depth: o.rowSpacing });
        } else {
          out.push({ x: along, y, z: d, rotY: 0, width: seatWidth, depth: o.rowSpacing });
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

/** Furthest distance seating reaches from the focus point (for bounds). */
export function seatingDepth(o: SeatingOptions): number {
  return o.firstRowDistance + Math.max(0, Math.floor(o.rows)) * o.rowSpacing;
}

/**
 * Local-frame footprint of a seating block (x from -halfWidth to +halfWidth,
 * z from minZ to maxZ) plus its top height. Use it in a template's bounds().
 */
export function seatingExtent(o: SeatingOptions) {
  const rows = Math.max(0, Math.floor(o.rows));
  const top = (o.baseHeight ?? 0) + Math.max(0, rows - 1) * o.rise + 1;
  const seatWidth = o.seatWidth ?? DEFAULT_SEAT_WIDTH;
  const aisles = Math.max(0, Math.floor(o.aisles ?? 0));
  const firstLen = o.seatsPerRow
    ? o.seatsPerRow * seatWidth + aisles * (aisles > 0 ? o.aisleWidth ?? 1.2 : 0)
    : o.rowWidth ?? 10;
  const curveOn = (o.arcSpan ?? 0) > 0 || (o.curve ?? 0) > 0.001;
  if (rows === 0) return { halfWidth: 0, minZ: 0, maxZ: 0, top: 0 };
  if (!curveOn) return { halfWidth: firstLen / 2, minZ: o.firstRowDistance, maxZ: seatingDepth(o), top };

  const r0 = o.arcSpan ? Math.max(o.firstRowDistance, 0.5) : Math.max(o.firstRowDistance, 0.5) / Math.min(1, o.curve!);
  const cz = o.firstRowDistance - r0;
  const span = o.arcSpan ? Math.min(o.arcSpan, Math.PI * 2) : Math.min(firstLen / r0, o.maxArc ?? Math.PI * 0.85);
  const rMax = r0 + rows * o.rowSpacing;
  const half = span / 2;
  return {
    halfWidth: rMax * Math.sin(Math.min(half, Math.PI / 2)),
    // Arcs sweeping past 90° wrap behind the centre point.
    minZ: cz + (half > Math.PI / 2 ? rMax : r0) * Math.cos(Math.min(half, Math.PI)),
    maxZ: cz + rMax,
    top,
  };
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

export function SeatInstances({ seats }: { seats: SeatPlacement[] }) {
  const chairs = useRef<THREE.InstancedMesh>(null);
  const risers = useRef<THREE.InstancedMesh>(null);
  const raised = useMemo(() => seats.filter((s) => s.y > 0.005), [seats]);

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
        m.position.set(s.x, 0, s.z);
        m.rotation.set(0, s.rotY, 0);
        // Slight overlap hides hairline gaps between neighbouring risers.
        m.scale.set(s.width + 0.01, s.y, s.depth + 0.01);
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
        <instancedMesh key={`r${raised.length}`} ref={risers} args={[riserGeometry, riserMaterial, raised.length]} receiveShadow />
      )}
    </>
  );
}

interface SeatingProps extends SeatingOptions {
  position?: Vec3;
  rotationY?: number;
}

/** Drop-in seating block: <Seating rows={10} ... position={[0,0,6]} />. */
export function Seating({ position = [0, 0, 0], rotationY = 0, ...options }: SeatingProps) {
  const seats = useMemo(
    () => generateSeats(options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(options)],
  );
  return (
    <group position={position} rotation-y={rotationY}>
      <SeatInstances seats={seats} />
    </group>
  );
}
