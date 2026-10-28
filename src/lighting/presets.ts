/**
 * My presets: lighting you make once and use in any project in this browser.
 *
 * - A light: one light's settings (kind, colour, brightness, beam, edge, gobo).
 * - A mood: the lighting of a whole stage, kept as a recipe — each light's
 *   kind, where it hangs and points *relative to the stage*, and its settings.
 *   Using it on another stage matches lights already there (same kind,
 *   nearest place), adds the ones that are missing, sizes everything to the
 *   stage and switches off the rest.
 * - A rig: the places to hang lights and the lights on them, also relative to
 *   the stage. Using it replaces the stage's lights.
 *
 * Kept in localStorage; they can be exported to a file and imported again.
 */
import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import { currentStage } from '../objects/actions';
import { playingArea } from '../objects/curtains/drapes';
import { floorHeightAt } from '../helpers/stageInfo';
import { exporter } from '../export/state';
import { lightActions } from './actions';
import { addLightAimedAt } from './moods';
import { lookActions } from './looks';
import { positionLine } from './hang';
import { useLightsUI } from './ui';
import { FIXTURES, emptyLighting, lightId, type Fixture, type FixtureType, type Haze, type HangPosition, type Lighting, type Vec3 } from './types';
import { GOBOS } from './gobos';

/** The settings a light preset (and each light in a mood or rig) carries. */
export interface LightLook {
  on: boolean;
  intensity: number;
  color: string;
  gel?: string;
  kelvin?: number;
  beam: number;
  soft: number;
  gobo?: string;
}

export interface LightPreset extends LightLook {
  kind: 'light';
  id: string;
  name: string;
  savedAt: number;
  type: FixtureType;
}

/** A light in a mood or rig, placed relative to the stage. */
export interface RecipeLight extends LightLook {
  type: FixtureType;
  name: string;
  channel: number;
  /** Relative to the stage (see `frame`). */
  pos: Vec3;
  target: Vec3;
  /** Name of the place it hangs (rigs). */
  on_: string | null;
  purpose?: string;
}

export interface RecipePosition {
  kind: HangPosition['kind'];
  name: string;
  at: Vec3;
  /** Length as a share of the stage width (bars) or metres (poles). */
  length: number;
}

export interface MoodPreset {
  kind: 'mood';
  id: string;
  name: string;
  savedAt: number;
  thumbnail: string;
  lights: RecipeLight[];
  haze: Haze;
}

export interface RigPreset {
  kind: 'rig';
  id: string;
  name: string;
  savedAt: number;
  positions: RecipePosition[];
  lights: RecipeLight[];
}

export type Preset = LightPreset | MoodPreset | RigPreset;

const KEY = 'stage-builder:light-presets';

function read(): Preset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(isPreset) : [];
  } catch {
    return [];
  }
}

const isPreset = (p: unknown): p is Preset => {
  const x = p as Preset;
  if (!x || typeof x.id !== 'string' || typeof x.name !== 'string') return false;
  if (x.kind === 'light') return x.type in FIXTURES;
  if (x.kind === 'mood') return Array.isArray(x.lights);
  if (x.kind === 'rig') return Array.isArray(x.lights) && Array.isArray(x.positions);
  return false;
};

export const useLightPresets = create<{ list: Preset[] }>(() => ({ list: read() }));

function write(list: Preset[]) {
  useLightPresets.setState({ list });
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    // Storage full or blocked: kept for this visit only.
    return false;
  }
}

