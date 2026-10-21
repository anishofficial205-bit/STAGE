/**
 * Black Box block model: types, footprints, overlap tests, snapping, keeping
 * blocks inside the room, and the starting layouts.
 *
 * Blocks live on the floor plane. `rotation` is in degrees about the vertical
 * axis. A seating block's audience faces its local -Z ("front") edge.
 */
import { create } from 'zustand';
import type { Params } from '../../types';
import { num, str } from '../../helpers/params';

export const SEAT_WIDTH = 0.55;
export const ROW_DEPTH = 0.9;
export const PLATFORM_HEIGHTS = [0.2, 0.4, 0.6, 0.8];

export interface PlatformBlock {
  id: string;
  kind: 'platform';
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
}

export interface SeatingBlock {
  id: string;
  kind: 'seating';
  x: number;
  z: number;
  rotation: number;
  rows: number;
  seatsPerRow: number;
  rake: number;
}

export type Block = PlatformBlock | SeatingBlock;
export interface BlackBoxData {
  blocks: Block[];
}

export interface Room {
  halfW: number;
  halfL: number;
  height: number;
}

export const roomOf = (p: Params): Room => ({ halfW: num(p, 'roomWidth') / 2, halfL: num(p, 'roomLength') / 2, height: num(p, 'roomHeight') });

/** Which block is selected (UI state only — not saved with the project). */
export const useBlackBoxUI = create<{ selectedId: string | null; select: (id: string | null) => void }>((set) => ({
  selectedId: null,
  select: (selectedId) => set({ selectedId }),
}));

let counter = 0;
export const newId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

// --- Geometry -------------------------------------------------------------------

export function footprint(b: Block): { w: number; d: number } {
  return b.kind === 'platform' ? { w: b.width, d: b.depth } : { w: b.seatsPerRow * SEAT_WIDTH + 0.2, d: b.rows * ROW_DEPTH + 0.1 };
}

/** Local (x, z) → world, for a block at (bx, bz) rotated by `deg`. */
export function toWorld(bx: number, bz: number, deg: number, x: number, z: number): [number, number] {
  const t = (deg * Math.PI) / 180;
  return [bx + x * Math.cos(t) + z * Math.sin(t), bz - x * Math.sin(t) + z * Math.cos(t)];
}

function corners(b: Block): [number, number][] {
  const { w, d } = footprint(b);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => toWorld(b.x, b.z, b.rotation, x, z));
}

/** Half extents of the block's axis-aligned bounding box. */
export function halfExtents(b: Block): { ex: number; ez: number } {
  const c = corners(b);
  const xs = c.map((p) => p[0]);
  const zs = c.map((p) => p[1]);
  return { ex: (Math.max(...xs) - Math.min(...xs)) / 2, ez: (Math.max(...zs) - Math.min(...zs)) / 2 };
}

/** Separating-axis test on the two rotated rectangles. Touching edges don't count. */
export function overlaps(a: Block, b: Block): boolean {
  const ca = corners(a);
  const cb = corners(b);
  const axes: [number, number][] = [];
  for (const c of [ca, cb]) {
    for (let i = 0; i < 2; i++) {
      const dx = c[i + 1][0] - c[i][0];
      const dz = c[i + 1][1] - c[i][1];
      const l = Math.hypot(dx, dz);
      axes.push([dx / l, dz / l]);
    }
  }
  return axes.every(([ax, az]) => {
    const pa = ca.map((p) => p[0] * ax + p[1] * az);
    const pb = cb.map((p) => p[0] * ax + p[1] * az);
    return Math.min(...pa) < Math.max(...pb) - 0.02 && Math.min(...pb) < Math.max(...pa) - 0.02;
  });
}

