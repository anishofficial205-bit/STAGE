/**
 * The venue around the stage: walls drawn on a floor plan (and, later, rooms,
 * doors, furniture, a traced plan and walking routes). Positions are world
 * x, z in metres, the same frame as the stage templates (audience towards +z).
 */
export type Pt = [number, number];

export interface Wall {
  id: string;
  a: Pt;
  b: Pt;
  thickness: number;
  height: number;
  material: string;
}

export interface Room {
  id: string;
  name: string;
  type: string;
  /** A point inside the room; its outline is found from the walls around it. */
  seed: Pt;
  /** Last known outline (used if the walls no longer close the room). */
  polygon: Pt[];
  floor: string;
  wallHeight: number;
}

export interface Door {
  id: string;
  wallId: string;
  /** Centre of the door, measured along the wall from its start (m). */
  s: number;
  width: number;
  height: number;
  kind: 'single' | 'double' | 'opening';
  /** Which end of the opening the hinge is at (towards the wall's start or end). */
  hinge: 'a' | 'b';
  /** Which side of the wall it swings to (left or right of the wall's direction). */
  side: 1 | -1;
  /** Set when this door leads onto the stage: its name, e.g. "SL entrance" (used by Blocking). */
  entrance?: string;
}

export interface Furniture {
  id: string;
  type: string;
  x: number;
  z: number;
  /** Degrees about the vertical axis. */
  rotation: number;
}

export interface Venue {
  walls: Wall[];
  rooms: Room[];
  doors: Door[];
  furniture: Furniture[];
}

export interface RoomType {
  label: string;
  color: string;
  /** Somewhere the audience is during a show (routes through it get flagged). */
  audience?: boolean;
}

export const ROOM_TYPES: Record<string, RoomType> = {
  'green-room': { label: 'Green room', color: '#8fd19e' },
  dressing: { label: 'Dressing room', color: '#f6c177' },
  'wings-sl': { label: 'Wings (stage left)', color: '#c9b6e4' },
  'wings-sr': { label: 'Wings (stage right)', color: '#c9b6e4' },
  crossover: { label: 'Crossover', color: '#b4c7e7' },
  booth: { label: 'Control booth', color: '#f28b82' },
  dock: { label: 'Loading dock', color: '#c4c4c4' },
  lobby: { label: 'Lobby / foyer', color: '#fbe29b', audience: true },
  'box-office': { label: 'Box office', color: '#ffd1a6', audience: true },
  toilets: { label: 'Toilets', color: '#a7d8de' },
  storage: { label: 'Storage / scene dock', color: '#d7ccc8' },
  rehearsal: { label: 'Rehearsal room', color: '#c5e1a5' },
  corridor: { label: 'Corridor', color: '#e3e3e3' },
  custom: { label: 'Custom', color: '#cfd8dc' },
};

export const FLOOR_MATERIALS: Record<string, { label: string; color: string }> = {
  vinyl: { label: 'Vinyl', color: '#c9ccd1' },
  carpet: { label: 'Carpet', color: '#7a6f8f' },
  wood: { label: 'Wood', color: '#b88d5f' },
  concrete: { label: 'Concrete', color: '#a8a7a2' },
  tile: { label: 'Tiles', color: '#dfe3e6' },
};

export const DOOR_PRESETS = {
  single: { label: 'Single door', width: 0.9, height: 2.1, kind: 'single' },
  double: { label: 'Double door', width: 1.6, height: 2.1, kind: 'double' },
  opening: { label: 'Opening (no door)', width: 1.2, height: 2.4, kind: 'opening' },
  loading: { label: 'Loading door', width: 3, height: 3.5, kind: 'double' },
} as const;

export const ENTRANCE_NAMES = ['SL entrance', 'SR entrance', 'Upstage door', 'House left door', 'House right door', 'Pit door'];

