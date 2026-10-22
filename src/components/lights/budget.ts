import type { Fixture } from '../../lighting/types';

/** Real three.js lights we allow at once; the rest are drawn as soft pools. */
export const MAX_REAL = 16;
/** Lights that cast real shadows (Presentation quality). */
export const MAX_SHADOWS = 8;

/**
 * Which fixtures get a real light and which of those cast shadows. The brightest
 * win. Gobo lights need a shadow map to project, so they keep shadows in Draft too.
 */
export function lightBudget(fixtures: Fixture[], quality: 'draft' | 'presentation') {
  const lit = fixtures.filter((f) => f.on && f.intensity > 0).sort((a, b) => b.intensity - a.intensity);
  const real = new Set(lit.slice(0, MAX_REAL).map((f) => f.id));
  const approx = new Set(lit.slice(MAX_REAL).map((f) => f.id));
  const shadows = new Set<string>();
  for (const f of lit) {
    if (!real.has(f.id) || shadows.size >= MAX_SHADOWS) continue;
    if (f.gobo && f.type !== 'practical' && f.type !== 'house') shadows.add(f.id);
    else if (quality === 'presentation' && f.castShadow) shadows.add(f.id);
  }
  return { real, approx, shadows };
}
