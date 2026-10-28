/**
 * Stage lighting: fixtures (the lights), the positions they hang from, saved
 * looks and groups. Each stage type keeps its own lighting, in world
 * coordinates (metres, Y up, audience towards +z).
 */
export type Vec3 = [number, number, number];

export type FixtureType = 'profile' | 'fresnel' | 'par' | 'follow' | 'cyc' | 'moving' | 'uplight' | 'practical' | 'house';

export interface FixtureSpec {
  label: string;
  /** Beam angle range and default (degrees). */
  beam: [number, number, number];
  /** Edge softness default (0 hard – 1 very soft). */
  soft: number;
  /** Where it normally goes. */
  mount: 'rig' | 'floor' | 'audience';
  /** Has no beam (a lamp that glows all round). */
  point?: boolean;
  help: string;
}

export const FIXTURES: Record<FixtureType, FixtureSpec> = {
  profile: { label: 'Profile / spot', beam: [15, 50, 26], soft: 0.08, mount: 'rig', help: 'Hard-edged beam; takes gobos.' },
  fresnel: { label: 'Fresnel', beam: [10, 60, 30], soft: 0.65, mount: 'rig', help: 'Soft-edged pool of light.' },
  par: { label: 'PAR / wash', beam: [20, 60, 40], soft: 0.4, mount: 'rig', help: 'Broad flood.' },
  follow: { label: 'Follow spot', beam: [5, 30, 10], soft: 0.12, mount: 'audience', help: 'A profile at the back of the audience, operated by hand.' },
  cyc: { label: 'Cyc light / LED bar', beam: [60, 120, 100], soft: 0.85, mount: 'rig', help: 'Wide wash for the cyc or backdrop, from above or below.' },
  moving: { label: 'Moving head', beam: [8, 45, 18], soft: 0.15, mount: 'rig', help: 'A profile you can pan and tilt.' },
  uplight: { label: 'Uplight / floor light', beam: [30, 70, 45], soft: 0.5, mount: 'floor', help: 'Small floor fixture aimed upward.' },
  practical: { label: 'Practical lamp', beam: [0, 0, 0], soft: 1, mount: 'floor', point: true, help: 'A lamp that is part of the set.' },
  house: { label: 'House lights', beam: [60, 120, 110], soft: 1, mount: 'audience', help: 'Soft light over the audience, controlled as one.' },
};

export interface Fixture {
  id: string;
  type: FixtureType;
  name: string;
  channel: number;
  pos: Vec3;
  /** What it hangs from: a hanging position id, 'rig' (stage rigging / truss), 'floor', or null. */
  mount: string | null;
  /** Where it points. */
  target: Vec3;
  beam: number;
  soft: number;
  /** 0–100. */
  intensity: number;
  on: boolean;
  color: string;
  /** Gel name when the colour came from a gel preset. */
  gel?: string;
  /** Colour temperature when set from the white slider. */
  kelvin?: number;
  /** Gobo pattern id (profiles). */
  gobo?: string;
  castShadow: boolean;
  /** Hidden from the layers list: not drawn and gives no light. */
  hidden?: boolean;
  /** Can't be dragged in the view. */
  locked?: boolean;
  /** What it's for, on the hookup list (e.g. "DSL special"). */
  purpose?: string;
  /** Performer it follows: its aim moves with them as the scene plays. */
  follow?: string;
  /** Imported fixture this light stands in for (its real make and model). */
  standIn?: string;
}

/** A pipe or pole lights hang from. Electrics and FOH run along X; booms stand upright. */
export interface HangPosition {
  id: string;
  kind: 'electric' | 'foh' | 'boom';
  name: string;
  /** Centre (electric/FOH) or foot (boom), world. */
  x: number;
  y: number;
  z: number;
  /** Length along X (electric/FOH) or height (boom). */
  length: number;
}

/** The parts of a fixture a look remembers. */
export type FixtureState = Pick<Fixture, 'on' | 'intensity' | 'color' | 'gel' | 'kelvin' | 'target' | 'gobo'>;

export interface Haze {
  on: boolean;
  /** 0–100. */
  density: number;
}

export interface Look {
  id: string;
  name: string;
  states: Record<string, FixtureState>;
  haze: Haze;
}

export interface LightGroup {
  id: string;
  name: string;
  ids: string[];
}

export interface Lighting {
  fixtures: Fixture[];
  positions: HangPosition[];
  looks: Look[];
  groups: LightGroup[];
  haze: Haze;
  /** Uploaded gobo images (stored in IndexedDB as gobo-<id>). */
  gobos: { id: string; name: string }[];
  /** Title block of the light plot. */
  plot: { venue: string; designer: string };
  /** False until default positions have been made for this stage. */
  ready: boolean;
}

export const emptyLighting = (): Lighting => ({ fixtures: [], positions: [], looks: [], groups: [], haze: { on: false, density: 40 }, gobos: [], plot: { venue: '', designer: '' }, ready: false });

let counter = 0;
export const lightId = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

