/**
 * Drawn stage shapes for the Build Your Own template. A shape is a closed
 * outline of points on the floor (x, z in metres). Any edge can bow into an
 * arc (its `bulge`, outward positive) and straight corners can be rounded.
 * The outline is sampled into a polygon for the 3D platform, the stage floor
 * used by set objects, and the top surface for graphics.
 */
import type { Pt } from '../../helpers/shapes';
import type { Block } from '../blackBox/blocks';

export interface ShapePoint {
  x: number;
  z: number;
  /** Corner radius for this corner (overrides the shape's radius). */
  r?: number;
}

export interface DrawnShape {
  id: string;
  name: string;
  points: ShapePoint[];
  /** Per edge (from point i to i+1): how far the middle bows out (m); negative bows in. */
  bulges: number[];
  height: number;
  edge: 'straight' | 'stepped';
  material: string;
  /** Corner radius for every corner without its own. */
  radius: number;
}

export interface CustomData {
  shapes: DrawnShape[];
  /** Seating blocks, as in the Black Box. */
  blocks: Block[];
}

export const MATERIAL_COLORS: Record<string, { top: string; side: string; label: string }> = {
  black: { top: '#2c2d31', side: '#202124', label: 'Black stage floor' },
  wood: { top: '#b48a5c', side: '#8a6642', label: 'Wood' },
  grey: { top: '#8d9197', side: '#6c7076', label: 'Grey' },
  white: { top: '#e3e1db', side: '#c9c6bf', label: 'White' },
};