export function overlappingIds(blocks: Block[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (overlaps(blocks[i], blocks[j])) {
        out.add(blocks[i].id);
        out.add(blocks[j].id);
      }
    }
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

/** Keep a block's whole footprint inside the room. */
export function clampToRoom<B extends Block>(b: B, room: Room): B {
  const { ex, ez } = halfExtents(b);
  return { ...b, x: clamp(b.x, -room.halfW + ex, room.halfW - ex), z: clamp(b.z, -room.halfL + ez, room.halfL - ez) };
}

const EDGE_SNAP = 0.3; // metres: how close an edge must be to snap to another block

/**
 * Snap a block (at a requested position) to the floor grid, or — when an edge
 * is close to another block's edge — to that edge instead. Then keep it in the room.
 */
export function snapAndClamp<B extends Block>(b: B, others: Block[], room: Room, grid: number): B {
  const { ex, ez } = halfExtents(b);
  const snapAxis = (pos: number, half: number, edges: number[]) => {
    let best: number | null = null;
    for (const e of edges) {
      for (const cand of [e - half, e + half]) {
        if (Math.abs(cand - pos) < EDGE_SNAP && (best === null || Math.abs(cand - pos) < Math.abs(best - pos))) best = cand;
      }
    }
    // Grid snapping aligns the block's edge (not its centre) with the grid lines.
    return best ?? Math.round((pos - half) / grid) * grid + half;
  };
  const xEdges: number[] = [];
  const zEdges: number[] = [];
  for (const o of others) {
    const h = halfExtents(o);
    xEdges.push(o.x - h.ex, o.x + h.ex);
    zEdges.push(o.z - h.ez, o.z + h.ez);
  }
  xEdges.push(-room.halfW, room.halfW);
  zEdges.push(-room.halfL, room.halfL);
  return clampToRoom({ ...b, x: snapAxis(b.x, ex, xEdges), z: snapAxis(b.z, ez, zEdges) }, room);
}

/** Nearest free spot (spiralling out on the grid) where a block doesn't overlap anything. */
export function findFreeSpot<B extends Block>(b: B, others: Block[], room: Room, grid: number): B {
  for (let ring = 0; ring < 40; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (const [dx, dz] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
        const c = snapAndClamp({ ...b, x: b.x + dx * grid, z: b.z + dz * grid }, others, room, grid);
        if (!others.some((o) => overlaps(o, c))) return c;
      }
    }
  }
  return clampToRoom(b, room);
}

// --- Starting layouts ------------------------------------------------------------

const platform = (x: number, z: number, height = 0.4, width = 2.4, depth = 1.2): PlatformBlock => ({ id: newId(), kind: 'platform', x, z, rotation: 0, width, depth, height });
const seats = (x: number, z: number, rotation: number, rows: number, seatsPerRow: number, rake = 0.25): SeatingBlock => ({ id: newId(), kind: 'seating', x, z, rotation, rows, seatsPerRow, rake });

/** A grid of 2.4 × 1.2 m decks centred on (cx, cz). */
function deck(cx: number, cz: number, cols: number, rows: number, height = 0.4): PlatformBlock[] {
  const out: PlatformBlock[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) out.push(platform(cx + (c - (cols - 1) / 2) * 2.4, cz + (r - (rows - 1) / 2) * 1.2, height));
  return out;
}
const seatDepth = (rows: number) => rows * ROW_DEPTH + 0.1;
const seatWidth = (n: number) => n * SEAT_WIDTH + 0.2;

