/**
 * Walking routes through the venue. The plan is laid on a 0.2 m grid; walls
 * (with room for a person to pass, 0.25 m) block it, door openings don't. A*
 * finds the shortest way, then the zig-zags are pulled straight.
 */
import { doorSpan, wallFrame } from './geometry';
import { centroid, pointIn, roomOutline } from './rooms';
import { ROOM_TYPES, type Pt, type Route, type RouteEnd, type Venue } from './types';

export const WALK = 1.2;
export const HURRY = 2;
const CLEAR = 0.25;

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}

/** Where a route end is: a room's middle, or the middle of a door's opening. */
export function endPoint(v: Venue, e: RouteEnd): Pt | null {
  if (e.kind === 'door') {
    const d = v.doors.find((x) => x.id === e.id);
    const w = d && v.walls.find((x) => x.id === d.wallId);
    if (!d || !w) return null;
    const [s0, s1] = doorSpan(w, d);
    return wallFrame(w, (s0 + s1) / 2).at;
  }
  const r = v.rooms.find((x) => x.id === e.id);
  if (!r) return null;
  const poly = roomOutline(v.walls, r).polygon;
  const c = poly.length >= 3 ? centroid(poly) : r.seed;
  return pointIn(c, poly) ? c : r.seed;
}

export const endName = (v: Venue, e: RouteEnd) =>
  e.kind === 'door' ? v.doors.find((d) => d.id === e.id)?.entrance ?? 'Door' : v.rooms.find((r) => r.id === e.id)?.name ?? 'Room';

