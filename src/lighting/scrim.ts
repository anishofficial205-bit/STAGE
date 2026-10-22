/**
 * Scrims follow the lighting: they read as solid when the light on their front
 * is brighter than the light on the scene behind them, and see-through the
 * other way round. We estimate both from the lights' positions and aims.
 */
import { useMemo } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { getStageInfo } from '../helpers/stageInfo';
import { place } from '../objects/geometry';
import { useLightsUI } from './ui';
import { emptyLighting, type Fixture } from './types';

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Light on the scrim's front and on the scene behind it. A light in front whose
 * beam lands on the cloth lights the front; a light behind the scrim (or one in
 * front aimed at something behind it, passing through) lights the scene behind.
 */
export function scrimLight(fixtures: Fixture[], c: { x: number; y: number; z: number; rot: number; w: number; h: number }) {
  // Scrim frame: front faces +z rotated by `rot` degrees about y.
  const t = rad(c.rot);
  const n = [Math.sin(t), 0, Math.cos(t)];
  const u = [Math.cos(t), 0, -Math.sin(t)];
  const side = (p: number[]) => (p[0] - c.x) * n[0] + (p[2] - c.z) * n[2];
  let front = 0;
  let back = 0;
  for (const f of fixtures) {
    if (!f.on || f.intensity <= 0 || f.type === 'house' || f.type === 'practical') {
      if (f.type === 'practical' && f.on && side(f.pos) < 0) back += f.intensity * 0.5;
      continue;
    }
    const s0 = side(f.pos);
    const s1 = side(f.target);
    const level = f.intensity * (f.type === 'cyc' ? 0.8 : 1);
    if (s0 >= 0 && s1 < 0) {
      // Through the cloth: where does the beam cross it?
      const k = s0 / (s0 - s1);
      const hit = [f.pos[0] + (f.target[0] - f.pos[0]) * k, f.pos[1] + (f.target[1] - f.pos[1]) * k, f.pos[2] + (f.target[2] - f.pos[2]) * k];
      const across = Math.abs((hit[0] - c.x) * u[0] + (hit[2] - c.z) * u[2]);
      if (across <= c.w / 2 + 1 && hit[1] >= c.y - 0.5 && hit[1] <= c.y + c.h + 0.5) front += level;
      else back += level * 0.6;
    } else if (s0 >= 0) {
      // Front light landing in front of the scrim: some spill reaches it.
      const reach = Math.hypot(f.target[0] - f.pos[0], f.target[2] - f.pos[2]) * Math.tan(rad(f.beam) / 2);
      if (Math.abs(s1) < reach + 1.5) front += level * 0.5;
    } else back += level;
  }
  return { front, back };
}

/** Transparency (%) a following scrim shows now, or null when it isn't following / no lights are on. */
export function useScrimTransparency(objectId: string | undefined, follow: boolean): number | null {
  const s = useProjectStore();
  const live = useLightsUI((x) => x.live);
  return useMemo(() => {
    if (!follow || !objectId) return null;
    const lighting = s.lightingByTemplate[s.templateId] ?? emptyLighting();
    const fixtures = live ? lighting.fixtures.map((f) => (live.states[f.id] ? { ...f, ...live.states[f.id] } : f)) : lighting.fixtures;
    const obj = (s.objectsByTemplate[s.templateId] ?? []).find((o) => o.id === objectId);
    const t = getTemplate(s.templateId);
    if (!obj || !t) return null;
    const p = place(obj, getStageInfo(t, s.paramsByTemplate[s.templateId], s.dataByTemplate[s.templateId]));
    if (!p) return null;
    const { front, back } = scrimLight(fixtures, { x: p.wx, y: p.baseY, z: p.wz, rot: obj.rotation, w: p.size.width, h: p.size.height });
    if (front + back < 1) return null;
    // Mostly lit from the front → nearly solid (8%); mostly from behind → see-through (90%).
    return Math.round(8 + 82 * (back / (front + back)));
  }, [follow, objectId, s.lightingByTemplate, s.templateId, s.objectsByTemplate, s.paramsByTemplate, s.dataByTemplate, live]);
}
