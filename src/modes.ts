/**
 * The app is organised into modes. Each mode owns its own panels and its own
 * layer of things in the 3D view; things from other modes stay visible (or dim,
 * or hidden) but can't be picked.
 */
export type Mode = 'venue' | 'stage' | 'set' | 'lights' | 'blocking';
export type OtherLayers = 'show' | 'dim' | 'hide';

export interface ModeDef {
  id: Mode;
  label: string;
  /** Not built yet: shown greyed out with a "coming soon" tooltip. */
  soon?: boolean;
  description: string;
}

export const MODES: ModeDef[] = [
  { id: 'venue', label: 'Venue', description: 'Plan the building around the stage: walls, rooms and doors' },
  { id: 'stage', label: 'Stage', description: 'Pick a stage type and set its dimensions' },
  { id: 'set', label: 'Set', description: 'Build the set: objects, graphics and materials' },
  { id: 'lights', label: 'Lights', description: 'Place, aim and colour stage lights' },
  { id: 'blocking', label: 'Blocking', description: 'Plan where performers stand, enter and move' },
];

export const isMode = (v: unknown): v is Mode => MODES.some((m) => m.id === v);
export const modeEnabled = (m: Mode) => !MODES.find((d) => d.id === m)?.soon;
