/**
 * Arranging several objects at once: rotate the selection, align,
 * distribute, flip, mirror-copy and array. Each works on top-level units, so
 * a group behaves as one piece.
 */
import { useProjectStore } from '../store/useProjectStore';
import type { Pt } from '../helpers/shapes';
import { aabb, place, rotateXZ } from './geometry';
import { currentStage } from './actions';
import { copyUnits, groupUnits, leafIds, unitsOf } from './groups';
import type { SetObject } from './types';

const activeList = () => {
  const s = useProjectStore.getState();
  return s.objectsByTemplate[s.templateId] ?? [];
};

/** World bounding box of a set of leaf objects. */
export function boxOf(ids: string[], list: SetObject[] = activeList()) {
  const { info } = currentStage();
  let b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const id of ids) {
    const o = list.find((x) => x.id === id);
    const p = o && place(o, info);
    if (!p) continue;
    const a = aabb(p);
    b = { minX: Math.min(b.minX, a.minX), maxX: Math.max(b.maxX, a.maxX), minZ: Math.min(b.minZ, a.minZ), maxZ: Math.max(b.maxZ, a.maxZ) };
  }
  return { ...b, cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2 };
}

/** Rotate a leaf about a world pivot by `deg` (position and heading). */
function rotateAbout(o: SetObject, pivot: Pt, deg: number, centre: Pt): SetObject {
  const [rx, rz] = rotateXZ(centre[0] + o.x - pivot[0], centre[1] + o.z - pivot[1], deg);
  return { ...o, x: pivot[0] + rx - centre[0], z: pivot[1] + rz - centre[1], rotation: o.rotation + deg };
}

/** Rotate the given leaves (from their start state) around a pivot; used by the selection rotate handle. */
export function rotateSelection(starts: SetObject[], pivot: Pt, deg: number, key: string) {
  const { info } = currentStage();
  const byId = new Map(starts.map((o) => [o.id, o]));
  useProjectStore.getState().updateObjects((list) => list.map((o) => (byId.has(o.id) ? rotateAbout(byId.get(o.id)!, pivot, deg, info.centre) : o)), key);
}

/** Units of the current selection with their leaves and bounding boxes. */
function selectedUnits() {
  const s = useProjectStore.getState();
  const list = activeList();
  return unitsOf(s.selectedIds, list).map((id) => {
    const leaves = leafIds(id, list);
    return { id, leaves, box: boxOf(leaves, list) };
  });
}

function shiftUnits(moves: Map<string, [number, number]>, label: string) {
  useProjectStore.getState().updateObjects((list) => {
    const delta = new Map<string, [number, number]>();
    for (const [unit, d] of moves) for (const leaf of leafIds(unit, list)) delta.set(leaf, d);
    return list.map((o) => (delta.has(o.id) ? { ...o, x: o.x + delta.get(o.id)![0], z: o.z + delta.get(o.id)![1] } : o));
  }, label);
}

export type AlignMode = 'left' | 'centre' | 'right' | 'back' | 'middle' | 'front';

/** Align units to the selection's bounds. "Front" is downstage (+Z), "back" upstage. */
export function align(mode: AlignMode) {
  const units = selectedUnits();
  if (units.length < 2) return;
  const all = boxOf(units.flatMap((u) => u.leaves));
  const moves = new Map<string, [number, number]>();
  for (const u of units) {
    const b = u.box;
    const dx = mode === 'left' ? all.minX - b.minX : mode === 'right' ? all.maxX - b.maxX : mode === 'centre' ? all.cx - b.cx : 0;
    const dz = mode === 'back' ? all.minZ - b.minZ : mode === 'front' ? all.maxZ - b.maxZ : mode === 'middle' ? all.cz - b.cz : 0;
    moves.set(u.id, [dx, dz]);
  }
  shiftUnits(moves, `align-${mode}`);
}

