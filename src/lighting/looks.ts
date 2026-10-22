/**
 * Looks: saved lighting states (every light's on/off, level, colour, focus and
 * gobo, plus the haze). Recalling a look fades to it; the in-between frames
 * are shown live and only the end state is saved (one undo step).
 */
import * as THREE from 'three';
import { useProjectStore } from '../store/useProjectStore';
import { stageCentre } from './hang';
import { emptyLighting, GELS, lightId, type Fixture, type FixtureState, type Haze, type Lighting, type Look, type Vec3 } from './types';
import { useLightsUI } from './ui';

const lighting = () => {
  const s = useProjectStore.getState();
  return s.lightingByTemplate[s.templateId] ?? emptyLighting();
};
const update = (fn: (l: Lighting) => Lighting, key?: string) => useProjectStore.getState().setLighting(fn, key);

export const stateOf = (f: Fixture): FixtureState => ({ on: f.on, intensity: f.intensity, color: f.color, gel: f.gel, kelvin: f.kelvin, target: [...f.target] as Vec3, gobo: f.gobo });

function capture(l: Lighting) {
  return { states: Object.fromEntries(l.fixtures.map((f) => [f.id, stateOf(f)])), haze: { ...l.haze } };
}

const gel = (name: string) => GELS.find((g) => g.name === name)!.color;

export interface PresetLook {
  name: string;
  make: (fixtures: Fixture[]) => { states: Record<string, Partial<FixtureState>>; haze?: Partial<Haze> };
}

const stageLights = (f: Fixture) => f.type !== 'house' && f.type !== 'practical';

/** Starting points that work with whatever lights the stage has. */
export const PRESET_LOOKS: PresetLook[] = [
  {
    name: 'Full stage wash',
    make: (fx) => ({ states: Object.fromEntries(fx.map((f) => [f.id, stageLights(f) ? { on: true, intensity: 85, color: '#ffffff', gel: 'Open White', kelvin: undefined, gobo: undefined } : { on: false }])), haze: { on: false } }),
  },
  {
    name: 'Warm evening',
    make: (fx) => ({ states: Object.fromEntries(fx.map((f, i) => [f.id, f.type === 'house' ? { on: false } : f.type === 'cyc' ? { on: true, intensity: 70, color: '#ff8a3d', gel: undefined } : { on: true, intensity: f.type === 'practical' ? 90 : 60, color: gel(i % 2 ? 'Straw' : 'Bastard Amber'), gel: i % 2 ? 'Straw' : 'Bastard Amber' }])), haze: { on: false } }),
  },
  {
    name: 'Cold night',
    make: (fx) => ({ states: Object.fromEntries(fx.map((f) => [f.id, f.type === 'house' || f.type === 'practical' ? { on: false } : f.type === 'cyc' ? { on: true, intensity: 55, color: gel('Congo Blue'), gel: 'Congo Blue' } : { on: true, intensity: 35, color: gel('Steel Blue'), gel: 'Steel Blue', gobo: undefined }])), haze: { on: true, density: 25 } }),
  },
  { name: 'Blackout', make: (fx) => ({ states: Object.fromEntries(fx.map((f) => [f.id, { on: false }])), haze: { on: false } }) },
  {
    name: 'Single spot centre',
    make: (fx) => {
      const rank = (f: Fixture) => ['follow', 'profile', 'moving', 'fresnel', 'par'].indexOf(f.type);
      const pick = fx.filter((f) => rank(f) >= 0).sort((a, b) => rank(a) - rank(b))[0];
      const c = stageCentre();
      return { states: Object.fromEntries(fx.map((f) => [f.id, f === pick ? { on: true, intensity: 100, color: '#ffffff', gel: 'Open White', target: c, gobo: undefined } : { on: false }])), haze: { on: false } };
    },
  },
  {
    name: 'Concert',
    make: (fx) => {
      const colours = ['Primary Red', 'Congo Blue', 'Surprise Pink', 'Primary Green', 'Bastard Amber', 'Lavender'];
      return { states: Object.fromEntries(fx.map((f, i) => [f.id, f.type === 'house' ? { on: false } : { on: true, intensity: 100, color: gel(colours[i % colours.length]), gel: colours[i % colours.length] }])), haze: { on: true, density: 60 } };
    },
  },
];

let fading = 0;

