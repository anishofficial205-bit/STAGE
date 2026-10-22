/**
 * Where every performer is at a moment in a scene. A path starts wherever its
 * performer is when it begins, runs smoothly (Catmull-Rom) through its points,
 * pauses at stops, and — if it ends at an entrance — takes them off stage.
 */
import * as THREE from 'three';
import { SPEEDS, type Blocking, type Path, type Performer, type Pt, type Scene, type StartState } from './types';
import type { Entrance } from './entrances';

export interface Pose {
  x: number;
  z: number;
  facing: number;
  onStage: boolean;
  moving: boolean;
  /** The entrance an off-stage performer waits at. */
  entrance?: string;
}

/** A path laid out in space and time. */
export interface Track {
  path: Path;
  /** Points the curve goes through: the start, the path points, the exit. */
  control: Pt[];
  /** Sampled curve and arc length at each sample. */
  samples: Pt[];
  dist: number[];
  length: number;
  /** Arc length at each control point. */
  at: number[];
  /** Movement speed (m/s) and total duration (s, holds included). */
  speed: number;
  duration: number;
  holds: { s: number; hold: number }[];
}

const M = 24;

export function layoutPath(path: Path, from: Pt, entrances: Map<string, Entrance>): Track {
  const exit = path.exit ? entrances.get(path.exit) : undefined;
  const control: Pt[] = [from, ...path.points, ...(exit ? [[exit.x, exit.z] as Pt] : [])].filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-3);
  let samples: Pt[];
  if (control.length < 3) samples = control.length === 2 ? Array.from({ length: M + 1 }, (_, k) => [control[0][0] + ((control[1][0] - control[0][0]) * k) / M, control[0][1] + ((control[1][1] - control[0][1]) * k) / M] as Pt) : [control[0]];
  else {
    const curve = new THREE.CatmullRomCurve3(control.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const n = (control.length - 1) * M;
    samples = Array.from({ length: n + 1 }, (_, k) => {
      const v = curve.getPoint(k / n);
      return [v.x, v.z] as Pt;
    });
  }
  const dist = [0];
  for (let k = 1; k < samples.length; k++) dist.push(dist[k - 1] + Math.hypot(samples[k][0] - samples[k - 1][0], samples[k][1] - samples[k - 1][1]));
  const length = dist[dist.length - 1];
  const at = control.map((_, i) => dist[Math.min(dist.length - 1, i * M)] ?? length);
  // Stops refer to path points, which are control points 1..n.
  const holds = path.stops.filter((s) => s.index >= 0 && s.index < path.points.length && s.hold > 0).map((s) => ({ s: at[s.index + 1] ?? length, hold: s.hold })).sort((a, b) => a.s - b.s);
  const held = holds.reduce((t, h) => t + h.hold, 0);
  let speed: number;
  if (path.timing === 'duration') speed = length / Math.max(0.2, path.duration - held);
  else speed = SPEEDS[path.speed].mps;
  const duration = (speed > 0 ? length / speed : 0) + held;
  return { path, control, samples, dist, length, at, speed, duration, holds };
}

/** Distance along the track after `tau` seconds of it. */
function distanceAt(tr: Track, tau: number) {
  let t = tau;
  let s = 0;
  for (const h of tr.holds) {
    const travel = (h.s - s) / tr.speed;
    if (t <= travel) return { s: s + t * tr.speed, holding: false };
    t -= travel;
    s = h.s;
    if (t <= h.hold) return { s, holding: true };
    t -= h.hold;
  }
  return { s: Math.min(tr.length, s + t * tr.speed), holding: false };
}

function pointAt(tr: Track, s: number): { p: Pt; dir: number | null } {
  const d = tr.dist;
  let k = 1;
  while (k < d.length - 1 && d[k] < s) k++;
  const a = tr.samples[k - 1];
  const b = tr.samples[k] ?? a;
  const seg = d[k] - d[k - 1] || 1;
  const f = Math.max(0, Math.min(1, (s - d[k - 1]) / seg));
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return { p: [a[0] + dx * f, a[1] + dz * f], dir: Math.hypot(dx, dz) > 1e-6 ? (Math.atan2(dx, dz) * 180) / Math.PI : null };
}

const defaultStart = (i: number): StartState => ({ x: (i % 6) * 1.2 - 3, z: Math.floor(i / 6) * 1.2, facing: 0, onStage: true });

/** Each performer's tracks in a scene (paths laid out from where they'll be), and their start. */
export function sceneTracks(scene: Scene, performers: Performer[], entrances: Map<string, Entrance>, fallbackCentre: Pt = [0, 0]) {
  const out = new Map<string, { start: StartState; tracks: Track[] }>();
  performers.forEach((perf, i) => {
    const st0 = scene.start[perf.id] ?? { ...defaultStart(i), x: defaultStart(i).x + fallbackCentre[0], z: defaultStart(i).z + fallbackCentre[1] };
    const ent = !st0.onStage && st0.entrance ? entrances.get(st0.entrance) : undefined;
    let pos: Pt = ent ? [ent.x, ent.z] : [st0.x, st0.z];
    const tracks: Track[] = [];
    for (const path of scene.paths.filter((p) => p.performerId === perf.id).sort((a, b) => a.start - b.start)) {
      const tr = layoutPath(path, pos, entrances);
      tracks.push(tr);
      pos = tr.samples[tr.samples.length - 1];
    }
    out.set(perf.id, { start: st0, tracks });
  });
  return out;
}

/** A performer's pose at time t. */
export function poseAt(start: StartState, tracks: Track[], entrances: Map<string, Entrance>, t: number): Pose {
  const ent0 = !start.onStage && start.entrance ? entrances.get(start.entrance) : undefined;
  let pose: Pose = ent0 ? { x: ent0.x, z: ent0.z, facing: ent0.facing, onStage: false, moving: false, entrance: ent0.id } : { x: start.x, z: start.z, facing: start.facing, onStage: start.onStage, moving: false };
  for (const tr of tracks) {
    if (t < tr.path.start) break;
    const tau = t - tr.path.start;
    if (tau < tr.duration) {
      const { s, holding } = distanceAt(tr, tau);
      const { p, dir } = pointAt(tr, s);
      return { x: p[0], z: p[1], facing: dir ?? pose.facing, onStage: true, moving: !holding };
    }
    const end = pointAt(tr, tr.length);
    const exit = tr.path.exit ? entrances.get(tr.path.exit) : undefined;
    pose = { x: end.p[0], z: end.p[1], facing: end.dir ?? pose.facing, onStage: !exit, moving: false, ...(exit ? { entrance: exit.id, facing: exit.facing } : {}) };
  }
  return pose;
}

/** Length of a scene: until the last move ends, plus a moment (at least 10 s). */
export function sceneDuration(tracks: Map<string, { tracks: Track[] }>) {
  let end = 0;
  for (const { tracks: ts } of tracks.values()) for (const tr of ts) end = Math.max(end, tr.path.start + tr.duration);
  return Math.max(10, Math.ceil(end + 1));
}

/** Every performer's pose at the end of a scene: the next scene starts from here. */
export function endStates(scene: Scene, b: Blocking, entrances: Map<string, Entrance>): Record<string, StartState> {
  const tracks = sceneTracks(scene, b.performers, entrances);
  return Object.fromEntries(
    [...tracks.entries()].map(([id, { start, tracks: ts }]) => {
      const p = poseAt(start, ts, entrances, Infinity);
      return [id, { x: p.x, z: p.z, facing: p.facing, onStage: p.onStage, ...(p.entrance ? { entrance: p.entrance } : {}) }];
    }),
  );
}
