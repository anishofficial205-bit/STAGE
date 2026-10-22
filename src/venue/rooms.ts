/**
 * Room outlines from the walls. A room is the area you can reach from its seed
 * point without crossing a wall: the walls are drawn onto a fine grid, the
 * grid is flood-filled from the seed, and the filled area's edge is traced and
 * simplified into a polygon. Axis-aligned walls on the 0.1 m grid give exact
 * outlines; angled walls are straightened by the simplification.
 */
import { wallPolygon } from './geometry';
import type { Pt, Room, Wall } from './types';

const pointIn = ([x, z]: Pt, poly: Pt[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
export { pointIn };

export function polygonArea(poly: Pt[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a / 2);
}

export function centroid(poly: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    const f = x1 * z2 - x2 * z1;
    a += f;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  if (Math.abs(a) < 1e-9) return poly[0] ?? [0, 0];
  return [cx / (3 * a), cz / (3 * a)];
}

/** Distance from a point to a segment. */
function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}

/** Douglas–Peucker on a closed loop. */
function simplify(loop: Pt[], tol: number): Pt[] {
  if (loop.length < 4) return loop;
  const dp = (pts: Pt[]): Pt[] => {
    let best = -1;
    let bd = tol;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = segDist(pts[i], pts[0], pts[pts.length - 1]);
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0) return [pts[0], pts[pts.length - 1]];
    return [...dp(pts.slice(0, best + 1)).slice(0, -1), ...dp(pts.slice(best))];
  };
  // Split at the point farthest from the first, so both halves are open chains.
  let far = 0;
  for (let i = 1; i < loop.length; i++) if (Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]) > Math.hypot(loop[far][0] - loop[0][0], loop[far][1] - loop[0][1])) far = i;
  const a = dp(loop.slice(0, far + 1));
  const b = dp([...loop.slice(far), loop[0]]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

/** Drop points that sit on a straight line between their neighbours. */
function dropCollinear(loop: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[(i - 1 + loop.length) % loop.length];
    const b = loop[i];
    const c = loop[(i + 1) % loop.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  return out;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * The outline of the enclosed area containing `seed`, or null if the walls
 * don't close it (the fill escapes past the walls' extent).
 */
export function enclosedArea(walls: Wall[], seed: Pt): Pt[] | null {
  if (!walls.length) return null;
  const xs = walls.flatMap((w) => [w.a[0], w.b[0]]);
  const zs = walls.flatMap((w) => [w.a[1], w.b[1]]);
  const pad = 1;
  const x0 = Math.min(...xs) - pad;
  const z0 = Math.min(...zs) - pad;
  const x1 = Math.max(...xs) + pad;
  const z1 = Math.max(...zs) + pad;
  if (seed[0] <= x0 || seed[0] >= x1 || seed[1] <= z0 || seed[1] >= z1) return null;
  // 0.1 m cells (coarser for very big venues), aligned to the grid so axis walls land exactly.
  let cell = 0.1;
  while (((x1 - x0) / cell) * ((z1 - z0) / cell) > 1.5e6) cell *= 2;
  const ox = Math.floor(x0 / cell) * cell;
  const oz = Math.floor(z0 / cell) * cell;
  const nx = Math.ceil((x1 - ox) / cell);
  const nz = Math.ceil((z1 - oz) / cell);
  const blocked = new Uint8Array(nx * nz);
  for (const w of walls) {
    const poly = wallPolygon(walls, w);
    const px = poly.map((p) => p[0]);
    const pz = poly.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...px) - ox) / cell));
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(...px) - ox) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(...pz) - oz) / cell));
    const j1 = Math.min(nz - 1, Math.ceil((Math.max(...pz) - oz) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!blocked[j * nx + i] && pointIn([ox + (i + 0.5) * cell, oz + (j + 0.5) * cell], poly)) blocked[j * nx + i] = 1;
  }
  const si = Math.floor((seed[0] - ox) / cell);
  const sj = Math.floor((seed[1] - oz) / cell);
  if (blocked[sj * nx + si]) return null;
  const filled = new Uint8Array(nx * nz);
  const stack = [sj * nx + si];
  filled[stack[0]] = 1;
  while (stack.length) {
    const k = stack.pop()!;
    const i = k % nx;
    const j = (k - i) / nx;
    // Reaching the padding means the walls don't close this area.
    if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) return null;
    for (const n of [k - 1, k + 1, k - nx, k + nx]) {
      if (!filled[n] && !blocked[n]) {
        filled[n] = 1;
        stack.push(n);
      }
    }
  }
  // Boundary edges between filled and empty cells, as directed edges (filled on the left) keyed by start corner.
  const next = new Map<number, number[]>();
  const key = (i: number, j: number) => j * (nx + 1) + i;
  const addEdge = (a: number, b: number) => {
    const l = next.get(a);
    if (l) l.push(b);
    else next.set(a, [b]);
  };
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      if (!filled[j * nx + i]) continue;
      if (!filled[(j - 1) * nx + i]) addEdge(key(i, j), key(i + 1, j));
      if (!filled[j * nx + i + 1]) addEdge(key(i + 1, j), key(i + 1, j + 1));
      if (!filled[(j + 1) * nx + i]) addEdge(key(i + 1, j + 1), key(i, j + 1));
      if (!filled[j * nx + i - 1]) addEdge(key(i, j + 1), key(i, j));
    }
  // Walk the longest loop (the outer edge; any inner loops are columns inside the room).
  let best: number[] = [];
  const used = new Set<string>();
  for (const [start, outs] of next) {
    for (const first of outs) {
      if (used.has(`${start}>${first}`)) continue;
      const loop = [start];
      let a = start;
      let b = first;
      let guard = 0;
      while (guard++ < 1e6) {
        used.add(`${a}>${b}`);
        if (b === start) break;
        loop.push(b);
        const cands = (next.get(b) ?? []).filter((c) => !used.has(`${b}>${c}`));
        if (!cands.length) break;
        a = b;
        b = cands[0];
      }
      if (loop.length > best.length) best = loop;
    }
  }
  const pts = best.map((k) => [r3(ox + (k % (nx + 1)) * cell), r3(oz + Math.floor(k / (nx + 1)) * cell)] as Pt);
  const clean = dropCollinear(pts);
  // Staircases along angled walls become straight lines again.
  const hasDiagonals = walls.some((w) => Math.abs(w.a[0] - w.b[0]) > 1e-3 && Math.abs(w.a[1] - w.b[1]) > 1e-3);
  return hasDiagonals ? dropCollinear(simplify(clean, cell * 1.5)) : clean;
}

/** Each room's outline from the current walls (falls back to its last outline if no longer closed). Cached per walls list. */
const cache = new WeakMap<Wall[], Map<string, Pt[] | null>>();
export function roomOutline(walls: Wall[], room: Room): { polygon: Pt[]; closed: boolean } {
  let m = cache.get(walls);
  if (!m) cache.set(walls, (m = new Map()));
  const k = `${room.seed[0]},${room.seed[1]}`;
  if (!m.has(k)) m.set(k, enclosedArea(walls, room.seed));
  const p = m.get(k);
  return p ? { polygon: p, closed: true } : { polygon: room.polygon, closed: false };
}

/** The room a point is in (by outline), if any. */
export function roomAt(walls: Wall[], rooms: Room[], p: Pt): Room | undefined {
  return rooms.find((r) => pointIn(p, roomOutline(walls, r).polygon));
}
