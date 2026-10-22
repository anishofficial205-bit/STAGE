/**
 * Blocking checks, using the sightline maths: seats look at performers'
 * heads and chests and we see what's in the way.
 *  - Seen in the wings: someone waiting off stage (or walking off) that seats can see.
 *  - Hidden on stage: someone the set hides from more than a share of the seats.
 *  - Collisions: two performers within 0.5 m at the same moment.
 *  - Upstaged (optional): someone with their back to most of the audience for a while.
 */
import * as THREE from 'three';
import { getTemplate } from '../templates/registry';
import { getStageInfo, pointInPolygon } from '../helpers/stageInfo';
import { useProjectStore } from '../store/useProjectStore';
import { collectOccluders, eyeOf } from '../sightlines/compute';
import type { SeatInfo, Vec3 } from '../types';
import { computeEntrances } from './entrances';
import { poseAt, sceneDuration, sceneTracks, type Pose } from './motion';
import { actingCentre } from './actions';
import type { Blocking } from './types';
import type { BlockingWarning } from './ui';

const ray = new THREE.Raycaster();
const from = new THREE.Vector3();
const dir = new THREE.Vector3();

function blockedBy(eye: Vec3, target: Vec3, meshes: THREE.Mesh[]) {
  from.set(...eye);
  dir.set(target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]);
  const d = dir.length();
  ray.set(from, dir.normalize());
  ray.near = 0.3;
  ray.far = d - 0.15;
  return ray.intersectObjects(meshes, false)[0] ?? null;
}

const isOurs = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.blockingHelper || p.userData.lightHelper || p.userData.venueRoom) return true;
  return false;
};
const setPiece = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.objectId) return true;
  return false;
};

/** An even spread of seats (at most `n`). */
function sampleSeats(seats: SeatInfo[], n: number) {
  if (seats.length <= n) return seats;
  const step = seats.length / n;
  return Array.from({ length: n }, (_, i) => seats[Math.floor(i * step)]);
}

/** A stable fingerprint of what the checks depend on, to tell when results are out of date. */
export const checksKey = (b: Blocking) => JSON.stringify([b.performers, b.scenes.find((s) => s.id === b.sceneId), b.checks, useProjectStore.getState().objectsByTemplate[useProjectStore.getState().templateId]]);