class Heap {
  private a: [number, number][] = [];
  get size() {
    return this.a.length;
  }
  push(k: number, f: number) {
    const a = this.a;
    a.push([k, f]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][1] <= a[i][1]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.a;
    const top = a[0][0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][1] < a[m][1]) m = l;
        if (r < a.length && a[r][1] < a[m][1]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Shortest walking path from a to b around the walls, through doors (null if there's no way through). */
export function findPath(v: Venue, a: Pt, b: Pt): Pt[] | null {
  const xs = [a[0], b[0], ...v.walls.flatMap((w) => [w.a[0], w.b[0]])];
  const zs = [a[1], b[1], ...v.walls.flatMap((w) => [w.a[1], w.b[1]])];
  const pad = 3;
  let cell = 0.2;
  const x0 = Math.min(...xs) - pad;
  const z0 = Math.min(...zs) - pad;
  const x1 = Math.max(...xs) + pad;
  const z1 = Math.max(...zs) + pad;
  while (((x1 - x0) / cell) * ((z1 - z0) / cell) > 900_000) cell *= 1.5;
  const nx = Math.ceil((x1 - x0) / cell);
  const nz = Math.ceil((z1 - z0) / cell);
  const blocked = new Uint8Array(nx * nz);
  const centre = (i: number, j: number): Pt => [x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell];
  const range = (lo: number, hi: number, o: number, n: number) => [Math.max(0, Math.floor((lo - o) / cell)), Math.min(n - 1, Math.ceil((hi - o) / cell))];
  for (const w of v.walls) {
    const r = w.thickness / 2 + CLEAR;
    const [i0, i1] = range(Math.min(w.a[0], w.b[0]) - r, Math.max(w.a[0], w.b[0]) + r, x0, nx);
    const [j0, j1] = range(Math.min(w.a[1], w.b[1]) - r, Math.max(w.a[1], w.b[1]) + r, z0, nz);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (segDist(centre(i, j), w.a, w.b) <= r) blocked[j * nx + i] = 1;
  }
  // Door openings are passable (a little narrower than the door, through the whole wall).
  for (const d of v.doors) {
    const w = v.walls.find((x) => x.id === d.wallId);
    if (!w) continue;
    const [s0, s1] = doorSpan(w, d);
    const { d: dir, n } = wallFrame(w, 0);
    const reach = w.thickness / 2 + CLEAR + cell;
    const corners = [s0, s1].flatMap((s) => [-reach, reach].map((t) => [w.a[0] + dir[0] * s + n[0] * t, w.a[1] + dir[1] * s + n[1] * t]));
    const [i0, i1] = range(Math.min(...corners.map((p) => p[0])), Math.max(...corners.map((p) => p[0])), x0, nx);
    const [j0, j1] = range(Math.min(...corners.map((p) => p[1])), Math.max(...corners.map((p) => p[1])), z0, nz);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const p = centre(i, j);
        const u = (p[0] - w.a[0]) * dir[0] + (p[1] - w.a[1]) * dir[1];
        const t = (p[0] - w.a[0]) * n[0] + (p[1] - w.a[1]) * n[1];
        if (u >= s0 + 0.05 && u <= s1 - 0.05 && Math.abs(t) <= reach) blocked[j * nx + i] = 0;
      }
  }
  const cellOf = (p: Pt) => Math.min(nz - 1, Math.max(0, Math.floor((p[1] - z0) / cell))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((p[0] - x0) / cell)));
  /** The nearest open cell to a point (ends can sit right in a doorway or by a wall). */
  const open = (p: Pt) => {
    const k = cellOf(p);
    if (!blocked[k]) return k;
    const i0 = k % nx;
    const j0 = (k - i0) / nx;
    for (let r = 1; r < 15; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di;
          const j = j0 + dj;
          if (i >= 0 && j >= 0 && i < nx && j < nz && !blocked[j * nx + i]) return j * nx + i;
        }
    return -1;
  };
  const start = open(a);
  const goal = open(b);
  if (start < 0 || goal < 0) return null;
  const gi = goal % nx;
  const gj = (goal - gi) / nx;
  const g = new Float32Array(nx * nz).fill(Infinity);
  const came = new Int32Array(nx * nz).fill(-1);
  const closed = new Uint8Array(nx * nz);
  const h = (k: number) => {
    const i = k % nx;
    const dx = Math.abs(i - gi);
    const dz = Math.abs((k - i) / nx - gj);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  const heap = new Heap();
  g[start] = 0;
  heap.push(start, h(start));
  const steps: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let found = false;
  while (heap.size) {
    const k = heap.pop();
    if (closed[k]) continue;
    if (k === goal) {
      found = true;
      break;
    }
    closed[k] = 1;
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj, c] of steps) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
      const nk = nj * nx + ni;
      if (blocked[nk] || closed[nk]) continue;
      // No cutting corners past a wall.
      if (di && dj && (blocked[j * nx + ni] || blocked[nj * nx + i])) continue;
      const ng = g[k] + c;
      if (ng < g[nk]) {
        g[nk] = ng;
        came[nk] = k;
        heap.push(nk, ng + h(nk));
      }
    }
  }
  if (!found) return null;
  const cells: Pt[] = [];
  for (let k = goal; k !== -1; k = came[k]) {
    const i = k % nx;
    cells.push(centre(i, (k - i) / nx));
  }
  cells.reverse();
  // Pull the path straight wherever there's a clear line of sight.
  const clear = (p: Pt, q: Pt) => {
    const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (cell / 2));
    for (let s = 1; s < n; s++) if (blocked[cellOf([p[0] + ((q[0] - p[0]) * s) / n, p[1] + ((q[1] - p[1]) * s) / n])]) return false;
    return true;
  };
  const pts: Pt[] = [a, ...cells, b];
  const out: Pt[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !clear(pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

export const pathLength = (p: Pt[]) => p.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);

export interface RouteResult {
  path: Pt[] | null;
  length: number;
  /** Audience areas the route passes through. */
  audience: string[];
}

/** A route's path, length and any audience areas it crosses. Cached per venue. */
const cache = new WeakMap<Venue, Map<string, RouteResult>>();
export function solveRoute(v: Venue, r: Pick<Route, 'from' | 'to'>): RouteResult {
  let m = cache.get(v);
  if (!m) cache.set(v, (m = new Map()));
  const key = `${r.from.kind}:${r.from.id}>${r.to.kind}:${r.to.id}`;
  const hit = m.get(key);
  if (hit) return hit;
  const a = endPoint(v, r.from);
  const b = endPoint(v, r.to);
  const path = a && b ? findPath(v, a, b) : null;
  const audience: string[] = [];
  if (path) {
    const areas = v.rooms.filter((room) => ROOM_TYPES[room.type]?.audience).map((room) => ({ room, poly: roomOutline(v.walls, room).polygon }));
    for (const { room, poly } of areas) {
      let hits = false;
      for (let s = 0; s < path.length - 1 && !hits; s++) {
        const [p, q] = [path[s], path[s + 1]];
        const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.25));
        for (let t = 0; t <= n; t++) if (pointIn([p[0] + ((q[0] - p[0]) * t) / n, p[1] + ((q[1] - p[1]) * t) / n], poly)) hits = true;
      }
      if (hits) audience.push(room.name);
    }
  }
  const res = { path, length: path ? pathLength(path) : 0, audience };
  m.set(key, res);
  return res;
}

/** "1 min 05 s" / "42 s". */
export function formatTime(seconds: number) {
  const s = Math.round(seconds);
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}
