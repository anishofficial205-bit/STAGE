/**
 * Where a dragged object should land. In priority order:
 *   1. hanging pieces → the nearest rigging line (template grids/truss, placed truss)
 *   2. steps and ramps → against a platform's edge, matching its height
 *   3. wall pieces → flat against a nearby wall surface
 *   4. smart guides → other objects' edges/centres and the stage edges/centre line
 *   5. otherwise → the floor grid
 */
import type { Params, StageInfo, Surface, Vec3 } from '../types';
import type { Pt } from '../helpers/shapes';
import { stageSnapLines } from '../helpers/stageInfo';
import { aabb, rotateXZ, unrotateXZ, worldHangLines, type Placed } from './geometry';

export interface SnapResult {
  x: number;
  z: number;
  rotation?: number;
  params?: Params;
  /** Thin guide lines to draw while snapping. */
  guides: [Vec3, Vec3][];
  /** Attached to a rigging line at this height (hanging pieces). */
  hangY?: number;
}

const SMART = 0.15; // metres: how close an edge/centre must be to snap
const HANG = 1.2; // metres: how close a rigging line must be (in plan) to attach

interface Input {
  moving: Placed;
  want: Pt;
  others: Placed[];
  info: StageInfo;
  walls: Surface[];
  grid: number;
  enabled: boolean;
}

function closestOnSegment(p: Pt, a: Pt, b: Pt): { point: Pt; dist: number; t: number } {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
  const point: Pt = [a[0] + dx * t, a[1] + dz * t];
  return { point, dist: Math.hypot(p[0] - point[0], p[1] - point[1]), t };
}

/** Rotation (deg) that lines an object's local X axis up with a direction, choosing the one nearest the current angle. */
function alignTo(dx: number, dz: number, current: number) {
  const base = (Math.atan2(-dz, dx) * 180) / Math.PI;
  const opts = [base, base + 180, base - 180, base + 360];
  return opts.reduce((best, o) => (Math.abs(o - current) < Math.abs(best - current) ? o : best));
}

function snapHanging({ moving, want, others, info }: Input): SnapResult | null {
  const lines: [Vec3, Vec3][] = [...(info.rigging ?? []), ...others.flatMap(worldHangLines)];
  let best: { point: Pt; dist: number; line: [Vec3, Vec3] } | null = null;
  for (const line of lines) {
    const c = closestOnSegment(want, [line[0][0], line[0][2]], [line[1][0], line[1][2]]);
    if (c.dist < HANG && (!best || c.dist < best.dist)) best = { point: c.point, dist: c.dist, line };
  }
  if (!best) return null;
  const [a, b] = best.line;
  return {
    x: best.point[0],
    z: best.point[1],
    rotation: alignTo(b[0] - a[0], b[2] - a[2], moving.obj.rotation),
    guides: [[a, b]],
    hangY: Math.max(a[1], b[1]),
  };
}

function snapToPlatform({ moving, want, others }: Input): SnapResult | null {
  const climbs = moving.type.climbs;
  if (!climbs) return null;
  const sd = moving.size.depth;
  const sw = moving.size.width;
  for (const p of others) {
    if (!p.type.platformTop) continue;
    const pw = p.size.width;
    const pd = p.size.depth;
    const [lx, lz] = unrotateXZ(want[0] - p.wx, want[1] - p.wz, p.obj.rotation);
    // Each platform edge: outward normal, half-length along the edge, distance from centre.
    const edges = [
      { n: [1, 0], half: pd / 2, at: pw / 2, along: lz },
      { n: [-1, 0], half: pd / 2, at: pw / 2, along: lz },
      { n: [0, 1], half: pw / 2, at: pd / 2, along: lx },
      { n: [0, -1], half: pw / 2, at: pd / 2, along: lx },
    ];
    for (const e of edges) {
      const out = lx * e.n[0] + lz * e.n[1] - e.at; // distance of the steps' centre beyond the edge
      if (out < -0.2 || out > sd / 2 + 0.5 || Math.abs(e.along) > e.half + 0.3) continue;
      const along = Math.max(-(e.half - sw / 2), Math.min(e.half - sw / 2, e.along));
      // Steps rise towards their local -Z, so that side faces the platform.
      const localCentre: Pt = e.n[0] !== 0 ? [e.n[0] * (e.at + sd / 2), along] : [along, e.n[1] * (e.at + sd / 2)];
      const [cx, cz] = rotateXZ(localCentre[0], localCentre[1], p.obj.rotation);
      const theta = (Math.atan2(e.n[0], e.n[1]) * 180) / Math.PI;
      const edgeA = rotateXZ(e.n[0] !== 0 ? e.n[0] * e.at : -e.half, e.n[0] !== 0 ? -e.half : e.n[1] * e.at, p.obj.rotation);
      const edgeB = rotateXZ(e.n[0] !== 0 ? e.n[0] * e.at : e.half, e.n[0] !== 0 ? e.half : e.n[1] * e.at, p.obj.rotation);
      const topY = p.baseY + p.type.platformTop(p.obj.params);
      const floorY = moving.baseY - moving.elevation;
      return {
        x: p.wx + cx,
        z: p.wz + cz,
        rotation: p.obj.rotation + theta,
        params: { [climbs.heightParam]: Math.max(0.05, +(topY - floorY).toFixed(3)) },
        guides: [[[p.wx + edgeA[0], topY + 0.01, p.wz + edgeA[1]], [p.wx + edgeB[0], topY + 0.01, p.wz + edgeB[1]]]],
      };
    }
  }
  return null;
}

