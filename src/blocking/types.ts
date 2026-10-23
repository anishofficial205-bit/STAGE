/**
 * Blocking: performers, the entrances they use, spike marks, and scenes made
 * of starting positions plus timed paths. Each stage type keeps its own, in
 * world coordinates (metres; x across, z towards the audience). Facing is in
 * degrees: 0 faces +z (the audience on an end-on stage), 90 faces +x (stage left).
 */
export type Pt = [number, number];

export type Posture = 'standing' | 'sitting' | 'lying';

export interface Performer {
  id: string;
  name: string;
  color: string;
  /** Metres. */
  height: number;
  posture: Posture;
  hidden?: boolean;
  /** Can't be dragged in the view. */
  locked?: boolean;
}

export interface CastGroup {
  id: string;
  name: string;
  ids: string[];
}

/** An entrance the user placed (auto ones come from the stage, masking and venue). */
export interface CustomEntrance {
  id: string;
  name: string;
  x: number;
  z: number;
  facing: number;
}

export interface SpikeMark {
  id: string;
  performerId: string;
  x: number;
  z: number;
}

export type Speed = 'slow' | 'normal' | 'fast' | 'run';
export const SPEEDS: Record<Speed, { label: string; mps: number }> = {
  slow: { label: 'Slow (0.6 m/s)', mps: 0.6 },
  normal: { label: 'Normal (1.2 m/s)', mps: 1.2 },
  fast: { label: 'Fast (2 m/s)', mps: 2 },
  run: { label: 'Run (3.5 m/s)', mps: 3.5 },
};

/**
 * A move. It starts wherever the performer is at `start`; `points` are the
 * places it goes through after that. Ending at an entrance (`exit`) takes the
 * performer off stage.
 */
export interface Path {
  id: string;
  performerId: string;
  points: Pt[];
  exit?: string;
  /** Seconds into the scene. */
  start: number;
  timing: 'speed' | 'duration';
  speed: Speed;
  /** Seconds, holds included (when timing is 'duration'). */
  duration: number;
  /** Pauses at points (index into `points`). */
  stops: { index: number; hold: number }[];
}

export interface StartState {
  x: number;
  z: number;
  facing: number;
  onStage: boolean;
  /** Where an off-stage performer waits. */
  entrance?: string;
}

export interface Scene {
  id: string;
  name: string;
  notes: string;
  start: Record<string, StartState>;
  paths: Path[];
}

export interface Blocking {
  performers: Performer[];
  groups: CastGroup[];
  entrances: CustomEntrance[];
  /** Renamed auto entrances, by their key. */
  entranceNames: Record<string, string>;
  marks: SpikeMark[];
  scenes: Scene[];
  sceneId: string;
  checks: { hiddenShare: number; upstaged: boolean };
}

let counter = 0;
export const blockId = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

export function emptyBlocking(): Blocking {
  const scene: Scene = { id: blockId('s'), name: 'Act 1, Scene 1', notes: '', start: {}, paths: [] };
  return { performers: [], groups: [], entrances: [], entranceNames: {}, marks: [], scenes: [scene], sceneId: scene.id, checks: { hiddenShare: 20, upstaged: false } };
}

export const PERFORMER_COLORS = ['#e4572e', '#2e86ab', '#76b041', '#f2a541', '#8f5aa8', '#e84a8a', '#17a398', '#c0392b', '#3d5a80', '#b5838d'];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('')
    .slice(0, 3) || '?';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);

export function sanitizeBlocking(raw: unknown): Blocking {
  const base = emptyBlocking();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Blocking>;
  const performers: Performer[] = (Array.isArray(r.performers) ? r.performers : [])
    .filter((p) => p && typeof p.id === 'string')
    .map((p, i) => ({
      id: p.id,
      name: str(p.name, `Performer ${i + 1}`),
      color: typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : PERFORMER_COLORS[i % PERFORMER_COLORS.length],
      height: isNum(p.height) ? Math.min(2.3, Math.max(0.8, p.height)) : 1.7,
      posture: p.posture === 'sitting' || p.posture === 'lying' ? p.posture : 'standing',
      ...(p.hidden ? { hidden: true } : {}),
    }));
  const ids = new Set(performers.map((p) => p.id));
  const scenes: Scene[] = (Array.isArray(r.scenes) ? r.scenes : [])
    .filter((s) => s && typeof s.id === 'string')
    .map((s, i) => ({
      id: s.id,
      name: str(s.name, `Scene ${i + 1}`),
      notes: str(s.notes, ''),
      start: Object.fromEntries(
        Object.entries(s.start && typeof s.start === 'object' ? s.start : {})
          .filter(([id, v]) => ids.has(id) && v && isNum(v.x) && isNum(v.z))
          .map(([id, v]) => [id, { x: v.x, z: v.z, facing: isNum(v.facing) ? v.facing : 0, onStage: v.onStage !== false, ...(typeof v.entrance === 'string' ? { entrance: v.entrance } : {}) }]),
      ),
      paths: (Array.isArray(s.paths) ? s.paths : [])
        .filter((p) => p && ids.has(p.performerId) && Array.isArray(p.points))
        .map((p) => ({
          id: str(p.id, blockId('p')),
          performerId: p.performerId,
          points: p.points.filter(isPt).map((q) => [q[0], q[1]] as Pt),
          ...(typeof p.exit === 'string' ? { exit: p.exit } : {}),
          start: isNum(p.start) ? Math.max(0, p.start) : 0,
          timing: (p.timing === 'duration' ? 'duration' : 'speed') as Path['timing'],
          speed: p.speed && p.speed in SPEEDS ? p.speed : 'normal',
          duration: isNum(p.duration) ? Math.max(0.2, p.duration) : 4,
          stops: (Array.isArray(p.stops) ? p.stops : []).filter((x) => x && isNum(x.index) && isNum(x.hold)).map((x) => ({ index: Math.round(x.index), hold: Math.max(0, x.hold) })),
        }))
        .filter((p) => p.points.length > 0 || p.exit),
    }));
  if (!scenes.length) scenes.push(base.scenes[0]);
  return {
    performers,
    groups: (Array.isArray(r.groups) ? r.groups : []).filter((g) => g && typeof g.name === 'string' && Array.isArray(g.ids)).map((g) => ({ id: str(g.id, blockId('g')), name: g.name, ids: g.ids.filter((id) => ids.has(id)) })),
    entrances: (Array.isArray(r.entrances) ? r.entrances : []).filter((e) => e && isNum(e.x) && isNum(e.z)).map((e) => ({ id: str(e.id, blockId('e')), name: str(e.name, 'Entrance'), x: e.x, z: e.z, facing: isNum(e.facing) ? e.facing : 0 })),
    entranceNames: Object.fromEntries(Object.entries(r.entranceNames && typeof r.entranceNames === 'object' ? r.entranceNames : {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    marks: (Array.isArray(r.marks) ? r.marks : []).filter((m) => m && ids.has(m.performerId) && isNum(m.x) && isNum(m.z)).map((m) => ({ id: str(m.id, blockId('m')), performerId: m.performerId, x: m.x, z: m.z })),
    scenes,
    sceneId: scenes.some((s) => s.id === r.sceneId) ? (r.sceneId as string) : scenes[0].id,
    checks: { hiddenShare: isNum(r.checks?.hiddenShare) ? r.checks!.hiddenShare : 20, upstaged: !!r.checks?.upstaged },
  };
}
