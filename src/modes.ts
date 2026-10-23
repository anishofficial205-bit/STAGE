/**
 * The app is organised into modes. Each mode owns its own panels and its own
 * layer of things in the 3D view; things from other modes stay visible (or dim,
 * or hidden) but can't be picked.
 */
export type Mode = 'venue' | 'set' | 'lights' | 'blocking';
export type OtherLayers = 'show' | 'dim' | 'hide';

export interface ModeDef {
  id: Mode;
  label: string;
  /** Not built yet: shown greyed out with a "coming soon" tooltip. */
  soon?: boolean;
  /** Kept apart from the main steps, at the bottom of the rail under "Advanced". */
  advanced?: boolean;
  description: string;
}

/** In working order; keys 1–4 follow this order (Venue, the optional extra, is 4). The stage itself is chosen when a project is made and edited as an object in Set. */
export const MODES: ModeDef[] = [
  { id: 'set', label: 'Set', description: 'Build the set: objects, graphics and materials' },
  { id: 'lights', label: 'Lights', description: 'Place, aim and colour stage lights' },
  { id: 'blocking', label: 'Blocking', description: 'Plan where performers stand, enter and move' },
  { id: 'venue', label: 'Venue', advanced: true, description: 'Backstage & venue: plan the building around the stage — walls, rooms and doors' },
];

/** The main path through a project. */
export const STEPS = MODES.filter((m) => !m.advanced);

export const isMode = (v: unknown): v is Mode => MODES.some((m) => m.id === v);
export const modeEnabled = (m: Mode) => !MODES.find((d) => d.id === m)?.soon;