export async function runChecks(scene3d: THREE.Scene, onProgress: (p: number) => void): Promise<BlockingWarning[]> {
  const s = useProjectStore.getState();
  const b = s.blockingByTemplate[s.templateId];
  const t = getTemplate(s.templateId)!;
  if (!b) return [];
  const params = s.paramsByTemplate[s.templateId];
  const data = s.dataByTemplate[s.templateId];
  const info = getStageInfo(t, params, data);
  const raised = info.floors.filter((f) => f.height > 0.01);
  const floors = raised.length ? raised : info.floors;
  const onFloor = (x: number, z: number) => floors.some((f) => pointInPolygon([x, z], f.outline));
  const floorY = (x: number, z: number) => Math.max(0, ...floors.filter((f) => pointInPolygon([x, z], f.outline)).map((f) => f.height));
  const seats = sampleSeats(t.seats?.(params, data) ?? [], 60);
  const meshes = collectOccluders(scene3d).filter((m) => !isOurs(m));
  const scene = b.scenes.find((x) => x.id === b.sceneId) ?? b.scenes[0];
  const ents = new Map(computeEntrances(s, b).map((e) => [e.id, e]));
  const tracks = sceneTracks(scene, b.performers, ents, actingCentre());
  const duration = sceneDuration(tracks);
  const perf = b.performers.filter((p) => !p.hidden);
  const poses = (time: number) => new Map(perf.map((p) => [p.id, poseAt(tracks.get(p.id)!.start, tracks.get(p.id)!.tracks, ents, time)] as [string, Pose]));
  const audience: [number, number] = seats.length ? [seats.reduce((a, q) => a + q.x, 0) / seats.length, seats.reduce((a, q) => a + q.z, 0) / seats.length] : [0, 10];

  // Open intervals per (kind, performers) key, closed when the condition stops.
  const open = new Map<string, BlockingWarning>();
  const done: BlockingWarning[] = [];
  const hit = (key: string, w: Omit<BlockingWarning, 'id' | 'until'>, time: number) => {
    const cur = open.get(key);
    if (cur) {
      cur.until = time;
      if ((w.seats?.length ?? 0) > (cur.seats?.length ?? 0)) cur.seats = w.seats;
    } else open.set(key, { ...w, id: `${key}@${time}`, until: time });
  };
  const close = (seen: Set<string>) => {
    for (const [k, w] of open) if (!seen.has(k)) (done.push(w), open.delete(k));
  };

  const STEP = 0.5;
  const facingAway = new Map<string, number>();
  for (let time = 0, i = 0; time <= duration + 1e-6; time += STEP, i++) {
    const seen = new Set<string>();
    const ps = poses(time);
    for (const p of perf) {
      const pose = ps.get(p.id)!;
      const scale = p.height / 1.7;
      const y = floorY(pose.x, pose.z);
      const head: Vec3 = [pose.x, y + 1.55 * scale, pose.z];
      const chest: Vec3 = [pose.x, y + 1.15 * scale, pose.z];
      const offStage = !pose.onStage || !onFloor(pose.x, pose.z);
      if (offStage && seats.length) {
        // Visible from the house while off stage?
        const see = seats.filter((q) => !blockedBy(eyeOf(q), head, meshes) || !blockedBy(eyeOf(q), chest, meshes));
        if (see.length) {
          const where = pose.entrance ? ents.get(pose.entrance)?.name : 'off stage';
          const key = `wings:${p.id}`;
          seen.add(key);
          hit(key, { kind: 'wings', time, performerIds: [p.id], text: `${p.name} can be seen ${pose.onStage ? 'walking off' : `waiting at ${where}`} from ${see.length} of ${seats.length} sample seats`, seats: see }, time);
        }
      } else if (seats.length) {
        // Hidden by the set?
        const hidden = seats.filter((q) => {
          const h = blockedBy(eyeOf(q), chest, meshes);
          return h && setPiece(h.object) && blockedBy(eyeOf(q), head, meshes);
        });
        const share = (hidden.length / seats.length) * 100;
        if (share > b.checks.hiddenShare) {
          const key = `hidden:${p.id}`;
          seen.add(key);
          hit(key, { kind: 'hidden', time, performerIds: [p.id], text: `${p.name} is hidden by the set from ${Math.round(share)}% of seats`, seats: hidden }, time);
        }
      }
      if (b.checks.upstaged && pose.onStage && onFloor(pose.x, pose.z)) {
        const toward = (Math.atan2(audience[0] - pose.x, audience[1] - pose.z) * 180) / Math.PI;
        const diff = Math.abs(((pose.facing - toward + 540) % 360) - 180);
        const since = diff > 120 ? (facingAway.get(p.id) ?? time) : -1;
        if (since >= 0) facingAway.set(p.id, since);
        else facingAway.delete(p.id);
        if (since >= 0 && time - since >= 5) {
          const key = `upstaged:${p.id}`;
          seen.add(key);
          hit(key, { kind: 'upstaged', time: since, performerIds: [p.id], text: `${p.name} has their back to the audience` }, time);
        }
      }
    }
    // Collisions between performers on stage.
    for (let a = 0; a < perf.length; a++)
      for (let c = a + 1; c < perf.length; c++) {
        const pa = ps.get(perf[a].id)!;
        const pc = ps.get(perf[c].id)!;
        if (!pa.onStage || !pc.onStage || (!pa.moving && !pc.moving)) continue;
        if (Math.hypot(pa.x - pc.x, pa.z - pc.z) < 0.5) {
          const key = `collision:${perf[a].id}:${perf[c].id}`;
          seen.add(key);
          hit(key, { kind: 'collision', time, performerIds: [perf[a].id, perf[c].id], text: `${perf[a].name} and ${perf[c].name} come within 0.5 m` }, time);
        }
      }
    close(seen);
    onProgress(time / duration);
    await new Promise((r) => setTimeout(r, 0));
  }
  close(new Set());
  return done.sort((x, y) => x.time - y.time);
}