let counter = 0;
export const shapeId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Signed area: positive when the points run anticlockwise (x right, z up). */
export function signedArea(pts: Pt[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

/** Unit normal pointing out of the shape for the edge a → b. */
export function outwardNormal(a: Pt, b: Pt, area: number): Pt {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  const s = area >= 0 ? 1 : -1;
  return [(s * dz) / l, (-s * dx) / l];
}

const ARC_STEPS = 24;
const FILLET_STEPS = 10;

/** Points strictly between a and b along an arc that bows `bulge` along normal n at its middle. */
function arcBetween(a: Pt, b: Pt, bulge: number, n: Pt): Pt[] {
  const c = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (c < 1e-6 || Math.abs(bulge) < 1e-3) return [];
  const s = Math.abs(bulge);
  const dir = Math.sign(bulge);
  const R = (c * c) / 4 / (2 * s) + s / 2;
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const apex: Pt = [m[0] + n[0] * bulge, m[1] + n[1] * bulge];
  const centre: Pt = [apex[0] - n[0] * dir * R, apex[1] - n[1] * dir * R];
  const ang = (p: Pt) => Math.atan2(p[1] - centre[1], p[0] - centre[0]);
  const a0 = ang(a);
  let sweep = ang(b) - a0;
  while (sweep <= -Math.PI) sweep += 2 * Math.PI;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  // Go the way that passes through the apex.
  let mid = ang(apex) - a0;
  while (mid <= -Math.PI) mid += 2 * Math.PI;
  while (mid > Math.PI) mid -= 2 * Math.PI;
  const between = sweep >= 0 ? mid >= 0 && mid <= sweep : mid <= 0 && mid >= sweep;
  if (!between) sweep -= Math.sign(sweep) * 2 * Math.PI;
  const steps = Math.max(6, Math.round((ARC_STEPS * Math.abs(sweep)) / Math.PI));
  const out: Pt[] = [];
  for (let k = 1; k < steps; k++) {
    const t = a0 + (sweep * k) / steps;
    out.push([centre[0] + R * Math.cos(t), centre[1] + R * Math.sin(t)]);
  }
  return out;
}

/** The middle of an edge as drawn (the apex of a curved edge). */
export function edgeMiddle(s: DrawnShape, i: number): Pt {
  const pts = s.points.map((p) => [p.x, p.z] as Pt);
  const a = pts[i];
  const b = pts[(i + 1) % pts.length];
  const n = outwardNormal(a, b, signedArea(pts));
  const bulge = s.bulges[i] ?? 0;
  return [(a[0] + b[0]) / 2 + n[0] * bulge, (a[1] + b[1]) / 2 + n[1] * bulge];
}

/** Sample the full outline: rounded corners (between straight edges) and curved edges. */
export function outline(s: DrawnShape): Pt[] {
  const pts = s.points.map((p) => [p.x, p.z] as Pt);
  const n = pts.length;
  if (n < 3) return pts;
  const area = signedArea(pts);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const p = pts[i];
    const next = pts[(i + 1) % n];
    const r = s.points[i].r ?? s.radius;
    const straight = Math.abs(s.bulges[(i - 1 + n) % n] ?? 0) < 1e-3 && Math.abs(s.bulges[i] ?? 0) < 1e-3;
    const lin = Math.hypot(prev[0] - p[0], prev[1] - p[1]);
    const lout = Math.hypot(next[0] - p[0], next[1] - p[1]);
    const u1: Pt = [(prev[0] - p[0]) / (lin || 1), (prev[1] - p[1]) / (lin || 1)];
    const u2: Pt = [(next[0] - p[0]) / (lout || 1), (next[1] - p[1]) / (lout || 1)];
    const theta = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    if (straight && r > 0.01 && theta > 0.05 && theta < Math.PI - 0.05) {
      // Fillet: tangent points on both edges, centre along the bisector.
      const t = Math.min(r / Math.tan(theta / 2), 0.49 * Math.min(lin, lout));
      const reff = t * Math.tan(theta / 2);
      const t1: Pt = [p[0] + u1[0] * t, p[1] + u1[1] * t];
      const t2: Pt = [p[0] + u2[0] * t, p[1] + u2[1] * t];
      const bis = [u1[0] + u2[0], u1[1] + u2[1]];
      const bl = Math.hypot(bis[0], bis[1]) || 1;
      const d = reff / Math.sin(theta / 2);
      const c: Pt = [p[0] + (bis[0] / bl) * d, p[1] + (bis[1] / bl) * d];
      const a1 = Math.atan2(t1[1] - c[1], t1[0] - c[0]);
      let sw = Math.atan2(t2[1] - c[1], t2[0] - c[0]) - a1;
      while (sw <= -Math.PI) sw += 2 * Math.PI;
      while (sw > Math.PI) sw -= 2 * Math.PI;
      for (let k = 0; k <= FILLET_STEPS; k++) {
        const ang = a1 + (sw * k) / FILLET_STEPS;
        out.push([c[0] + reff * Math.cos(ang), c[1] + reff * Math.sin(ang)]);
      }
    } else out.push(p);
    const bulge = s.bulges[i] ?? 0;
    if (Math.abs(bulge) >= 1e-3) out.push(...arcBetween(p, next, bulge, outwardNormal(p, next, area)));
  }
  return out.filter((q, i) => {
    const r = out[(i + 1) % out.length];
    return Math.hypot(q[0] - r[0], q[1] - r[1]) > 1e-4;
  });
}

/** Push a sampled outline out by `d` (mitred, with a limit at sharp corners). */
export function offsetOutline(pts: Pt[], d: number): Pt[] {
  const area = signedArea(pts);
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const n1 = outwardNormal(prev, p, area);
    const n2 = outwardNormal(p, next, area);
    const m: Pt = [n1[0] + n2[0], n1[1] + n2[1]];
    const ml = Math.hypot(m[0], m[1]) || 1;
    const cos = Math.max(0.35, (m[0] * n1[0] + m[1] * n1[1]) / ml);
    return [p[0] + (m[0] / ml) * (d / cos), p[1] + (m[1] / ml) * (d / cos)];
  });
}

export function bbox(pts: Pt[]) {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

export const edgeLength = (a: ShapePoint, b: ShapePoint) => Math.hypot(b.x - a.x, b.z - a.z);

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function sanitizeShapes(raw: unknown): DrawnShape[] {
  if (!Array.isArray(raw)) return [];
  const out: DrawnShape[] = [];
  for (const s of raw as Partial<DrawnShape>[]) {
    if (!s || !Array.isArray(s.points)) continue;
    const points = s.points.filter((p) => p && isNum(p.x) && isNum(p.z)).map((p) => ({ x: p.x, z: p.z, ...(isNum(p.r) ? { r: Math.max(0, p.r) } : {}) }));
    if (points.length < 3) continue;
    out.push({
      id: typeof s.id === 'string' ? s.id : shapeId(),
      name: typeof s.name === 'string' ? s.name : `Stage ${out.length + 1}`,
      points,
      bulges: points.map((_, i) => (Array.isArray(s.bulges) && isNum(s.bulges[i]) ? s.bulges[i] : 0)),
      height: isNum(s.height) ? Math.max(0, Math.min(5, s.height)) : 0.6,
      edge: s.edge === 'stepped' ? 'stepped' : 'straight',
      material: typeof s.material === 'string' && s.material in MATERIAL_COLORS ? s.material : 'black',
      radius: isNum(s.radius) ? Math.max(0, s.radius) : 0,
    });
  }
  return out;
}
