/**
 * Small building blocks shared by templates: boxes, extruded floor slabs,
 * curved walls, flat panels and a wall with an arch opening.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../types';
import { ROUGHNESS } from './materials';
import type { Pt } from './shapes';

interface MatProps {
  color: string;
  opacity?: number;
}

function Mat({ color, opacity = 1, side }: MatProps & { side?: THREE.Side }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={ROUGHNESS}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 1}
      side={side}
    />
  );
}

/** Axis-aligned box between two corners. Skipped when it has no volume. */
export function Box({ from, to, color, opacity, castShadow = true }: { from: Vec3; to: Vec3; castShadow?: boolean } & MatProps) {
  const size: Vec3 = [Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]), Math.abs(to[2] - from[2])];
  if (size.some((s) => s < 1e-4)) return null;
  return (
    <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]} castShadow={castShadow} receiveShadow>
      <boxGeometry args={size} />
      <Mat color={color} opacity={opacity} />
    </mesh>
  );
}

/** A floor-plan outline ([x, z] points) extruded between two heights. */
export function Slab({ outline, bottom = 0, top, color, opacity, castShadow = true }: { outline: Pt[]; bottom?: number; top: number; castShadow?: boolean } & MatProps) {
  const key = JSON.stringify(outline);
  const depth = Math.max(top - bottom, 0.02);
  const geometry = useMemo(() => {
    // Shape lives in XY; rotating -90° about X maps shape (x, y) to world (x, -y) on the floor.
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
  }, [key, depth]); // eslint-disable-line react-hooks/exhaustive-deps
  if (outline.length < 3) return null;
  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2} position-y={bottom} castShadow={castShadow} receiveShadow>
      <Mat color={color} opacity={opacity} />
    </mesh>
  );
}

/** Curved wall: part of a cylinder around (cx, cz). Angles: 0 = +Z, increasing towards +X. */
export function ArcWall({
  cx = 0,
  cz = 0,
  radius,
  start,
  length,
  bottom,
  top,
  color,
  opacity,
}: { cx?: number; cz?: number; radius: number; start: number; length: number; bottom: number; top: number } & MatProps) {
  const h = top - bottom;
  if (h <= 0 || radius <= 0) return null;
  return (
    <mesh position={[cx, bottom + h / 2, cz]} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, h, 64, 1, true, start, length]} />
      <Mat color={color} opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * A flat vertical panel. Unrotated it faces +Z. With `oneSided` it is invisible
 * from behind — used for room walls so you can always see in from outside.
 */
export function Panel({
  position,
  rotationY = 0,
  width,
  height,
  color,
  opacity,
  oneSided = false,
}: { position: Vec3; rotationY?: number; width: number; height: number; oneSided?: boolean } & MatProps) {
  if (width <= 0 || height <= 0) return null;
  return (
    <mesh position={position} rotation-y={rotationY} castShadow={!oneSided} receiveShadow>
      <planeGeometry args={[width, height]} />
      <Mat color={color} opacity={opacity} side={oneSided ? THREE.FrontSide : THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * Outline of an arch opening, from bottom-left, up, across the top, down to
 * bottom-right, in wall coordinates (x across, y up). `rise` > 0 rounds the top.
 * `grow` expands the outline outwards (used for the frame around an opening).
 */
export function archOutline(halfWidth: number, bottom: number, top: number, rise: number, grow = 0): Pt[] {
  const hw = halfWidth + grow;
  if (rise <= 0.001) return [[-hw, bottom], [-hw, top + grow], [hw, top + grow], [hw, bottom]];
  const spring = top - rise; // where the curve starts
  return [[-hw, bottom], ...arcPoints2(hw, spring, rise + grow), [hw, bottom]];
}

function arcPoints2(hw: number, spring: number, ry: number): Pt[] {
  const pts: Pt[] = [];
  const n = 32;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (Math.PI * i) / n;
    pts.push([hw * Math.cos(a), spring + ry * Math.sin(a)]);
  }
  return pts;
}

/**
 * A wall in the XY plane (centred on x = 0) whose front face sits at z = front,
 * with an opening cut from its bottom edge. Polygon: outer rectangle, then the
 * opening traced back down, so no triangulated holes are needed.
 */
export function WallWithOpening({
  width,
  height,
  thickness,
  front,
  opening,
  color,
  opacity,
}: { width: number; height: number; thickness: number; front: number; opening: Pt[] } & MatProps) {
  const hw = width / 2;
  const key = JSON.stringify([width, height, thickness, opening]);
  const geometry = useMemo(() => {
    const pts: Pt[] = [[-hw, 0], [-hw, height], [hw, height], [hw, 0], ...[...opening].reverse()];
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geometry} position-z={front - thickness} castShadow receiveShadow>
      <Mat color={color} opacity={opacity} />
    </mesh>
  );
}

/** A U-shaped frame around an opening (outer outline + inner outline), front face at z = front. */
export function OpeningFrame({
  inner,
  outer,
  depth,
  front,
  color,
}: { inner: Pt[]; outer: Pt[]; depth: number; front: number } & MatProps) {
  const key = JSON.stringify([inner, outer, depth]);
  const geometry = useMemo(() => {
    const pts: Pt[] = [...outer, ...[...inner].reverse()];
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geometry} position-z={front - depth} castShadow receiveShadow>
      <Mat color={color} />
    </mesh>
  );
}

/** A square-section bar between two points in any direction (truss, rails, frames). */
export function Beam({ from, to, size = 0.3, color, opacity }: { from: Vec3; to: Vec3; size?: number } & MatProps) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize()),
    [from.join(), to.join()], // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (len < 1e-4) return null;
  return (
    <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={quaternion} castShadow receiveShadow>
      <boxGeometry args={[size, size, len]} />
      <Mat color={color} opacity={opacity} />
    </mesh>
  );
}

/** Thin box between two local points, for building lattices. */
function strut(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(t, t, len);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

const trussCache = new Map<string, THREE.BufferGeometry>();

/** Lattice geometry of a square truss of length `len` along +Z (cached; shared between instances). */
function trussGeometry(len: number, size: number) {
  const key = `${len.toFixed(2)}:${size}`;
  const hit = trussCache.get(key);
  if (hit) return hit;
  const h = size / 2;
  const chord = size * 0.12;
  const lace = size * 0.06;
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const parts: THREE.BufferGeometry[] = corners.map(([x, y]) => strut(new THREE.Vector3(x, y, 0), new THREE.Vector3(x, y, len), chord));
  const steps = Math.max(1, Math.round(len / size));
  const step = len / steps;
  for (let f = 0; f < 4; f++) {
    const [ax, ay] = corners[f];
    const [bx, by] = corners[(f + 1) % 4];
    for (let k = 0; k < steps; k++) {
      // Zig-zag lacing between neighbouring chords.
      const [x0, y0, x1, y1] = k % 2 === 0 ? [ax, ay, bx, by] : [bx, by, ax, ay];
      parts.push(strut(new THREE.Vector3(x0, y0, k * step), new THREE.Vector3(x1, y1, (k + 1) * step), lace));
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  trussCache.set(key, merged);
  return merged;
}

/** A lattice box truss between two points in any direction (one merged mesh). */
export function Truss({ from, to, size = 0.4, color }: { from: Vec3; to: Vec3; size?: number; color: string }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize()),
    [from.join(), to.join()], // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (len < 0.05) return null;
  return (
    <mesh geometry={trussGeometry(len, size)} position={a} quaternion={quaternion} castShadow>
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.6} />
    </mesh>
  );
}