const pid = (k: string) => `${k}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---- Stage-relative coordinates ---------------------------------------------

/** Across: −1 at stage left edge … 1 at right; up: metres above the stage floor; deep: 0 at the front of the acting area … 1 at the back. */
function frame() {
  const { info } = currentStage();
  const a = playingArea(info);
  const floor = floorHeightAt(info, a.cx, (a.front + a.back) / 2);
  const depth = Math.abs(a.back - a.front) < 0.5 ? (a.back >= a.front ? 0.5 : -0.5) : a.back - a.front;
  const half = Math.max(0.5, a.width / 2);
  return {
    width: a.width,
    toRel: (v: Vec3): Vec3 => [(v[0] - a.cx) / half, v[1] - floor, (v[2] - a.front) / depth],
    toAbs: (v: Vec3): Vec3 => [a.cx + v[0] * half, floor + v[1], a.front + v[2] * depth],
  };
}

const lookOf = (f: Fixture): LightLook => ({ on: f.on, intensity: f.intensity, color: f.color, gel: f.gel, kelvin: f.kelvin, beam: f.beam, soft: f.soft, gobo: f.gobo && GOBOS.some((g) => g.id === f.gobo) ? f.gobo : undefined });

const lighting = (): Lighting => {
  const s = useProjectStore.getState();
  return s.lightingByTemplate[s.templateId] ?? emptyLighting();
};

function recipe(l: Lighting, effective?: Map<string, Vec3>): RecipeLight[] {
  const fr = frame();
  return l.fixtures
    .filter((f) => !f.hidden)
    .map((f) => ({
      ...lookOf(f),
      type: f.type,
      name: f.name,
      channel: f.channel,
      pos: fr.toRel(f.pos),
      target: fr.toRel(effective?.get(f.id) ?? f.target),
      on_: f.mount === 'floor' || f.mount === 'rig' || !f.mount ? f.mount : l.positions.find((p) => p.id === f.mount)?.name ?? null,
      ...(f.purpose ? { purpose: f.purpose } : {}),
    }));
}

async function snapshot() {
  try {
    return (await exporter.capture?.({ width: 320, height: 200, labels: false, type: 'image/jpeg' })) ?? '';
  } catch {
    return '';
  }
}

// ---- Saving -----------------------------------------------------------------

export const presetActions = {
  saveLight: (f: Fixture, name: string) => {
    const p: LightPreset = { kind: 'light', id: pid('pl'), name: name.trim() || f.name, savedAt: Date.now(), type: f.type, ...lookOf(f) };
    return write([p, ...useLightPresets.getState().list]) ? p : null;
  },
  saveMood: async (name: string) => {
    const l = lighting();
    const p: MoodPreset = { kind: 'mood', id: pid('pm'), name: name.trim() || 'My mood', savedAt: Date.now(), thumbnail: await snapshot(), lights: recipe(l), haze: { ...l.haze } };
    return write([p, ...useLightPresets.getState().list]) ? p : null;
  },
  saveRig: (name: string) => {
    const l = lighting();
    const fr = frame();
    const positions: RecipePosition[] = l.positions.map((p) => ({ kind: p.kind, name: p.name, at: fr.toRel([p.x, p.y, p.z]), length: p.kind === 'boom' ? p.length : p.length / Math.max(1, fr.width) }));
    const p: RigPreset = { kind: 'rig', id: pid('pr'), name: name.trim() || 'My rig', savedAt: Date.now(), positions, lights: recipe(l) };
    return write([p, ...useLightPresets.getState().list]) ? p : null;
  },
  remove: (id: string) => write(useLightPresets.getState().list.filter((p) => p.id !== id)),
  rename: (id: string, name: string) => write(useLightPresets.getState().list.map((p) => (p.id === id ? { ...p, name } : p))),

  /** Settings of a light preset, to put on a light. */
  lightPatch: (p: LightPreset): Partial<Fixture> => {
    const spec = FIXTURES[p.type];
    return { on: p.on, intensity: p.intensity, color: p.color, gel: p.gel, kelvin: p.kelvin, beam: Math.min(spec.beam[1] || 120, Math.max(spec.beam[0], p.beam)), soft: p.soft, gobo: p.gobo, name: p.name };
  },

  /** Light the current stage with a saved mood (one undo step). */
  applyMood: (m: MoodPreset) => {
    const fr = frame();
    useProjectStore.getState().batch(`Lit the stage: ${m.name}`, () => {
      lightActions.ensureReady();
      const used = new Set<string>();
      const states: Record<string, Partial<Fixture>> = {};
      for (const r of m.lights) {
        const want = fr.toAbs(r.pos);
        const pool = lighting().fixtures.filter((f) => f.type === r.type && !used.has(f.id) && !f.hidden);
        const near = pool.sort((a, b) => dist(a.pos, want) - dist(b.pos, want))[0];
        const target = fr.toAbs(r.target);
        const id = near ? near.id : r.type === 'house' || FIXTURES[r.type].mount !== 'rig' ? lightActions.addFixture(r.type).id : addLightAimedAt(r.type, target);
        used.add(id);
        const spec = FIXTURES[r.type];
        states[id] = {
          on: r.on,
          intensity: r.intensity,
          color: r.color,
          gel: r.gel,
          kelvin: r.kelvin,
          beam: Math.min(spec.beam[1] || 120, Math.max(spec.beam[0], r.beam)),
          soft: r.soft,
          gobo: r.gobo,
          follow: undefined,
          ...(spec.point ? {} : { target }),
        };
      }
      lightActions.patch(
        lighting().fixtures.map((f) => f.id),
        (f) => (states[f.id] ? states[f.id] : { on: false }),
      );
      lightActions.setHaze(m.haze);
      const existing = lighting().looks.find((k) => k.name === m.name);
      if (existing) lookActions.overwrite(existing.id);
      else lookActions.save(m.name);
    });
    useLightsUI.getState().select(null);
  },

  /** Replace the current stage's lights with a saved rig (one undo step). */
  applyRig: (r: RigPreset) => {
    const fr = frame();
    const positions: HangPosition[] = r.positions.map((p) => {
      const [x, y, z] = fr.toAbs(p.at);
      return { id: lightId('h'), kind: p.kind, name: p.name, x, y, z, length: p.kind === 'boom' ? p.length : Math.max(0.5, p.length * Math.max(1, fr.width)) };
    });
    const byName = new Map(positions.map((p) => [p.name, p]));
    const fixtures: Fixture[] = r.lights.map((x) => {
      const mount = x.on_ && byName.get(x.on_);
      let pos = fr.toAbs(x.pos);
      if (mount) {
        const line = positionLine(mount);
        pos = mount.kind === 'boom' ? [mount.x, Math.min(line.b[1], Math.max(line.a[1], pos[1])), mount.z] : [Math.min(line.b[0], Math.max(line.a[0], pos[0])), pos[1], mount.z];
      }
      const spec = FIXTURES[x.type];
      return {
        id: lightId('l'),
        type: x.type,
        name: x.name,
        channel: x.channel,
        pos,
        mount: mount ? mount.id : x.on_ === 'floor' || x.on_ === 'rig' ? x.on_ : null,
        target: fr.toAbs(x.target),
        beam: x.beam,
        soft: x.soft,
        intensity: x.intensity,
        on: x.on,
        color: x.color,
        ...(x.gel ? { gel: x.gel } : {}),
        ...(x.kelvin ? { kelvin: x.kelvin } : {}),
        ...(x.gobo ? { gobo: x.gobo } : {}),
        castShadow: !spec.point && x.type !== 'house' && x.type !== 'cyc',
        ...(x.purpose ? { purpose: x.purpose } : {}),
      };
    });
    useProjectStore.getState().batch(`Hung the rig: ${r.name}`, () =>
      useProjectStore.getState().setLighting((l) => ({ ...l, positions, fixtures, looks: [], groups: [], ready: true })),
    );
    useLightsUI.getState().select(null);
  },

  /** Download every preset as a file. */
  exportFile: () => new Blob([JSON.stringify({ format: 'stage-builder-light-presets', version: 1, presets: useLightPresets.getState().list }, null, 1)], { type: 'application/json' }),

  /** Add the presets in a file (returns how many). */
  importFile: async (file: File) => {
    const raw = JSON.parse(await file.text());
    const incoming = (Array.isArray(raw?.presets) ? raw.presets : []).filter(isPreset).map((p: Preset) => ({ ...p, id: pid(p.id.slice(0, 2)) }));
    if (!incoming.length) throw new Error('That file has no lighting presets in it.');
    write([...incoming, ...useLightPresets.getState().list]);
    return incoming.length as number;
  },
};

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