/** Fade from the current state to `to` over `seconds` (live), then save it as one undo step. */
export function fadeTo(to: { states: Record<string, Partial<FixtureState>>; haze?: Partial<Haze> }, seconds: number) {
  cancelAnimationFrame(fading);
  const l = lighting();
  const from = capture(l);
  const end: Record<string, FixtureState> = Object.fromEntries(l.fixtures.map((f) => [f.id, { ...stateOf(f), ...(to.states[f.id] ?? {}) }]));
  const endHaze: Haze = { ...l.haze, ...(to.haze ?? {}) };
  const a = new THREE.Color();
  const b = new THREE.Color();
  const ms = Math.max(0, seconds) * 1000;
  const start = performance.now();
  const frame = (t: number): { states: Record<string, FixtureState>; haze: Haze } => {
    const states: Record<string, FixtureState> = {};
    for (const f of l.fixtures) {
      const s0 = from.states[f.id];
      const s1 = end[f.id];
      const i0 = s0.on ? s0.intensity : 0;
      const i1 = s1.on ? s1.intensity : 0;
      a.set(s0.color);
      b.set(s1.color);
      // A light coming on fades up in its new colour; one going out fades down in its old one.
      const col = !s0.on ? s1.color : !s1.on ? s0.color : `#${a.lerp(b, t).getHexString()}`;
      states[f.id] = {
        on: s0.on || s1.on,
        intensity: i0 + (i1 - i0) * t,
        color: col,
        gel: t < 1 ? s0.gel : s1.gel,
        kelvin: t < 1 ? s0.kelvin : s1.kelvin,
        target: s0.target.map((v, k) => v + (s1.target[k] - v) * t) as Vec3,
        gobo: t < 0.5 ? s0.gobo : s1.gobo,
      };
    }
    const d0 = from.haze.on ? from.haze.density : 0;
    const d1 = endHaze.on ? endHaze.density : 0;
    return { states, haze: { on: from.haze.on || endHaze.on, density: d0 + (d1 - d0) * t } };
  };
  const finish = () => {
    useLightsUI.getState().setLive(null);
    update((x) => ({ ...x, haze: endHaze, fixtures: x.fixtures.map((f) => (end[f.id] ? { ...f, ...end[f.id] } : f)) }));
  };
  if (ms === 0) return finish();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    if (t >= 1) return finish();
    useLightsUI.getState().setLive(frame(e));
    fading = requestAnimationFrame(step);
  };
  fading = requestAnimationFrame(step);
}

export const lookActions = {
  save: (name: string) => {
    const look: Look = { id: lightId('k'), name: name.trim() || `Look ${lighting().looks.length + 1}`, ...capture(lighting()) };
    update((l) => ({ ...l, looks: [...l.looks, look] }));
    return look;
  },
  /** Store the current state into an existing look. */
  overwrite: (id: string) => update((l) => ({ ...l, looks: l.looks.map((k) => (k.id === id ? { ...k, ...capture(l) } : k)) })),
  rename: (id: string, name: string) => update((l) => ({ ...l, looks: l.looks.map((k) => (k.id === id ? { ...k, name } : k)) }), `look-name:${id}`),
  duplicate: (id: string) => update((l) => {
    const src = l.looks.find((k) => k.id === id);
    return src ? { ...l, looks: [...l.looks, { ...src, id: lightId('k'), name: `${src.name} copy` }] } : l;
  }),
  remove: (id: string) => update((l) => ({ ...l, looks: l.looks.filter((k) => k.id !== id) })),
  recall: (id: string, seconds: number) => {
    const look = lighting().looks.find((k) => k.id === id);
    if (look) fadeTo(look, seconds);
  },
  /** Fade to a preset and keep it as a look. */
  fromPreset: (p: PresetLook, seconds: number) => {
    const made = p.make(lighting().fixtures);
    fadeTo(made, seconds);
    // Saved once the fade has landed.
    setTimeout(() => lookActions.save(p.name), seconds * 1000 + 50);
  },
};

export const groupActions = {
  create: (name: string, ids: string[]) => update((l) => ({ ...l, groups: [...l.groups, { id: lightId('g'), name: name.trim() || `Group ${l.groups.length + 1}`, ids }] })),
  rename: (id: string, name: string) => update((l) => ({ ...l, groups: l.groups.map((g) => (g.id === id ? { ...g, name } : g)) }), `group-name:${id}`),
  setMembers: (id: string, ids: string[]) => update((l) => ({ ...l, groups: l.groups.map((g) => (g.id === id ? { ...g, ids } : g)) })),
  remove: (id: string) => update((l) => ({ ...l, groups: l.groups.filter((g) => g.id !== id) })),
};
