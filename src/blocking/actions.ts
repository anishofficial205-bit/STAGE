/**
 * Blocking edits (undoable through the project store; drags merge into one step).
 */
import { useProjectStore } from '../store/useProjectStore';
import { currentStage } from '../objects/actions';
import { stageSnapLines } from '../helpers/stageInfo';
import { computeEntrances, type Entrance } from './entrances';
import { endStates, sceneTracks, poseAt } from './motion';
import { PERFORMER_COLORS, blockId, emptyBlocking, type Blocking, type Path, type Performer, type Pt, type Scene, type StartState } from './types';
import { useBlockingUI } from './ui';
import { nextName } from '../helpers/names';

export const blocking = () => {
  const s = useProjectStore.getState();
  return s.blockingByTemplate[s.templateId] ?? emptyBlocking();
};
const update = (fn: (b: Blocking) => Blocking, key?: string) => useProjectStore.getState().setBlocking(fn, key);
export const currentScene = (b = blocking()) => b.scenes.find((s) => s.id === b.sceneId) ?? b.scenes[0];
const patchScene = (fn: (s: Scene) => Scene, key?: string) => update((b) => ({ ...b, scenes: b.scenes.map((s) => (s.id === b.sceneId ? fn(s) : s)) }), key);

export function entranceMap(b = blocking()) {
  return new Map(computeEntrances(useProjectStore.getState(), b).map((e) => [e.id, e] as [string, Entrance]));
}

/** Centre of the acting area (new performers gather here). */
export function actingCentre(): Pt {
  const { info } = currentStage();
  const [x0, z0, x1, z1] = stageSnapLines(info).bounds;
  return info.opening ? [(x0 + x1) / 2, (info.opening.z + info.opening.backZ) / 2 + 1] : [(x0 + x1) / 2, (z0 + z1) / 2];
}

/** Where each performer is at time t in the current scene. */
export function posesAt(t: number, b = blocking()) {
  const ents = entranceMap(b);
  const tracks = sceneTracks(currentScene(b), b.performers, ents, actingCentre());
  return new Map([...tracks.entries()].map(([id, { start, tracks: ts }]) => [id, poseAt(start, ts, ents, t)]));
}

const snap = (v: number) => Math.round(v / 0.25) * 0.25;

