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

export interface Venue {
  walls: Wall[];
}

export const WALL_MATERIALS: Record<string, { label: string; color: string; plan: string }> = {
  plaster: { label: 'Plaster (white)', color: '#e9e7e2', plan: '#3d4249' },
  black: { label: 'Painted black', color: '#2b2c30', plan: '#1d1f23' },
  brick: { label: 'Brick', color: '#a65e43', plan: '#6e3b29' },
  concrete: { label: 'Concrete', color: '#a7a6a1', plan: '#55575c' },
  wood: { label: 'Wood panelling', color: '#a57d52', plan: '#6a4d2f' },
  glass: { label: 'Glass', color: '#cfe3ee', plan: '#6f93a8' },
};

export const WALL_DEFAULTS = { thickness: 0.2, height: 4, material: 'plaster' };

export const emptyVenue = (): Venue => ({ walls: [] });

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
  return { walls };
}
