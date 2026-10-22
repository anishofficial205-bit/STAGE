/**
 * Entrances: named places performers come on and go off. Most are found
 * automatically — wing gaps between masking legs (SL1, SL2…, SR1…), doors the
 * venue marks as stage entrances, the template's vomitories and aisles, and
 * house aisles — plus any the user adds.
 */
import { getTemplate } from '../templates/registry';
import { getStageInfo, stageSnapLines } from '../helpers/stageInfo';
import { place } from '../objects/geometry';
import { doorSpan, wallFrame } from '../venue/geometry';
import type { ProjectFile } from '../store/useProjectStore';
import type { Blocking } from './types';

export interface Entrance {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Direction onto the stage (degrees, 0 = +z). */
  facing: number;
  source: 'wings' | 'venue' | 'stage' | 'house' | 'custom';
}

const towards = (from: [number, number], to: [number, number]) => (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;

type Source = Pick<ProjectFile, 'templateId' | 'paramsByTemplate' | 'dataByTemplate' | 'objectsByTemplate' | 'venue'>;

export function computeEntrances(s: Source, blocking: Blocking): Entrance[] {
  const t = getTemplate(s.templateId);
  if (!t) return [];
  const params = s.paramsByTemplate[s.templateId];
  const data = s.dataByTemplate[s.templateId];
  const info = getStageInfo(t, params, data);
  const [x0, z0, x1, z1] = stageSnapLines(info).bounds;
  const centre: [number, number] = [(x0 + x1) / 2, (z0 + z1) / 2];
  const out: Entrance[] = [];
  const named = (key: string, name: string) => blocking.entranceNames[key] ?? name;

  // Wing gaps: between neighbouring legs on each side, numbered from downstage.
  const legs = (s.objectsByTemplate[s.templateId] ?? []).filter((o) => o.type === 'leg' && !o.hidden).map((o) => place(o, info)).filter((p): p is NonNullable<typeof p> => !!p);
  for (const side of [1, -1] as const) {
    const list = legs.filter((p) => (p.wx - centre[0]) * side > 0.5).sort((a, b) => b.wz - a.wz);
    const label = side > 0 ? 'SL' : 'SR';
    list.forEach((leg, i) => {
      const next = list[i + 1];
      const z = next ? (leg.wz + next.wz) / 2 : leg.wz - 1;
      if (!next && z < z0 - 0.5) return;
      const key = `wing-${label}-${i + 1}`;
      out.push({ id: key, name: named(key, `${label}${i + 1}`), x: leg.wx, z, facing: side > 0 ? -90 : 90, source: 'wings' });
    });
  }

  // Venue doors that lead onto the stage.
  for (const d of s.venue.doors) {
    if (!d.entrance) continue;
    const w = s.venue.walls.find((x) => x.id === d.wallId);
    if (!w) continue;
    const [a, b] = doorSpan(w, d);
    const at = wallFrame(w, (a + b) / 2).at;
    out.push({ id: `door-${d.id}`, name: d.entrance, x: at[0], z: at[1], facing: towards(at, centre), source: 'venue' });
  }

  // The template's own vomitories and aisles.
  for (const e of t.entrances?.(params, data) ?? []) out.push({ id: `stage-${e.key}`, name: named(`stage-${e.key}`, e.name), x: e.x, z: e.z, facing: e.facing, source: 'stage' });

  // House aisles, either side of front seating.
  const seats = t.seats?.(params, data) ?? [];
  if (t.audienceSides.includes('front') && seats.length) {
    const front = seats.filter((q) => q.z > z1 - 0.5);
    if (front.length) {
      const xs = front.map((q) => q.x);
      const zf = Math.min(...front.map((q) => q.z)) + 1.5;
      for (const [key, name, x] of [['house-left', 'House left aisle', Math.min(...xs) - 0.8], ['house-right', 'House right aisle', Math.max(...xs) + 0.8]] as const)
        out.push({ id: key, name: named(key, name), x, z: zf, facing: 180, source: 'house' });
    }
  }

  for (const e of blocking.entrances) out.push({ id: e.id, name: e.name, x: e.x, z: e.z, facing: e.facing, source: 'custom' });
  return out;
}