export const GELS: { name: string; color: string }[] = [
  { name: 'Open White', color: '#ffffff' },
  { name: 'Warm White (3200K)', color: kelvinToHex(3200) },
  { name: 'Cool White (5600K)', color: kelvinToHex(5600) },
  { name: 'Bastard Amber', color: '#fbc493' },
  { name: 'Straw', color: '#f8e3a1' },
  { name: 'Light Pink', color: '#f6c3d3' },
  { name: 'Surprise Pink', color: '#c6a4e6' },
  { name: 'Lavender', color: '#b6a0e2' },
  { name: 'Steel Blue', color: '#a8c6e6' },
  { name: 'Congo Blue', color: '#2b1680' },
  { name: 'Primary Red', color: '#e3202a' },
  { name: 'Primary Green', color: '#22a845' },
];

/** Approximate RGB of a black body at `k` kelvin (Tanner Helland's fit). */
export function kelvinToHex(k: number): string {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);

export function sanitizeLighting(raw: unknown): Lighting {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Lighting>;
  const fixtures: Fixture[] = [];
  for (const f of Array.isArray(r.fixtures) ? r.fixtures : []) {
    if (!f || !(f.type in FIXTURES) || !isVec(f.pos)) continue;
    const spec = FIXTURES[f.type];
    fixtures.push({
      id: typeof f.id === 'string' ? f.id : lightId('l'),
      type: f.type,
      name: typeof f.name === 'string' ? f.name : spec.label,
      channel: isNum(f.channel) ? Math.max(1, Math.round(f.channel)) : fixtures.length + 1,
      pos: [...f.pos] as Vec3,
      mount: typeof f.mount === 'string' ? f.mount : null,
      target: isVec(f.target) ? ([...f.target] as Vec3) : [f.pos[0], 0, f.pos[2]],
      beam: isNum(f.beam) ? Math.min(spec.beam[1] || 120, Math.max(spec.beam[0], f.beam)) : spec.beam[2],
      soft: isNum(f.soft) ? Math.min(1, Math.max(0, f.soft)) : spec.soft,
      intensity: isNum(f.intensity) ? Math.min(100, Math.max(0, f.intensity)) : 80,
      on: f.on !== false,
      color: hex(f.color, '#ffffff'),
      ...(typeof f.gel === 'string' ? { gel: f.gel } : {}),
      ...(isNum(f.kelvin) ? { kelvin: f.kelvin } : {}),
      ...(typeof f.gobo === 'string' ? { gobo: f.gobo } : {}),
      castShadow: !!f.castShadow,
      ...(typeof f.purpose === 'string' ? { purpose: f.purpose } : {}),
      ...(typeof f.follow === 'string' ? { follow: f.follow } : {}),
      ...(typeof f.standIn === 'string' ? { standIn: f.standIn } : {}),
    });
  }
  const positions: HangPosition[] = [];
  for (const p of Array.isArray(r.positions) ? r.positions : []) {
    if (!p || !['electric', 'foh', 'boom'].includes(p.kind) || !isNum(p.x) || !isNum(p.y) || !isNum(p.z)) continue;
    positions.push({ id: typeof p.id === 'string' ? p.id : lightId('h'), kind: p.kind, name: typeof p.name === 'string' ? p.name : 'Position', x: p.x, y: p.y, z: p.z, length: isNum(p.length) ? Math.max(0.5, p.length) : 8 });
  }
  const ids = new Set(fixtures.map((f) => f.id));
  const state = (s: Partial<FixtureState>): FixtureState => ({ on: s.on !== false, intensity: isNum(s.intensity) ? s.intensity : 80, color: hex(s.color, '#ffffff'), ...(typeof s.gel === 'string' ? { gel: s.gel } : {}), ...(isNum(s.kelvin) ? { kelvin: s.kelvin } : {}), target: isVec(s.target) ? s.target : [0, 0, 0], ...(typeof s.gobo === 'string' ? { gobo: s.gobo } : {}) });
  const haze = (h: unknown): Haze => ({ on: !!(h as Haze)?.on, density: isNum((h as Haze)?.density) ? Math.min(100, Math.max(0, (h as Haze).density)) : 40 });
  const looks: Look[] = (Array.isArray(r.looks) ? r.looks : [])
    .filter((l) => l && typeof l.name === 'string' && l.states && typeof l.states === 'object')
    .map((l) => ({ id: typeof l.id === 'string' ? l.id : lightId('k'), name: l.name, haze: haze(l.haze), states: Object.fromEntries(Object.entries(l.states).filter(([id]) => ids.has(id)).map(([id, s]) => [id, state(s as Partial<FixtureState>)])) }));
  const groups: LightGroup[] = (Array.isArray(r.groups) ? r.groups : [])
    .filter((g) => g && typeof g.name === 'string' && Array.isArray(g.ids))
    .map((g) => ({ id: typeof g.id === 'string' ? g.id : lightId('g'), name: g.name, ids: g.ids.filter((id) => ids.has(id)) }));
  const gobos = (Array.isArray(r.gobos) ? r.gobos : []).filter((g) => g && typeof g.id === 'string').map((g) => ({ id: g.id, name: typeof g.name === 'string' ? g.name : 'Gobo' }));
  const plot = r.plot && typeof r.plot === 'object' ? r.plot : { venue: '', designer: '' };
  return { fixtures, positions, looks, groups, haze: haze(r.haze), gobos, plot: { venue: typeof plot.venue === 'string' ? plot.venue : '', designer: typeof plot.designer === 'string' ? plot.designer : '' }, ready: !!r.ready };
}
