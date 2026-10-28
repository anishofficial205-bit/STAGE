/**
 * Lights that follow a performer: their aim is the performer's chest at the
 * current moment of the scene (worked out live, not saved), so the beam moves
 * with them as the scene plays.
 */
import { useMemo } from 'react';
import { useActiveBlocking } from '../store/useProjectStore';
import { useBlockingUI } from '../blocking/ui';
import { blocking, posesAt } from '../blocking/actions';
import { currentStage } from '../objects/actions';
import { floorHeightAt } from '../helpers/stageInfo';
import type { Fixture, Vec3 } from './types';
import type { Blocking } from '../blocking/types';

/** Height of the aim above the floor for a performer of this height and posture. */
const chest = (h: number, posture: string) => h * (posture === 'lying' ? 0.15 : posture === 'sitting' ? 0.45 : 0.7);

/** Where to aim at each performer at time `t`: performer id → aim point. */
export function aimPoints(t = useBlockingUI.getState().time, b: Blocking = blocking()): Map<string, Vec3> {
  const poses = posesAt(t, b);
  const { info } = currentStage();
  const out = new Map<string, Vec3>();
  for (const p of b.performers) {
    const pose = poses.get(p.id);
    if (pose) out.set(p.id, [pose.x, floorHeightAt(info, pose.x, pose.z) + chest(p.height, p.posture), pose.z]);
  }
  return out;
}

/** Where each followed performer is right now (null when no light follows anyone). */
export function useFollowTargets(fixtures: Fixture[]): Map<string, Vec3> | null {
  const any = fixtures.some((f) => f.follow);
  const b = useActiveBlocking();
  const time = useBlockingUI((s) => (any ? s.time : 0));
  return useMemo(() => (any ? aimPoints(time, b) : null), [any, b, time]);
}

/** The performer standing nearest `at` (within `reach` metres), at the current moment. */
export function performerNear(at: Vec3, reach = 0.7): string | null {
  const b = blocking();
  const poses = posesAt(useBlockingUI.getState().time, b);
  let best: { id: string; d: number } | null = null;
  for (const p of b.performers) {
    const pose = poses.get(p.id);
    if (!pose || !pose.onStage) continue;
    const d = Math.hypot(pose.x - at[0], pose.z - at[2]);
    if (d < reach && (!best || d < best.d)) best = { id: p.id, d };
  }
  return best?.id ?? null;
}
