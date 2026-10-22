/**
 * Venue edits (all undoable through the project store; drags merge into one step).
 */
import { useProjectStore } from '../store/useProjectStore';
import { M_PER_FT } from '../units';
import { samePt } from './geometry';
import { WALL_DEFAULTS, venueId, type Pt, type Venue, type Wall } from './types';
import { useVenueUI } from './ui';

/** Plan grid: 0.1 m, or 3 in when working in feet. */
export const planGrid = () => (useProjectStore.getState().units === 'ft' ? 0.25 * M_PER_FT : 0.1);

const venue = () => useProjectStore.getState().venue;
const update = (fn: (v: Venue) => Venue, key?: string) => useProjectStore.getState().setVenue(fn, key);

/** Move every wall end sitting at `from` (so joined walls stay joined). */
const moveEnds = (walls: Wall[], from: Pt, to: Pt, only?: Set<string>) =>
  walls.map((w) => (only && !only.has(w.id) ? w : { ...w, a: samePt(w.a, from) ? to : w.a, b: samePt(w.b, from) ? to : w.b }));

export const venueActions = {
  /** Turn the drawn corners into connected walls. */
  finishWalls: (points: Pt[]) => {
    const pts = points.filter((p, i) => i === 0 || !samePt(p, points[i - 1]));
    if (pts.length < 2) return [];
    // Inherit the look of the last wall selected/drawn, else defaults.
    const last = venue().walls[venue().walls.length - 1];
    const look = last ? { thickness: last.thickness, height: last.height, material: last.material } : WALL_DEFAULTS;
    const walls: Wall[] = pts.slice(1).map((b, i) => ({ id: venueId('w'), a: pts[i], b, ...look }));
    update((v) => ({ ...v, walls: [...v.walls, ...walls] }));
    return walls;
  },
  patchWall: (id: string, change: Partial<Wall>, key?: string) => update((v) => ({ ...v, walls: v.walls.map((w) => (w.id === id ? { ...w, ...change } : w)) }), key ?? `wall:${id}:${Object.keys(change).join()}`),
  /** Set a wall's length, keeping its start (and moving the walls joined at its end). */
  setLength: (id: string, length: number) => {
    const w = venue().walls.find((x) => x.id === id);
    if (!w || length < 0.05) return;
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1;
    const to: Pt = [w.a[0] + ((w.b[0] - w.a[0]) / L) * length, w.a[1] + ((w.b[1] - w.a[1]) / L) * length];
    update((v) => ({ ...v, walls: moveEnds(v.walls, w.b, to) }), `wall-len:${id}`);
  },
  /** Drag one end of a wall to `to`; walls joined there follow. */
  moveEnd: (from: Pt, to: Pt, key: string) => update((v) => ({ ...v, walls: moveEnds(v.walls, from, to) }), key),
  /** Move a whole wall by (dx, dz) from its starting position; walls joined to it stretch to follow. */
  moveWall: (start: Wall, dx: number, dz: number, key: string) =>
    update((v) => {
      const cur = v.walls.find((w) => w.id === start.id);
      if (!cur) return v;
      const na: Pt = [start.a[0] + dx, start.a[1] + dz];
      const nb: Pt = [start.b[0] + dx, start.b[1] + dz];
      let walls = moveEnds(v.walls, cur.a, na);
      walls = moveEnds(walls, cur.b, nb);
      return { ...v, walls };
    }, key),
  removeWall: (id: string) => {
    update((v) => ({ ...v, walls: v.walls.filter((w) => w.id !== id) }));
    if (useVenueUI.getState().selected?.id === id) useVenueUI.getState().select(null);
  },
};