export function makeLayout(kind: string, room: Room): Block[] {
  const W = room.halfW * 2;
  const L = room.halfL * 2;
  const back = -room.halfL;
  let blocks: Block[] = [];
  switch (kind) {
    case 'end-on': {
      const cols = Math.max(1, Math.min(5, Math.floor((W * 0.55) / 2.4)));
      const front = back + 0.5 + 4.8;
      const rows = Math.max(2, Math.min(10, Math.floor((L - 4.8 - 0.5 - 1.5 - 1) / ROW_DEPTH)));
      const d = seatDepth(rows);
      blocks = deck(0, back + 0.5 + 2.4, cols, 4);
      const pair = W >= 2 * seatWidth(10) + 2;
      const zc = front + 1.5 + d / 2;
      blocks.push(...(pair ? [seats(-(seatWidth(10) / 2 + 0.6), zc, 0, rows, 10), seats(seatWidth(10) / 2 + 0.6, zc, 0, rows, 10)] : [seats(0, zc, 0, rows, 10)]));
      break;
    }
    case 'thrust': {
      blocks = [...deck(0, back + 0.5 + 1.2, 3, 2), ...deck(0, back + 2.9 + 1.8, 2, 3)];
      const thrustFront = back + 2.9 + 3.6;
      const d = seatDepth(4);
      blocks.push(seats(0, thrustFront + 1 + d / 2, 0, 4, 10));
      // Side blocks sit beside the thrust, clear of the wider upstage deck.
      const sideZ = back + 2.9 + 2;
      const sideX = 2.4 + 1.4 + d / 2;
      blocks.push(seats(-sideX, sideZ, -90, 4, 7), seats(sideX, sideZ, 90, 4, 7));
      break;
    }
    case 'in-the-round': {
      blocks = deck(0, 0, 2, 4);
      const d = seatDepth(4);
      const r = 2.4 + 1 + d / 2;
      blocks.push(seats(0, r, 0, 4, 9), seats(0, -r, 180, 4, 9), seats(-r, 0, -90, 4, 9), seats(r, 0, 90, 4, 9));
      break;
    }
    case 'traverse': {
      const n = Math.max(2, Math.floor((L - 3) / 1.2));
      blocks = deck(0, 0, 1, n, 0.2);
      const d = seatDepth(4);
      const per = Math.max(1, Math.floor((L - 2) / (seatWidth(10) + 0.5)));
      for (let i = 0; i < per; i++) {
        const z = (i - (per - 1) / 2) * (seatWidth(10) + 0.5);
        blocks.push(seats(-(1.2 + 1 + d / 2), z, -90, 4, 10), seats(1.2 + 1 + d / 2, z, 90, 4, 10));
      }
      break;
    }
    case 'l-shape': {
      const cx = -room.halfW + 0.5 + 3.6;
      const cz = back + 0.5 + 2.4;
      blocks = deck(cx, cz, 3, 4);
      const d = seatDepth(5);
      blocks.push(seats(cx, cz + 2.4 + 1.2 + d / 2, 0, 5, 12), seats(cx + 3.6 + 1.2 + d / 2, cz, 90, 5, 8));
      break;
    }
  }
  return blocks.map((b) => clampToRoom(b, room));
}

// --- Validation of saved data ------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function sanitizeData(raw: unknown, p: Params): BlackBoxData {
  const room = roomOf(p);
  const list = raw && typeof raw === 'object' && Array.isArray((raw as BlackBoxData).blocks) ? (raw as BlackBoxData).blocks : null;
  if (!list) return { blocks: makeLayout(str(p, 'layout'), room) };
  const blocks: Block[] = [];
  for (const b of list as Partial<Block>[]) {
    if (!b || !isNum(b.x) || !isNum(b.z)) continue;
    const base = { id: typeof b.id === 'string' ? b.id : newId(), x: b.x, z: b.z, rotation: isNum(b.rotation) ? b.rotation : 0 };
    if (b.kind === 'platform') {
      const q = b as Partial<PlatformBlock>;
      blocks.push({ ...base, kind: 'platform', width: isNum(q.width) ? q.width : 1.2, depth: isNum(q.depth) ? q.depth : 2.4, height: isNum(q.height) ? q.height : 0.4 });
    } else if (b.kind === 'seating') {
      const q = b as Partial<SeatingBlock>;
      blocks.push({ ...base, kind: 'seating', rows: isNum(q.rows) ? q.rows : 4, seatsPerRow: isNum(q.seatsPerRow) ? q.seatsPerRow : 8, rake: isNum(q.rake) ? q.rake : 0.25 });
    }
  }
  return { blocks: blocks.map((b) => clampToRoom(b, room)) };
}
