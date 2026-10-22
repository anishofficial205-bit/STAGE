/**
 * Floor-plan geometry: wall outlines with clean mitred corners where walls
 * meet, and the snapping used while drawing.
 */
import type { Pt, Wall } from './types';

export const EPS = 0.02;
export const samePt = (a: Pt, b: Pt, eps = EPS) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
export const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const wallLength = (w: Wall) => dist(w.a, w.b);

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const norm = (a: Pt): Pt => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
/** Rotate +90° (the "left" of a direction, x right / z up). */
const left = (u: Pt): Pt => [-u[1], u[0]];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];

/** Intersection of lines p + s·u and q + t·v (null if parallel). */
function intersect(p: Pt, u: Pt, q: Pt, v: Pt): Pt | null {
  const d = cross(u, v);
  if (Math.abs(d) < 1e-6) return null;
  const s = cross(sub(q, p), v) / d;
  return add(p, mul(u, s));
}

/** Walls with an end at `p`, as directions pointing away from it, and their half thickness. */
function armsAt(walls: Wall[], p: Pt) {
  const arms: { id: string; u: Pt; h: number }[] = [];
  for (const w of walls) {
    if (samePt(w.a, p)) arms.push({ id: w.id, u: norm(sub(w.b, w.a)), h: w.thickness / 2 });
    else if (samePt(w.b, p)) arms.push({ id: w.id, u: norm(sub(w.a, w.b)), h: w.thickness / 2 });
  }
  return arms;
}

const angleOf = (u: Pt) => Math.atan2(u[1], u[0]);

/**
 * The two corners of a wall's end at joint `p` (its left and right side, seen
 * from the joint looking along the wall). Each side meets the side of the next
 * wall round the joint that faces it; free ends are square.
 */
function endCorners(walls: Wall[], w: Wall, p: Pt, u: Pt): { l: Pt; r: Pt } {
  const h = w.thickness / 2;
  const n = left(u);
  const square = { l: add(p, mul(n, h)), r: add(p, mul(n, -h)) };
  const others = armsAt(walls, p).filter((a) => a.id !== w.id);
  if (!others.length) return square;
  const a0 = angleOf(u);
  const ccw = (a: { u: Pt }) => {
    let d = angleOf(a.u) - a0;
    while (d <= 0) d += 2 * Math.PI;
    return d;
  };
  // Next wall anticlockwise faces our left side; next clockwise faces our right side.
  const nextL = others.reduce((m, a) => (ccw(a) < ccw(m) ? a : m));
  const nextR = others.reduce((m, a) => (ccw(a) > ccw(m) ? a : m));
  const limit = 4 * Math.max(h, 0.05);
  const meet = (side: 1 | -1, o: { u: Pt; h: number }) => {
    const q = intersect(add(p, mul(n, side * h)), u, add(p, mul(left(o.u), -side * o.h)), o.u);
    return q && dist(q, p) < limit ? q : side === 1 ? square.l : square.r;
  };
  return { l: meet(1, nextL), r: meet(-1, nextR) };
}

/** Plan outline of a wall (4 points), with its ends mitred against the walls it meets. */
export function wallPolygon(walls: Wall[], w: Wall): Pt[] {
  const d = norm(sub(w.b, w.a));
  const atA = endCorners(walls, w, w.a, d);
  const atB = endCorners(walls, w, w.b, mul(d, -1));
  // Seen from B looking back, its left is the wall's right.
  return [atA.l, atB.r, atB.l, atA.r];
}

/** Distance along the wall of the point nearest `p`, and how far `p` is from the wall's centre line. */
export function projectOnWall(w: Wall, p: Pt) {
  const d = sub(w.b, w.a);
  const L = Math.hypot(d[0], d[1]) || 1;
  const s = Math.max(0, Math.min(L, ((p[0] - w.a[0]) * d[0] + (p[1] - w.a[1]) * d[1]) / L));
  const q = add(w.a, mul(d, s / L));
  return { s, at: q, offset: dist(q, p), length: L };
}

/** Nearest point on any segment of the outlines, within `r`. */
export function nearestOnOutlines(outlines: Pt[][], p: Pt, r: number): Pt | null {
  let best: Pt | null = null;
  let bd = r;
  for (const poly of outlines)
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ab = sub(b, a);
      const l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2));
      // Corners win over the middle of an edge.
      const q = t < 0.02 ? a : t > 0.98 ? b : add(a, mul(ab, t));
      const dq = dist(q, p);
      if (dq < bd) {
        bd = dq;
        best = q;
      }
    }
  return best;
}

export interface SnapResult {
  at: Pt;
  /** What it snapped to, for the on-screen marker. */
  kind: 'end' | 'stage' | 'angle' | 'grid' | 'free';
}

/**
 * Where the next wall corner goes: an existing wall end, a point on the stage
 * footprint, then along a 45°/90° direction from the previous corner (Shift:
 * any angle), on the grid.
 */
export function snapWallPoint(raw: Pt, prev: Pt | undefined, o: { walls: Wall[]; outlines: Pt[][]; radius: number; grid: number; freeAngle: boolean; noSnap: boolean }): SnapResult {
  if (o.noSnap) return { at: raw, kind: 'free' };
  const ends = o.walls.flatMap((w) => [w.a, w.b]);
  const end = ends.reduce<Pt | null>((m, e) => (dist(e, raw) < o.radius && (!m || dist(e, raw) < dist(m, raw)) ? e : m), null);
  if (end) return { at: [end[0], end[1]], kind: 'end' };
  const onStage = nearestOnOutlines(o.outlines, raw, o.radius);
  if (onStage) return { at: onStage, kind: 'stage' };
  const g = o.grid;
  const snap = (v: number) => Math.round(v / g) * g;
  if (prev && !o.freeAngle) {
    const dx = raw[0] - prev[0];
    const dz = raw[1] - prev[1];
    const step = Math.PI / 4;
    const ang = Math.round(Math.atan2(dz, dx) / step) * step;
    const len = snap(Math.hypot(dx, dz) * Math.cos(Math.atan2(dz, dx) - ang));
    const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
    return { at: [r6(prev[0] + Math.cos(ang) * len), r6(prev[1] + Math.sin(ang) * len)], kind: 'angle' };
  }
  return { at: [Math.round(snap(raw[0]) * 1e6) / 1e6, Math.round(snap(raw[1]) * 1e6) / 1e6], kind: 'grid' };
}
