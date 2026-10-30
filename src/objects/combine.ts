/**
 * Combined pieces (pathfinder): two or more set pieces joined into one shape —
 * Add (union), Subtract (the others cut into the first), Intersect (only the
 * overlap) or Exclude (everything but the overlap).
 *
 * A combined piece is a group whose `params.combine` names the operation, so its
 * pieces stay real, editable objects (pick one in Layers to change its size or
 * move it) and Release turns them back into separate pieces. In the view the
 * pieces themselves are drawn on a hidden layer — still there to click and drag
 * — and the result of the operation is drawn in their place (Combined.tsx).
 */
import { GROUP_TYPE, type SetObject } from './types';
import { groupUnits, isGroup, leafIds, ungroupUnits, unitsOf } from './groups';

export type CombineOp = 'add' | 'subtract' | 'intersect' | 'exclude';

export const COMBINE_OPS: { id: CombineOp; label: string; help: string; icon: string }[] = [
  { id: 'add', label: 'Add', help: 'Join them into one shape', icon: 'M4 4h10v6h6v10H10v-6H4z' },
  { id: 'subtract', label: 'Subtract', help: 'Cut the others out of the first piece', icon: 'M4 4h10v6H10v4H4zM10 10h10v10H10z' },
  { id: 'intersect', label: 'Intersect', help: 'Keep only where they overlap', icon: 'M10 10h4v4h-4zM4 4h10v10H4zM10 10h10v10H10z' },
  { id: 'exclude', label: 'Exclude', help: 'Keep everything but the overlap', icon: 'M4 4h10v6h-4v4H4zM14 10h6v10H10v-6h4z' },
];

/** Pieces that aren't solid can't be combined: fabric, people, lights. */
const NOT_SOLID = new Set(['main-curtain', 'traveler', 'leg', 'border', 'valance', 'scrim', 'cyc-cloth', 'person-standing', 'person-seated', 'fixture']);
export const canCombine = (o: SetObject) => !NOT_SOLID.has(o.type) && !isGroup(o);

export const combineOf = (o: SetObject | undefined): CombineOp | null => (o && isGroup(o) && typeof o.params.combine === 'string' ? (o.params.combine as CombineOp) : null);

/** The combined piece a leaf belongs to (the nearest one up its groups), if any. */
export function combinedParent(o: SetObject, list: SetObject[]): SetObject | undefined {
  const map = new Map(list.map((x) => [x.id, x]));
  for (let p = o.parent ? map.get(o.parent) : undefined; p; p = p.parent ? map.get(p.parent) : undefined) if (combineOf(p)) return p;
  return undefined;
}

function nextName(list: SetObject[]) {
  const n = list.filter((o) => combineOf(o)).map((g) => Number(g.name.match(/^Combined (\d+)$/)?.[1] ?? 0));
  return `Combined ${Math.max(0, ...n) + 1}`;
}

/** Combine the selection's top-level pieces. The first one picked is the one others cut into. */
export function combineList(list: SetObject[], selected: string[], op: CombineOp): { list: SetObject[]; id: string | null } {
  const units = unitsOf(selected, list);
  if (units.length < 2) return { list, id: null };
  const firstUnit = unitsOf([selected[0]], list)[0];
  const { list: grouped, groupId } = groupUnits(list, selected, nextName(list));
  if (!groupId) return { list, id: null };
  return { list: grouped.map((o) => (o.id === groupId ? { ...o, params: { combine: op, base: firstUnit } } : o)), id: groupId };
}

/** Release a combined piece: its pieces become separate again. */
export function releaseList(list: SetObject[], groupId: string): SetObject[] {
  const g = list.find((o) => o.id === groupId);
  if (!g) return list;
  return ungroupUnits(list, leafIds(groupId, list));
}

/** Group a list's combined pieces: for each, its units and their leaves (for Combined's `version`). */
export function combinedGroups(list: SetObject[]) {
  return list
    .filter((g) => g.type === GROUP_TYPE && combineOf(g) && !list.some((p) => p.id === g.parent && combineOf(p)))
    .map((g) => {
      const units = list.filter((o) => o.parent === g.id).map((u) => [u.id, leafIds(u.id, list)] as [string, string[]]);
      const base = typeof g.params.base === 'string' && units.some(([u]) => u === g.params.base) ? (g.params.base as string) : units[0]?.[0] ?? '';
      return { group: g, base, units, leaves: units.flatMap(([, l]) => l) };
    });
}
