import type { Fixture } from '../../lighting/types';
import type { Params } from '../../types';
import { openAirLightCount } from '../../templates/openAir';

/** Real lights the chosen stage turns on by itself. */
export const stageLightCount = (templateId: string, params: Params) => (templateId === 'open-air' ? openAirLightCount(params) : 0);

/**
 * Real three.js lights we allow at once; the rest are drawn as soft pools.
 * Every real light is worked out for every surface each frame, so Draft keeps
 * few (a stadium with 20 ran at ~7 fps, with 8 at ~40); Presentation and
 * exports get the full count.
 */
export const MAX_REAL = { draft: 8, presentation: 16 } as const;
/** Lights that cast real shadows (Presentation quality). */
export const MAX_SHADOWS = 8;

/**
 * Which fixtures get a real light and which of those cast shadows. The brightest
 * win. Gobo lights need a shadow map to project, so they keep shadows in Draft too.
 */
export function lightBudget(fixtures: Fixture[], quality: 'draft' | 'presentation', stageLights = 0) {
  const lit = fixtures.filter((f) => f.on && f.intensity > 0).sort((a, b) => b.intensity - a.intensity);
  // Lights the stage itself turns on come out of the same budget, but the plan always keeps a few.
  const max = quality === 'draft' ? Math.max(4, MAX_REAL.draft - stageLights) : MAX_REAL.presentation;
  const real = new Set(lit.slice(0, max).map((f) => f.id));
  const approx = new Set(lit.slice(max).map((f) => f.id));
  const shadows = new Set<string>();
  for (const f of lit) {
    if (!real.has(f.id) || shadows.size >= MAX_SHADOWS) continue;
    if (f.gobo && f.type !== 'practical' && f.type !== 'house') shadows.add(f.id);
    else if (quality === 'presentation' && f.castShadow) shadows.add(f.id);
  }
  return { real, approx, shadows, max };
}
