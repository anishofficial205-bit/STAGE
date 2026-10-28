/**
 * Placing set pieces: clicking a library tile starts "placing" — a ghost of the
 * piece follows the cursor over the stage and a click puts it there (Esc
 * cancels). New pieces never land on top of others or on a performer: they
 * nudge to the nearest free spot. Also counts what you use for "Most used".
 */
import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import type { Pt } from '../venue/types';
import { getObjectType } from './registry';
import { placementOf } from './types';
import type { Placed } from './geometry';
import { applyConstraints, defaultParams } from '../helpers/params';
import type { Params } from '../types';

/** What a piece starts with when it isn't a plain library piece (e.g. one of My props). */
export interface PlaceInit {
  params?: Params;
  name?: string;
  /** Changing these (e.g. a different prop) re-measures the ghost. */
  key?: string;
}

export const usePlacing = create<{ typeId: string | null; init: PlaceInit | null; start: (typeId: string, init?: PlaceInit) => void; cancel: () => void }>((set) => ({
  typeId: null,
  init: null,
  start: (typeId, init) => set({ typeId, init: init ?? null }),
  cancel: () => set({ typeId: null, init: null }),
}));

// ---- Most used -----------------------------------------------------------

const USAGE = 'stage-builder:object-usage';
export const DEFAULT_MOST_USED = ['flat', 'platform', 'steps', 'backdrop', 'chair', 'plant'];

function readUsage(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(USAGE) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export const useUsage = create<{ counts: Record<string, number> }>(() => ({ counts: readUsage() }));

export function recordUse(typeId: string) {
  const counts = { ...useUsage.getState().counts, [typeId]: (useUsage.getState().counts[typeId] ?? 0) + 1 };
  useUsage.setState({ counts });
  try {
    localStorage.setItem(USAGE, JSON.stringify(counts));
  } catch {
    /* not remembered */
  }
}

/** The six defaults until you've placed 5+ pieces, then your own most-used (topped up with defaults). */
export function mostUsed(counts: Record<string, number>): string[] {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total < 5) return DEFAULT_MOST_USED;
  const mine = Object.entries(counts)
    .filter(([id]) => getObjectType(id) && getObjectType(id)!.library !== false)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  return [...new Set([...mine, ...DEFAULT_MOST_USED])].slice(0, 6);
}

// ---- Free spots ------------------------------------------------------------

type Rect = { x0: number; x1: number; z0: number; z1: number };

/** Axis-aligned box around a footprint of w × d at (x, z) turned by `deg`. */
export function footprint(x: number, z: number, w: number, d: number, deg: number): Rect {
  const a = (deg * Math.PI) / 180;
  const hw = (Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * d) / 2;
  const hd = (Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * d) / 2;
  return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd };
}

const overlaps = (a: Rect, b: Rect, gap = 0.02) => a.x0 < b.x1 - gap && a.x1 > b.x0 + gap && a.z0 < b.z1 - gap && a.z1 > b.z0 + gap;

/** Where performers start the current scene (world x, z), as small squares. */
function performerRects(): Rect[] {
  const s = useProjectStore.getState();
  const b = s.blockingByTemplate[s.templateId];
  const scene = b?.scenes.find((x) => x.id === b.sceneId);
  if (!scene) return [];
  return Object.values(scene.start)
    .filter((st) => st.onStage)
    .map((st) => ({ x0: st.x - 0.35, x1: st.x + 0.35, z0: st.z - 0.35, z1: st.z + 0.35 }));
}

/**
 * The nearest spot to `want` (world x, z) where a w × d footprint touches no other
 * floor piece and no performer. Searches outward in grid steps; gives up at 8 m.
 */
export function freeSpot(want: Pt, w: number, d: number, deg: number, others: Placed[], step = 0.25): Pt {
  const blockers = [
    ...others.filter((p) => placementOf(p.type, p.obj.params) === 'floor').map((p) => footprint(p.wx, p.wz, p.size.width, p.size.depth, p.obj.rotation)),
    ...performerRects(),
  ];
  const free = (x: number, z: number) => !blockers.some((r) => overlaps(footprint(x, z, w, d, deg), r));
  if (free(want[0], want[1])) return want;
  for (let ring = 1; ring * step <= 8; ring++) {
    let best: Pt | null = null;
    let bestD = Infinity;
    for (let i = -ring; i <= ring; i++) {
      for (const [dx, dz] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
        const x = want[0] + dx * step;
        const z = want[1] + dz * step;
        const dist = Math.hypot(dx, dz);
        if (dist < bestD && free(x, z)) {
          best = [x, z];
          bestD = dist;
        }
      }
    }
    if (best) return best;
  }
  return want;
}

/** Footprint of a new piece of this type with default settings. */
export function defaultSize(typeId: string, params?: Params) {
  const type = getObjectType(typeId);
  if (!type) return null;
  const p = params ? applyConstraints(type, { ...defaultParams(type), ...params }) : defaultParams(type);
  const s = type.size(p);
  return { width: s.width, depth: s.depth, height: s.height, floor: placementOf(type, p) === 'floor' };
}
