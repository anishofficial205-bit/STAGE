/**
 * 2D outline helpers. Outlines are lists of [x, z] floor-plan points.
 */
export type Pt = [number, number];

/** Points along an ellipse arc from angle a0 to a1 (radians, 0 = +X, CCW towards +Y). */
export function arcPoints(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, segments = 24): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

/**
 * Rectangle from z = back to z = front whose front edge can bulge forward.
 * bulge = 0 gives a straight front; otherwise the centre of the front edge
 * sits `bulge` further forward than its corners (a smooth arc).
 */
export function bulgedRect(width: number, back: number, front: number, bulge: number): Pt[] {
  const hw = width / 2;
  if (bulge <= 0.001) return [[-hw, back], [hw, back], [hw, front], [-hw, front]];
  const edge = front - bulge;
  const pts: Pt[] = [[-hw, back], [hw, back]];
  const n = 32;
  for (let i = 0; i <= n; i++) {
    const x = hw - (2 * hw * i) / n;
    const t = x / hw;
    pts.push([x, edge + bulge * Math.sqrt(Math.max(0, 1 - t * t))]);
  }
  return pts;
}

export function regularPolygon(sides: number, circumradius: number, startAngle: number): Pt[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = startAngle + (i * Math.PI * 2) / sides;
    return [circumradius * Math.sin(a), circumradius * Math.cos(a)] as Pt;
  });
}

/**
 * Grow a convex polygon outwards by d with mitred corners. Returns the new
 * points (counter-clockwise when viewed from above) and the outward normal of
 * each edge i (from point i to point i+1).
 */
export function offsetPolygon(input: Pt[], d: number): { points: Pt[]; normals: Pt[] } {
  // Normalise winding so edges always run the same way round.
  const area = input.reduce((s, p, i) => {
    const q = input[(i + 1) % input.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const pts = area < 0 ? [...input].reverse() : input;
  const n = pts.length;
  const normals: Pt[] = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    // With positive area in (x, z), the outward normal of edge p→q is (dz, -dx).
    return [(q[1] - p[1]) / len, -(q[0] - p[0]) / len];
  });
  const points: Pt[] = pts.map((p, i) => {
    const a = normals[(i - 1 + n) % n];
    const b = normals[i];
    const k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k];
  });
  return { points, normals };
}

/** Distance from the origin to a convex polygon's edge along direction `angle` (0 = +Z, towards +X). */
export function rayToPolygon(points: Pt[], angle: number): number {
  const u: Pt = [Math.sin(angle), Math.cos(angle)];
  const { normals } = offsetPolygon(points, 0);
  const pts = offsetPolygon(points, 0).points;
  let best = Infinity;
  normals.forEach((nrm, i) => {
    const dot = nrm[0] * u[0] + nrm[1] * u[1];
    if (dot <= 1e-6) return;
    const c = nrm[0] * pts[i][0] + nrm[1] * pts[i][1];
    best = Math.min(best, c / dot);
  });
  return best;
}

/** Angle (0 = +Z, towards +X) of a floor-plan point as seen from the origin. */
export const angleOf = (p: Pt) => Math.atan2(p[0], p[1]);
