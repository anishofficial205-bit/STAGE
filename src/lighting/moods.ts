/**
 * Lighting moods: one click lights the stage. A mood makes (or reuses) a small
 * rig sized from the stage — a front wash, two spotlights, a backdrop light and
 * two flood lights — and applies a look, which is kept as an ordinary look you
 * can edit. Also "click where you want light": hang a light on the best bar for
 * that spot and aim it there.
 */
import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import { lightActions } from './actions';
import { PRESET_LOOKS, fadeTo, lookActions } from './looks';
import { HANG_DROP, positionLine, stageCentre } from './hang';
import { useLightsUI } from './ui';
import type { FixtureType, Vec3 } from './types';

export interface Mood {
  id: string;
  name: string;
  preset: string;
  image: string;
  blurb: string;
}

export const MOODS: Mood[] = [
  { id: 'daylight', name: 'Daylight', preset: 'Full stage wash', image: 'moods/daylight.jpg', blurb: 'Bright, even, white' },
  { id: 'warm', name: 'Warm evening', preset: 'Warm evening', image: 'moods/warm.jpg', blurb: 'Amber and gold' },
  { id: 'night', name: 'Night', preset: 'Cold night', image: 'moods/night.jpg', blurb: 'Cool blue, a little haze' },
  { id: 'concert', name: 'Concert', preset: 'Concert', image: 'moods/concert.jpg', blurb: 'Saturated colour and haze' },
  { id: 'spot', name: 'Spotlight on one person', preset: 'Single spot centre', image: 'moods/spot.jpg', blurb: 'One light, centre stage' },
  { id: 'blackout', name: 'Blackout', preset: 'Blackout', image: 'moods/blackout.jpg', blurb: 'Everything off' },
];

const lighting = () => {
  const s = useProjectStore.getState();
  return s.lightingByTemplate[s.templateId]!;
};

const stageLights = () => lighting().fixtures.filter((f) => f.type !== 'house' && f.type !== 'practical');

/** A basic rig over the acting area of whatever stage this is. Leaves existing lights alone. */
export function buildRig() {
  lightActions.ensureReady();
  const c = stageCentre();
  const before = new Set(lighting().fixtures.map((f) => f.id));
  for (let i = 0; i < 4; i++) lightActions.addFixture('fresnel');
  for (let i = 0; i < 2; i++) lightActions.addFixture('profile');
  lightActions.addFixture('cyc');
  lightActions.addFixture('par');
  lightActions.addFixture('par');
  const added = lighting().fixtures.filter((f) => !before.has(f.id));
  added.filter((f) => f.type === 'fresnel').forEach((f, i) => lightActions.focus([f.id], [c[0] + (i - 1.5) * 2.5, c[1], c[2] + 1]));
  added.filter((f) => f.type === 'profile').forEach((f, i) => lightActions.focus([f.id], [c[0] + (i ? 2 : -2), c[1], c[2]]));
  useLightsUI.getState().select(null);
}

/** Light the stage with a mood (one undo step). Makes a rig first if there are hardly any lights. */
export function applyMood(id: string) {
  const mood = MOODS.find((m) => m.id === id);
  const preset = mood && PRESET_LOOKS.find((p) => p.name === mood.preset);
  if (!mood || !preset) return;
  const store = useProjectStore.getState();
  store.batch(`Lit the stage: ${mood.name}`, () => {
    if (mood.id !== 'blackout' && stageLights().length < 3) buildRig();
    fadeTo(preset.make(lighting().fixtures), 0);
    const existing = lighting().looks.find((k) => k.name === mood.name);
    if (existing) lookActions.overwrite(existing.id);
    else lookActions.save(mood.name);
  });
  useLightsUI.getState().select(null);
}

// ---- Click where you want light -------------------------------------------

/** The three everyday choices; every other type is under "More light types". */
export const SIMPLE_LIGHTS: { type: FixtureType; name: string; help: string }[] = [
  { type: 'profile', name: 'Spotlight', help: 'A sharp-edged pool of light on one spot.' },
  { type: 'fresnel', name: 'Soft wash', help: 'A soft, even pool that blends with its neighbours.' },
  { type: 'cyc', name: 'Backdrop light', help: 'Washes a backdrop in colour.' },
];

export const useLightPlacing = create<{ type: FixtureType | null; start: (t: FixtureType) => void; cancel: () => void }>((set) => ({
  type: null,
  start: (type) => set({ type }),
  cancel: () => set({ type: null }),
}));

/**
 * Hang a light where it can reach `target` well and aim it there. Front and
 * soft lights go on the bar in front of the spot that gives about a 45° angle
 * (a new bar is added if none is in front); backdrop lights go on the bar
 * furthest back. Returns the new light's id.
 */
export function addLightAimedAt(type: FixtureType, target: Vec3) {
  const store = useProjectStore.getState();
  let id = '';
  store.batch('Added a light', () => {
    lightActions.ensureReady();
    const bars = () => lighting().positions.filter((p) => p.kind !== 'boom');
    let pick = null as ReturnType<typeof bars>[number] | null;
    if (type === 'cyc') {
      pick = [...bars()].sort((a, b) => a.z - b.z)[0] ?? null;
    } else {
      const inFront = bars().filter((p) => p.z > target[2] + 0.5);
      if (!inFront.length) {
        lightActions.addPosition('foh');
        const added = lighting().positions[lighting().positions.length - 1];
        // Put the new bar about a 45° throw in front of the spot.
        lightActions.patchPosition(added.id, { z: target[2] + Math.max(3, added.y - target[1]), x: target[0] });
        inFront.push(lighting().positions.find((p) => p.id === added.id)!);
      }
      pick = inFront.sort((a, b) => Math.abs(a.z - target[2] - (a.y - target[1])) - Math.abs(b.z - target[2] - (b.y - target[1])))[0];
    }
    const line = pick && positionLine(pick);
    const x = line ? Math.min(Math.max(target[0], Math.min(line.a[0], line.b[0])), Math.max(line.a[0], line.b[0])) : target[0];
    const at = pick ? { pos: [x, pick.y - HANG_DROP, pick.z] as Vec3, mount: pick.id } : undefined;
    const f = lightActions.addFixture(type, at);
    lightActions.focus([f.id], target);
    id = f.id;
  });
  useLightsUI.getState().select({ kind: 'fixture', ids: [id] });
  return id;
}
