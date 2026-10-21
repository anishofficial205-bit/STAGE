import type { Params, StageInfo, StageTemplate, Vec3 } from '../types';
import type { Pt } from './shapes';

const EMPTY: StageInfo = { centre: [0, 0], floors: [] };

export const getStageInfo = (t: StageTemplate, params: Params, data: unknown): StageInfo => t.stage?.(params, data) ?? EMPTY;

export function rect(x0: number, z0: number, x1: number, z1: number): Pt[] {
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
}

export function pointInPolygon([x, z]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Height of the highest floor under a world point (0 = audience floor / ground). */
export function floorHeightAt(info: StageInfo, x: number, z: number): number {
  let h = 0;
  for (const f of info.floors) if (f.height > h && pointInPolygon([x, z], f.outline)) h = f.height;
  return h;
}

/** True if every point is on some stage floor. */
export function allOnStage(info: StageInfo, points: Pt[]): boolean {
  if (!info.floors.length) return true;
  return points.every((p) => info.floors.some((f) => pointInPolygon(p, f.outline)));
}

/** Stage edges and centre lines (world x and z values) to snap objects to. */
export function stageSnapLines(info: StageInfo): { xs: number[]; zs: number[]; bounds: [number, number, number, number] } {
  const pts = info.floors.flatMap((f) => f.outline);
  if (!pts.length) return { xs: [info.centre[0]], zs: [info.centre[1]], bounds: [-5, -5, 5, 5] };
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const b: [number, number, number, number] = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  return { xs: [b[0], b[2], info.centre[0]], zs: [b[1], b[3], info.centre[1]], bounds: b };
}

/** Line segments of a closed polygon at height y (for rigging). */
export function loopSegments(points: Pt[], y: number): [Vec3, Vec3][] {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return [[p[0], y, p[1]], [q[0], y, q[1]]] as [Vec3, Vec3];
  });
}