/** Spread units so the gaps between them are equal across the width (x) or depth (z). */
export function distribute(axis: 'x' | 'z') {
  const units = selectedUnits();
  if (units.length < 3) return;
  const lo = (u: (typeof units)[number]) => (axis === 'x' ? u.box.minX : u.box.minZ);
  const hi = (u: (typeof units)[number]) => (axis === 'x' ? u.box.maxX : u.box.maxZ);
  const sorted = [...units].sort((a, b) => lo(a) + hi(a) - (lo(b) + hi(b)));
  const span = hi(sorted[sorted.length - 1]) - lo(sorted[0]);
  const used = sorted.reduce((s, u) => s + hi(u) - lo(u), 0);
  const gap = (span - used) / (sorted.length - 1);
  const moves = new Map<string, [number, number]>();
  let at = lo(sorted[0]);
  for (const u of sorted) {
    const d = at - lo(u);
    moves.set(u.id, axis === 'x' ? [d, 0] : [0, d]);
    at += hi(u) - lo(u) + gap;
  }
  shiftUnits(moves, `distribute-${axis}`);
}

const mirrorLeaf = (o: SetObject, axisX: number, centreX: number): SetObject => ({
  ...o,
  x: 2 * (axisX - centreX) - o.x,
  rotation: -o.rotation,
});

/** Flip the selection left–right about its own centre. */
export function flipSelection() {
  const s = useProjectStore.getState();
  const { info } = currentStage();
  const ids = new Set(s.selectedIds);
  if (!ids.size) return;
  const b = boxOf([...ids]);
  s.updateObjects((list) => list.map((o) => (ids.has(o.id) ? mirrorLeaf(o, b.cx, info.centre[0]) : o)));
}

/** Copy the selection mirrored across the stage's centre line (for symmetrical sets). */
export function mirrorCopy() {
  const s = useProjectStore.getState();
  const { info } = currentStage();
  const list = activeList();
  const units = unitsOf(s.selectedIds, list);
  if (!units.length) return;
  const { list: next, leaves } = copyUnits(list, units, (o) => mirrorLeaf(o, info.centre[0], info.centre[0]), (o) => `${o.name} (mirror)`);
  s.updateObjects(() => next);
  s.select(leaves);
}

export interface ArrayOptions {
  mode: 'line' | 'arc';
  count: number;
  /** Line: centre-to-centre spacing, and direction (across the stage or up/downstage). */
  spacing: number;
  direction: 'x' | 'z';
  /** Arc: radius to the arc's centre (in front of the piece) and total angle. */
  radius: number;
  angle: number;
}

/**
 * Repeat the selected unit so there are `count` in total, in a line or an
 * arc, and group them so the array moves as one.
 */
export function makeArray(opts: ArrayOptions) {
  const s = useProjectStore.getState();
  const { info } = currentStage();
  const list = activeList();
  const units = unitsOf(s.selectedIds, list);
  if (units.length !== 1 || opts.count < 2) return;
  const unit = units[0];
  const leaves = leafIds(unit, list);
  const box = boxOf(leaves, list);
  const single = leaves.length === 1 ? list.find((o) => o.id === leaves[0])! : null;
  // An arc curves round a centre in front of the piece (towards the audience for an unrotated piece).
  const front = single ? rotateXZ(0, 1, single.rotation) : ([0, 1] as Pt);
  const pivot: Pt = [box.cx + front[0] * opts.radius, box.cz + front[1] * opts.radius];
  const step = opts.angle / (opts.count - 1);
  // An arc is centred on the original piece: angles run from -angle/2 to +angle/2.
  const arcAngle = (k: number) => (k - (opts.count - 1) / 2) * step;
  let next = list;
  if (opts.mode === 'arc') {
    const leafSet = new Set(leaves);
    next = next.map((o) => (leafSet.has(o.id) ? rotateAbout(o, pivot, -arcAngle(0), info.centre) : o));
  }
  const copies: string[] = [];
  for (let k = 1; k < opts.count; k++) {
    const r = copyUnits(next, [unit], (o) => {
      if (opts.mode === 'line') return { ...o, x: o.x + (opts.direction === 'x' ? k * opts.spacing : 0), z: o.z + (opts.direction === 'z' ? k * opts.spacing : 0) };
      return rotateAbout(o, pivot, -k * step, info.centre);
    }, (o) => `${o.name.replace(/ \d+$/, '')} ${k + 1}`);
    next = r.list;
    copies.push(...r.tops);
  }
  const grouped = groupUnits(next, [...leaves, ...copies.flatMap((c) => leafIds(c, next))], `Array of ${opts.count}`);
  s.updateObjects(() => grouped.list);
  s.select(grouped.groupId ? leafIds(grouped.groupId, grouped.list) : leaves);
}