export const WALL_MATERIALS: Record<string, { label: string; color: string; plan: string }> = {
  plaster: { label: 'Plaster (white)', color: '#e9e7e2', plan: '#3d4249' },
  black: { label: 'Painted black', color: '#2b2c30', plan: '#1d1f23' },
  brick: { label: 'Brick', color: '#a65e43', plan: '#6e3b29' },
  concrete: { label: 'Concrete', color: '#a7a6a1', plan: '#55575c' },
  wood: { label: 'Wood panelling', color: '#a57d52', plan: '#6a4d2f' },
  glass: { label: 'Glass', color: '#cfe3ee', plan: '#6f93a8' },
};

export const WALL_DEFAULTS = { thickness: 0.2, height: 4, material: 'plaster' };

export const emptyVenue = (): Venue => ({ walls: [], rooms: [], doors: [], furniture: [] });

let counter = 0;
export const venueId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);

export function sanitizeVenue(raw: unknown): Venue {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Venue>;
  const walls: Wall[] = [];
  for (const w of Array.isArray(r.walls) ? r.walls : []) {
    if (!w || !isPt(w.a) || !isPt(w.b) || Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) < 0.01) continue;
    walls.push({
      id: typeof w.id === 'string' ? w.id : venueId('w'),
      a: [w.a[0], w.a[1]],
      b: [w.b[0], w.b[1]],
      thickness: isNum(w.thickness) ? Math.min(2, Math.max(0.05, w.thickness)) : WALL_DEFAULTS.thickness,
      height: isNum(w.height) ? Math.min(30, Math.max(0.5, w.height)) : WALL_DEFAULTS.height,
      material: typeof w.material === 'string' && w.material in WALL_MATERIALS ? w.material : WALL_DEFAULTS.material,
    });
  }
  const wallIds = new Set(walls.map((w) => w.id));
  const rooms: Room[] = [];
  for (const o of Array.isArray(r.rooms) ? r.rooms : []) {
    if (!o || !isPt(o.seed)) continue;
    const type = typeof o.type === 'string' && o.type in ROOM_TYPES ? o.type : 'custom';
    rooms.push({
      id: typeof o.id === 'string' ? o.id : venueId('r'),
      name: typeof o.name === 'string' ? o.name : ROOM_TYPES[type].label,
      type,
      seed: [o.seed[0], o.seed[1]],
      polygon: Array.isArray(o.polygon) ? o.polygon.filter(isPt).map((p) => [p[0], p[1]] as Pt) : [],
      floor: typeof o.floor === 'string' && o.floor in FLOOR_MATERIALS ? o.floor : 'vinyl',
      wallHeight: isNum(o.wallHeight) ? Math.min(30, Math.max(0.5, o.wallHeight)) : WALL_DEFAULTS.height,
    });
  }
  const doors: Door[] = [];
  for (const d of Array.isArray(r.doors) ? r.doors : []) {
    if (!d || typeof d.wallId !== 'string' || !wallIds.has(d.wallId) || !isNum(d.s)) continue;
    doors.push({
      id: typeof d.id === 'string' ? d.id : venueId('d'),
      wallId: d.wallId,
      s: d.s,
      width: isNum(d.width) ? Math.min(10, Math.max(0.4, d.width)) : 0.9,
      height: isNum(d.height) ? Math.min(10, Math.max(1, d.height)) : 2.1,
      kind: d.kind === 'double' || d.kind === 'opening' ? d.kind : 'single',
      hinge: d.hinge === 'b' ? 'b' : 'a',
      side: d.side === -1 ? -1 : 1,
      ...(typeof d.entrance === 'string' && d.entrance.trim() ? { entrance: d.entrance.trim() } : {}),
    });
  }
  const furniture: Furniture[] = [];
  for (const f of Array.isArray(r.furniture) ? r.furniture : []) {
    if (!f || typeof f.type !== 'string' || !isNum(f.x) || !isNum(f.z)) continue;
    furniture.push({ id: typeof f.id === 'string' ? f.id : venueId('f'), type: f.type, x: f.x, z: f.z, rotation: isNum(f.rotation) ? f.rotation : 0 });
  }
  return { walls, rooms, doors, furniture };
}
