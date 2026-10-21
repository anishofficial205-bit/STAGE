/**
 * Arch opening outlines in wall coordinates (x across, y up), traced from the
 * bottom-left, up and over the top, down to the bottom-right.
 */
import type { Pt } from '../helpers/shapes';

export type ArchTop = 'rounded' | 'pointed' | 'flat' | 'multifoil';

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

/**
 * Gothic arc from (-hw, 0) over an apex at (0, rise) to (hw, 0): two circular
 * arcs, each centred on the springline on the far side.
 */
function pointedArc(hw: number, rise: number): Pt[] {
  const c = (rise * rise - hw * hw) / (2 * hw); // centre offset from the middle, along x
  const r = c + hw;
  const apexAngle = Math.atan2(rise, -c);
  const left = arc(c, 0, r, Math.PI, apexAngle, 24);
  const right = arc(-c, 0, r, Math.PI - apexAngle, 0, 24);
  return [...left, ...right.slice(1)];
}

export function archOpening(top: ArchTop, width: number, height: number): Pt[] {
  const hw = width / 2;
  if (top === 'flat') return [[-hw, 0], [-hw, height], [hw, height], [hw, 0]];

  if (top === 'rounded') {
    const rise = Math.min(hw, height * 0.7);
    const spring = height - rise;
    // Semicircle when there's room; otherwise a flattened (elliptical) head.
    const pts = arc(0, 0, 1, Math.PI, 0, 48).map(([x, y]) => [x * hw, spring + y * rise] as Pt);
    return [[-hw, 0], ...pts, [hw, 0]];
  }

  if (top === 'pointed') {
    const rise = Math.min(hw * 1.73, height * 0.7);
    const spring = height - rise;
    return [[-hw, 0], ...pointedArc(hw, rise).map(([x, y]) => [x, y + spring] as Pt), [hw, 0]];
  }

  // Multi-foil (Mughal cusped arch): a pointed envelope made of small lobes that
  // bulge outwards into the wall, with cusps pointing into the opening.
  const lobes = 7;
  const rise = Math.min(hw * 1.15, height * 0.7);
  const spring = height - rise;
  const envelope = pointedArc(hw * 0.94, rise).map(([x, y]) => [x, y + spring] as Pt);
  // Resample the envelope evenly into lobe endpoints.
  const lengths = envelope.map((p, i) => (i ? Math.hypot(p[0] - envelope[i - 1][0], p[1] - envelope[i - 1][1]) : 0));
  const total = lengths.reduce((a, b) => a + b, 0);
  const at = (d: number): Pt => {
    let acc = 0;
    for (let i = 1; i < envelope.length; i++) {
      if (acc + lengths[i] >= d) {
        const t = (d - acc) / lengths[i];
        return [envelope[i - 1][0] + (envelope[i][0] - envelope[i - 1][0]) * t, envelope[i - 1][1] + (envelope[i][1] - envelope[i - 1][1]) * t];
      }
      acc += lengths[i];
    }
    return envelope[envelope.length - 1];
  };
  const out: Pt[] = [[-hw, 0], [-hw, spring], [envelope[0][0], spring]];
  const centre: Pt = [0, spring];
  for (let k = 0; k < lobes; k++) {
    const a = at((total * k) / lobes);
    const b = at((total * (k + 1)) / lobes);
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Outward = away from the arch centre.
    const nx = mid[0] - centre[0];
    const ny = mid[1] - centre[1];
    const nl = Math.hypot(nx, ny) || 1;
    const sag = len * 0.38;
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const bulge = 4 * sag * t * (1 - t);
      out.push([a[0] + (b[0] - a[0]) * t + (nx / nl) * bulge, a[1] + (b[1] - a[1]) * t + (ny / nl) * bulge]);
    }
  }
  // Lobes bulge outwards; keep them inside the opening's box so the frame outline stays valid.
  const lobePts = out.slice(3);
  const maxX = Math.max(...lobePts.map((q) => Math.abs(q[0])));
  const maxY = Math.max(...lobePts.map((q) => q[1]));
  const sx = maxX > hw * 0.999 ? (hw * 0.999) / maxX : 1;
  const sy = maxY > height ? (height - spring) / (maxY - spring) : 1;
  const fitted = out.map((q, i) => (i < 3 ? q : ([q[0] * sx, spring + (q[1] - spring) * sy] as Pt)));
  fitted.push([hw, spring], [hw, 0]);
  return fitted;
}

/** Length of the opening's edge excluding the floor (for the "inner" face size). */
export function openingPerimeter(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}