export const blockingActions = {
  addPerformer: () => {
    const b = blocking();
    const n = b.performers.length;
    const c = actingCentre();
    const p: Performer = { id: blockId('a'), name: nextName('Performer', b.performers.map((x) => x.name)), color: PERFORMER_COLORS[n % PERFORMER_COLORS.length], height: 1.7, posture: 'standing' };
    const st: StartState = { x: snap(c[0] + ((n % 5) - 2) * 1.2), z: snap(c[1] + Math.floor(n / 5) * 1.2), facing: 0, onStage: true };
    update((x) => ({ ...x, performers: [...x.performers, p], scenes: x.scenes.map((s) => ({ ...s, start: { ...s.start, [p.id]: st } })) }));
    useBlockingUI.getState().select({ kind: 'performer', ids: [p.id] });
    return p;
  },
  patchPerformers: (ids: string[], change: Partial<Performer>, key?: string) => update((b) => ({ ...b, performers: b.performers.map((p) => (ids.includes(p.id) ? { ...p, ...change } : p)) }), key ?? `perf:${ids.join()}:${Object.keys(change).join()}`),
  removePerformers: (ids: string[]) => {
    update((b) => ({
      ...b,
      performers: b.performers.filter((p) => !ids.includes(p.id)),
      groups: b.groups.map((g) => ({ ...g, ids: g.ids.filter((id) => !ids.includes(id)) })),
      marks: b.marks.filter((m) => !ids.includes(m.performerId)),
      scenes: b.scenes.map((s) => ({ ...s, start: Object.fromEntries(Object.entries(s.start).filter(([id]) => !ids.includes(id))), paths: s.paths.filter((p) => !ids.includes(p.performerId)) })),
    }));
    useBlockingUI.getState().select(null);
  },
  /** Change where performers start this scene. */
  setStart: (ids: string[], change: (s: StartState, id: string) => Partial<StartState>, key?: string) => {
    const poses = posesAt(0);
    patchScene((s) => ({ ...s, start: { ...s.start, ...Object.fromEntries(ids.map((id) => { const cur = s.start[id] ?? (() => { const p = poses.get(id)!; return { x: p.x, z: p.z, facing: p.facing, onStage: p.onStage }; })(); return [id, { ...cur, ...change(cur, id) }]; })) } }), key);
  },
  /** Arrange performers in a formation round their middle, facing out front. */
  formation: (ids: string[], kind: 'line' | 'arc' | 'circle' | 'v' | 'cluster') => {
    const poses = posesAt(0);
    const on = ids.filter((id) => poses.get(id));
    if (!on.length) return;
    const cx = on.reduce((t, id) => t + poses.get(id)!.x, 0) / on.length;
    const cz = on.reduce((t, id) => t + poses.get(id)!.z, 0) / on.length;
    const n = on.length;
    const spots: Pt[] = on.map((_, i) => {
      const u = n > 1 ? i / (n - 1) : 0.5;
      if (kind === 'line') return [cx + (i - (n - 1) / 2) * 1.1, cz];
      if (kind === 'arc') {
        const r = Math.max(2, n * 0.45);
        const a = ((u - 0.5) * 2 * Math.PI) / 3;
        return [cx + r * Math.sin(a), cz - r * Math.cos(a) + r * 0.6];
      }
      if (kind === 'circle') {
        const r = Math.max(1.2, (n * 1) / (2 * Math.PI));
        const a = (i / n) * 2 * Math.PI;
        return [cx + r * Math.sin(a), cz + r * Math.cos(a)];
      }
      if (kind === 'v') {
        const k = i - (n - 1) / 2;
        return [cx + k * 0.9, cz + 1.5 - Math.abs(k) * 0.9];
      }
      // Cluster: rings of a hex packing.
      const ring = i === 0 ? 0 : Math.ceil((-3 + Math.sqrt(9 + 12 * i)) / 6);
      const before = ring === 0 ? 0 : 1 + 3 * ring * (ring - 1);
      const a = ((i - before) / Math.max(1, 6 * ring)) * 2 * Math.PI;
      return [cx + ring * 0.85 * Math.sin(a), cz + ring * 0.85 * Math.cos(a)];
    });
    patchScene((s) => ({ ...s, start: { ...s.start, ...Object.fromEntries(on.map((id, i) => [id, { ...(s.start[id] ?? { facing: 0 }), x: snap(spots[i][0]), z: snap(spots[i][1]), facing: 0, onStage: true }])) } }));
  },

  createGroup: (name: string, ids: string[]) => update((b) => ({ ...b, groups: [...b.groups, { id: blockId('g'), name: name.trim() || nextName('Group', b.groups.map((g) => g.name)), ids }] })),
  removeGroup: (id: string) => update((b) => ({ ...b, groups: b.groups.filter((g) => g.id !== id) })),

  addEntrance: (at: Pt) => {
    const c = actingCentre();
    const facing = (Math.atan2(c[0] - at[0], c[1] - at[1]) * 180) / Math.PI;
    const e = { id: blockId('e'), name: nextName('Entrance', blocking().entrances.map((x) => x.name)), x: at[0], z: at[1], facing };
    update((b) => ({ ...b, entrances: [...b.entrances, e] }));
    useBlockingUI.getState().select({ kind: 'entrance', id: e.id });
  },
  renameEntrance: (id: string, name: string) =>
    update((b) => (b.entrances.some((e) => e.id === id) ? { ...b, entrances: b.entrances.map((e) => (e.id === id ? { ...e, name } : e)) } : { ...b, entranceNames: { ...b.entranceNames, [id]: name } }), `ent-name:${id}`),
  removeEntrance: (id: string) => {
    update((b) => ({ ...b, entrances: b.entrances.filter((e) => e.id !== id) }));
    useBlockingUI.getState().select(null);
  },

  addMark: (performerId: string, at: Pt) => {
    const m = { id: blockId('m'), performerId, x: snap(at[0]), z: snap(at[1]) };
    update((b) => ({ ...b, marks: [...b.marks, m] }));
    return m;
  },
  moveMark: (id: string, at: Pt, key: string) => update((b) => ({ ...b, marks: b.marks.map((m) => (m.id === id ? { ...m, x: snap(at[0]), z: snap(at[1]) } : m)) }), key),
  removeMark: (id: string) => {
    update((b) => ({ ...b, marks: b.marks.filter((m) => m.id !== id) }));
    useBlockingUI.getState().select(null);
  },

  /** Make a scene current (not an undo step). */
  openScene: (id: string) => {
    useProjectStore.getState().setBlocking((b) => ({ ...b, sceneId: id }), undefined, false);
    useBlockingUI.getState().setTime(0);
    useBlockingUI.getState().setPlaying(false);
    useBlockingUI.getState().select(null);
    useBlockingUI.getState().setWarnings(null);
  },
  /** A new scene after the current one, starting where the current one ends. */
  addScene: () => {
    const b = blocking();
    const cur = currentScene(b);
    const scene: Scene = { id: blockId('s'), name: nextName('Scene', b.scenes.map((x) => x.name)), notes: '', start: endStates(cur, b, entranceMap(b)), paths: [] };
    update((x) => {
      const i = x.scenes.findIndex((s) => s.id === cur.id);
      return { ...x, scenes: [...x.scenes.slice(0, i + 1), scene, ...x.scenes.slice(i + 1)], sceneId: scene.id };
    });
  },
  /** Copy a scene: the copy starts from where the original ends. */
  duplicateScene: (id: string) => {
    const b = blocking();
    const src = b.scenes.find((s) => s.id === id);
    if (!src) return;
    const scene: Scene = { id: blockId('s'), name: `${src.name} (cont.)`, notes: '', start: endStates(src, b, entranceMap(b)), paths: [] };
    update((x) => {
      const i = x.scenes.findIndex((s) => s.id === id);
      return { ...x, scenes: [...x.scenes.slice(0, i + 1), scene, ...x.scenes.slice(i + 1)], sceneId: scene.id };
    });
    useBlockingUI.getState().setTime(0);
  },
  renameScene: (id: string, name: string) => update((b) => ({ ...b, scenes: b.scenes.map((s) => (s.id === id ? { ...s, name } : s)) }), `scene-name:${id}`),
  setNotes: (notes: string) => patchScene((s) => ({ ...s, notes }), `scene-notes:${blocking().sceneId}`),
  moveScene: (id: string, by: -1 | 1) =>
    update((b) => {
      const i = b.scenes.findIndex((s) => s.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= b.scenes.length) return b;
      const scenes = [...b.scenes];
      [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
      return { ...b, scenes };
    }),
  removeScene: (id: string) =>
    update((b) => {
      if (b.scenes.length <= 1) return b;
      const scenes = b.scenes.filter((s) => s.id !== id);
      return { ...b, scenes, sceneId: b.sceneId === id ? scenes[0].id : b.sceneId };
    }),

  /** A new path for a performer, starting when they are next free (or now, if later). */
  addPath: (performerId: string, points: Pt[], exit: string | undefined, start: number) => {
    const path: Path = { id: blockId('p'), performerId, points, ...(exit ? { exit } : {}), start: Math.round(start * 10) / 10, timing: 'speed', speed: 'normal', duration: 4, stops: [] };
    patchScene((s) => ({ ...s, paths: [...s.paths, path] }));
    useBlockingUI.getState().select({ kind: 'path', id: path.id });
    return path;
  },
  patchPath: (id: string, change: Partial<Path>, key?: string) => patchScene((s) => ({ ...s, paths: s.paths.map((p) => (p.id === id ? { ...p, ...change } : p)) }), key ?? `path:${id}:${Object.keys(change).join()}`),
  movePathPoint: (id: string, i: number, at: Pt, key: string) => patchScene((s) => ({ ...s, paths: s.paths.map((p) => (p.id === id ? { ...p, points: p.points.map((q, k) => (k === i ? at : q)) } : p)) }), key),
  removePathPoint: (id: string, i: number) =>
    patchScene((s) => ({
      ...s,
      paths: s.paths
        .map((p) => (p.id === id ? { ...p, points: p.points.filter((_, k) => k !== i), stops: p.stops.filter((x) => x.index !== i).map((x) => (x.index > i ? { ...x, index: x.index - 1 } : x)) } : p))
        .filter((p) => p.points.length > 0 || p.exit),
    })),
  setStop: (id: string, index: number, hold: number) =>
    patchScene((s) => ({ ...s, paths: s.paths.map((p) => (p.id === id ? { ...p, stops: [...p.stops.filter((x) => x.index !== index), ...(hold > 0 ? [{ index, hold }] : [])] } : p)) }), `stop:${id}:${index}`),
  removePath: (id: string) => {
    patchScene((s) => ({ ...s, paths: s.paths.filter((p) => p.id !== id) }));
    useBlockingUI.getState().select(null);
  },
};
