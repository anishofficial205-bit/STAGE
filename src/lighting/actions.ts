/**
 * Lighting edits (undoable through the project store; drags and slider moves
 * merge into one step).
 */
import { useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { defaultPositions, HANG_DROP, positionLine, stageCentre } from './hang';
import { FIXTURES, emptyLighting, lightId, type Fixture, type FixtureType, type HangPosition, type Lighting, type Vec3 } from './types';
import { useLightsUI } from './ui';

const lighting = () => {
  const s = useProjectStore.getState();
  return s.lightingByTemplate[s.templateId] ?? emptyLighting();
};
const update = (fn: (l: Lighting) => Lighting, key?: string) => useProjectStore.getState().setLighting(fn, key);

/** Number of fixtures that cast real shadows by default (the first few added). */
const DEFAULT_SHADOWS = 4;

/** Where a new fixture of this type goes when it's just clicked in the library. */
function defaultSpot(type: FixtureType, l: Lighting): { pos: Vec3; mount: string | null; target: Vec3 } {
  const c = stageCentre();
  const spec = FIXTURES[type];
  if (type === 'house' || type === 'follow') {
    const s = useProjectStore.getState();
    const seats = getTemplate(s.templateId)?.seats?.(s.paramsByTemplate[s.templateId], s.dataByTemplate[s.templateId]) ?? [];
    if (seats.length) {
      const xs = seats.map((p) => p.x);
      const zs = seats.map((p) => p.z);
      const top = Math.max(...seats.map((p) => p.y));
      if (type === 'house') {
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
        return { pos: [cx, top + 7, cz], mount: null, target: [cx, top, cz] };
      }
      const back = seats.reduce((a, b) => (Math.hypot(b.x - c[0], b.z - c[2]) > Math.hypot(a.x - c[0], a.z - c[2]) ? b : a));
      return { pos: [back.x, back.y + 3, back.z + 1], mount: 'floor', target: [c[0], c[1] + 1, c[2]] };
    }
    return { pos: [c[0], c[1] + 8, c[2] + 10], mount: null, target: c };
  }
  if (spec.mount === 'floor') {
    const used = l.fixtures.filter((f) => f.type === type).length;
    const at: Vec3 = [c[0] + (used % 5) * 0.8 - 1.6, c[1] + 0.05, c[2] + 1];
    return { pos: at, mount: 'floor', target: type === 'uplight' ? [at[0], at[1] + 5, at[2] - 1] : [at[0], at[1], at[2]] };
  }
  // Rig lights: along the least busy electric, spaced 1 m apart, aimed at the stage.
  const electrics = l.positions.filter((p) => p.kind === 'electric');
  if (electrics.length) {
    const count = (p: HangPosition) => l.fixtures.filter((f) => f.mount === p.id).length;
    const p = electrics.reduce((a, b) => (count(b) < count(a) ? b : a));
    const k = count(p);
    const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1;
    const x = Math.max(p.x - p.length / 2 + 0.3, Math.min(p.x + p.length / 2 - 0.3, p.x + off));
    return { pos: [x, p.y - HANG_DROP, p.z], mount: p.id, target: type === 'cyc' ? [x, c[1], p.z - 3] : [x * 0.6 + c[0] * 0.4, c[1], c[2]] };
  }
  return { pos: [c[0], c[1] + 6, c[2] + 2], mount: null, target: c };
}

const nextChannel = (l: Lighting) => l.fixtures.reduce((m, f) => Math.max(m, f.channel), 0) + 1;

export const lightActions = {
  /** Give a stage its default hanging positions the first time Lights mode opens on it. */
  ensureReady: () => {
    if (lighting().ready) return;
    const positions = defaultPositions();
    useProjectStore.getState().setLighting((l) => ({ ...l, positions: l.positions.length ? l.positions : positions, ready: true }), undefined, false);
  },
  addFixture: (type: FixtureType, at?: { pos: Vec3; mount: string | null }) => {
    const l = lighting();
    const spec = FIXTURES[type];
    const spot = defaultSpot(type, l);
    const pos = at?.pos ?? spot.pos;
    const target: Vec3 = at ? (spec.mount === 'floor' && type === 'uplight' ? [pos[0], pos[1] + 5, pos[2] - 1] : type === 'practical' ? pos : spot.target) : spot.target;
    const f: Fixture = {
      id: lightId('l'),
      type,
      name: `${spec.label.split(' /')[0]} ${l.fixtures.filter((x) => x.type === type).length + 1}`,
      channel: nextChannel(l),
      pos,
      mount: at?.mount ?? spot.mount,
      target,
      beam: spec.beam[2],
      soft: spec.soft,
      intensity: type === 'house' ? 70 : 80,
      on: true,
      color: type === 'practical' ? '#ffd7a1' : '#ffffff',
      castShadow: !spec.point && type !== 'house' && type !== 'cyc' && l.fixtures.filter((x) => x.castShadow).length < DEFAULT_SHADOWS,
    };
    update((x) => ({ ...x, fixtures: [...x.fixtures, f] }));
    useLightsUI.getState().select({ kind: 'fixture', ids: [f.id] });
    return f;
  },
  /** Change several fixtures with the same patch (or a function of each). */
  patch: (ids: string[], change: Partial<Fixture> | ((f: Fixture) => Partial<Fixture>), key?: string) =>
    update((l) => ({ ...l, fixtures: l.fixtures.map((f) => (ids.includes(f.id) ? { ...f, ...(typeof change === 'function' ? change(f) : change) } : f)) }), key),
  move: (id: string, pos: Vec3, mount: string | null, key: string) => update((l) => ({ ...l, fixtures: l.fixtures.map((f) => (f.id === id ? { ...f, pos, mount } : f)) }), key),
  /** Aim lights at a point. */
  focus: (ids: string[], target: Vec3, key?: string) => update((l) => ({ ...l, fixtures: l.fixtures.map((f) => (ids.includes(f.id) ? { ...f, target } : f)) }), key ?? `focus:${ids.join()}`),
  remove: (ids: string[]) => {
    update((l) => ({ ...l, fixtures: l.fixtures.filter((f) => !ids.includes(f.id)), groups: l.groups.map((g) => ({ ...g, ids: g.ids.filter((id) => !ids.includes(id)) })), looks: l.looks.map((k) => ({ ...k, states: Object.fromEntries(Object.entries(k.states).filter(([id]) => !ids.includes(id))) })) }));
    useLightsUI.getState().select(null);
  },
  duplicate: (ids: string[]) => {
    const l = lighting();
    let ch = nextChannel(l);
    const copies = l.fixtures.filter((f) => ids.includes(f.id)).map((f) => ({ ...f, id: lightId('l'), channel: ch++, name: `${f.name} copy`, pos: [f.pos[0] + 0.6, f.pos[1], f.pos[2]] as Vec3, target: [f.target[0] + 0.6, f.target[1], f.target[2]] as Vec3 }));
    update((x) => ({ ...x, fixtures: [...x.fixtures, ...copies] }));
    useLightsUI.getState().select({ kind: 'fixture', ids: copies.map((c) => c.id) });
  },
  /** Number channels 1, 2, 3… in order: front of house first, then electrics from downstage. */
  renumber: () =>
    update((l) => {
      const order = [...l.fixtures].sort((a, b) => b.pos[2] - a.pos[2] || a.pos[0] - b.pos[0]);
      const ch = new Map(order.map((f, i) => [f.id, i + 1]));
      return { ...l, fixtures: l.fixtures.map((f) => ({ ...f, channel: ch.get(f.id)! })) };
    }),

  addPosition: (kind: HangPosition['kind']) => {
    const l = lighting();
    const c = stageCentre();
    const n = l.positions.filter((p) => p.kind === kind).length + 1;
    const ord = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
    const p: HangPosition =
      kind === 'boom'
        ? { id: lightId('h'), kind, name: `Boom ${n}`, x: c[0] + (n % 2 ? 1 : -1) * 6, y: c[1], z: c[2], length: 4 }
        : kind === 'foh'
          ? { id: lightId('h'), kind, name: `FOH ${n}`, x: c[0], y: c[1] + 7, z: c[2] + 9 + n * 2, length: 10 }
          : { id: lightId('h'), kind, name: `${ord[n - 1] ?? n + 'th'} Electric`, x: c[0], y: c[1] + 6.5, z: c[2] - 1 + n, length: 12 };
    update((x) => ({ ...x, positions: [...x.positions, p] }));
    useLightsUI.getState().select({ kind: 'position', ids: [p.id] });
  },
  /** Move or resize a position; lights on it move with it. */
  patchPosition: (id: string, change: Partial<HangPosition>, key?: string) =>
    update((l) => {
      const old = l.positions.find((p) => p.id === id);
      if (!old) return l;
      const next = { ...old, ...change };
      const [dx, dy, dz] = [next.x - old.x, next.y - old.y, next.z - old.z];
      const line = positionLine(next);
      const clampTo = (f: Fixture): Vec3 => {
        const p: Vec3 = [f.pos[0] + dx, f.pos[1] + dy, f.pos[2] + dz];
        if (next.kind === 'boom') return [p[0], Math.min(line.b[1], Math.max(line.a[1], p[1])), p[2]];
        return [Math.min(line.b[0], Math.max(line.a[0], p[0])), p[1], p[2]];
      };
      return { ...l, positions: l.positions.map((p) => (p.id === id ? next : p)), fixtures: l.fixtures.map((f) => (f.mount === id ? { ...f, pos: clampTo(f) } : f)) };
    }, key ?? `pos:${id}:${Object.keys(change).join()}`),
  removePosition: (id: string) => {
    update((l) => ({ ...l, positions: l.positions.filter((p) => p.id !== id), fixtures: l.fixtures.map((f) => (f.mount === id ? { ...f, mount: null } : f)) }));
    useLightsUI.getState().select(null);
  },
  setHaze: (change: Partial<Lighting['haze']>, key?: string) => update((l) => ({ ...l, haze: { ...l.haze, ...change } }), key ?? `haze:${Object.keys(change).join()}`),
};