function snapToWall({ moving, want, walls }: Input): SnapResult | null {
  if (moving.type.placement !== 'wall') return null;
  for (const s of walls) {
    if (Math.abs(s.rotation[0]) > 1e-3 || Math.abs(s.rotation[2]) > 1e-3) continue; // vertical surfaces only
    const ry = s.rotation[1];
    const n: Pt = [Math.sin(ry), Math.cos(ry)];
    const t: Pt = [Math.cos(ry), -Math.sin(ry)];
    const rel: Pt = [want[0] - s.position[0], want[1] - s.position[2]];
    const dist = rel[0] * n[0] + rel[1] * n[1];
    const along = rel[0] * t[0] + rel[1] * t[1];
    if (Math.abs(dist - moving.size.depth / 2) > 0.6 || Math.abs(along) > s.width / 2) continue;
    const off = moving.size.depth / 2 + 0.005;
    return { x: s.position[0] + t[0] * along + n[0] * off, z: s.position[2] + t[1] * along + n[1] * off, rotation: (ry * 180) / Math.PI, guides: [] };
  }
  return null;
}

function smartAndGrid({ moving, want, others, info, grid }: Input): SnapResult {
  const me = aabb({ ...moving, wx: want[0], wz: want[1] });
  const guides: [Vec3, Vec3][] = [];
  const y = moving.baseY - moving.elevation + 0.01;
  const stage = stageSnapLines(info);
  // Candidate lines with the span they cover (for drawing the guide).
  const xs: { v: number; span: [number, number] }[] = stage.xs.map((v) => ({ v, span: [stage.bounds[1], stage.bounds[3]] }));
  const zs: { v: number; span: [number, number] }[] = stage.zs.map((v) => ({ v, span: [stage.bounds[0], stage.bounds[2]] }));
  for (const o of others) {
    const b = aabb(o);
    for (const v of [b.minX, (b.minX + b.maxX) / 2, b.maxX]) xs.push({ v, span: [b.minZ, b.maxZ] });
    for (const v of [b.minZ, (b.minZ + b.maxZ) / 2, b.maxZ]) zs.push({ v, span: [b.minX, b.maxX] });
  }
  const axis = (mine: number[], cands: typeof xs) => {
    let best: { d: number; c: (typeof xs)[number] } | null = null;
    for (const m of mine) for (const c of cands) {
      const d = c.v - m;
      if (Math.abs(d) < SMART && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, c };
    }
    return best;
  };
  let x = want[0];
  let z = want[1];
  const bx = axis([me.minX, (me.minX + me.maxX) / 2, me.maxX], xs);
  const bz = axis([me.minZ, (me.minZ + me.maxZ) / 2, me.maxZ], zs);
  if (bx) {
    x += bx.d;
    guides.push([[bx.c.v, y, Math.min(bx.c.span[0], me.minZ) - 0.3], [bx.c.v, y, Math.max(bx.c.span[1], me.maxZ) + 0.3]]);
  } else x = Math.round(x / grid) * grid;
  if (bz) {
    z += bz.d;
    guides.push([[Math.min(bz.c.span[0], me.minX) - 0.3, y, bz.c.v], [Math.max(bz.c.span[1], me.maxX) + 0.3, y, bz.c.v]]);
  } else z = Math.round(z / grid) * grid;
  return { x, z, guides };
}

export function snapMove(input: Input): SnapResult {
  if (!input.enabled) return { x: input.want[0], z: input.want[1], guides: [] };
  if (input.moving.type.placement === 'hanging') return snapHanging(input) ?? smartAndGrid(input);
  return snapToPlatform(input) ?? snapToWall(input) ?? smartAndGrid(input);
}
