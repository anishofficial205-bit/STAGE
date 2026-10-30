/**
 * Grouping. A group is an entry in the object list with type GROUP_TYPE;
 * members point to it with `parent`. Groups can nest. Selection always holds
 * real (leaf) objects: selecting a group selects every object inside it.
 * A "unit" is a top-level item: a loose object or a whole top-level group.
 */
import { newObjectId } from '../store/ids';
import { GROUP_TYPE, type SetObject } from './types';

export const isGroup = (o: SetObject) => o.type === GROUP_TYPE;

const byId = (list: SetObject[]) => new Map(list.map((o) => [o.id, o]));

/** The outermost group containing `id` (or the object itself when it isn't grouped). */
export function topAncestor(id: string, list: SetObject[]): string {
  const map = byId(list);
  let cur = map.get(id);
  while (cur?.parent && map.has(cur.parent)) cur = map.get(cur.parent);
  return cur?.id ?? id;
}

/** All real objects inside a group (recursively), or [id] for an object. */
export function leafIds(id: string, list: SetObject[]): string[] {
  const o = list.find((x) => x.id === id);
  if (!o) return [];
  if (!isGroup(o)) return [id];
  return list.filter((c) => c.parent === id).flatMap((c) => leafIds(c.id, list));
}

/** Top-level units covering a set of leaf ids, in list order. */
export function unitsOf(ids: string[], list: SetObject[]): string[] {
  const tops = new Set(ids.map((id) => topAncestor(id, list)));
  return list.filter((o) => tops.has(o.id)).map((o) => o.id);
}

/** Hidden or locked if the object or any group it sits in is. */
export function inherited(o: SetObject, list: SetObject[], flag: 'hidden' | 'locked'): boolean {
  const map = byId(list);
  for (let cur: SetObject | undefined = o; cur; cur = cur.parent ? map.get(cur.parent) : undefined) if (cur[flag]) return true;
  return false;
}

/** Remove groups that no longer contain anything. */
export function pruneGroups(list: SetObject[]): SetObject[] {
  let out = list;
  for (;;) {
    const empty = out.filter((g) => isGroup(g) && !out.some((c) => c.parent === g.id));
    if (!empty.length) return out;
    const gone = new Set(empty.map((g) => g.id));
    out = out.filter((o) => !gone.has(o.id));
  }
}

function nextGroupName(list: SetObject[]) {
  const n = list.filter(isGroup).map((g) => Number(g.name.match(/^Group (\d+)$/)?.[1] ?? 0));
  return `Group ${Math.max(0, ...n) + 1}`;
}

/** Wrap the units of the selected objects in a new group. */
export function groupUnits(list: SetObject[], selected: string[], name?: string): { list: SetObject[]; groupId: string | null } {
  const units = unitsOf(selected, list);
  if (units.length < 2) return { list, groupId: null };
  const gid = newObjectId();
  const group: SetObject = { id: gid, type: GROUP_TYPE, name: name ?? nextGroupName(list), params: {}, x: 0, z: 0, elevation: 0, rotation: 0 };
  const lastIndex = Math.max(...units.map((u) => list.findIndex((o) => o.id === u)));
  const next = list.map((o) => (units.includes(o.id) ? { ...o, parent: gid } : o));
  next.splice(lastIndex + 1, 0, group);
  return { list: next, groupId: gid };
}

/** Dissolve the top-level groups of the selection; their members move up a level. */
export function ungroupUnits(list: SetObject[], selected: string[]): SetObject[] {
  const groups = unitsOf(selected, list).filter((id) => isGroup(list.find((o) => o.id === id)!));
  if (!groups.length) return list;
  const map = byId(list);
  return list
    .filter((o) => !groups.includes(o.id))
    .map((o) => (o.parent && groups.includes(o.parent) ? { ...o, parent: map.get(o.parent)!.parent } : o));
}

/**
 * Copy whole units (with their groups), applying `transform` to each copied
 * leaf. Returns the new list and the ids of the copied leaves.
 */
export function copyUnits(
  list: SetObject[],
  unitIds: string[],
  transform: (o: SetObject) => SetObject,
  rename: (o: SetObject) => string = (o) => o.name,
): { list: SetObject[]; leaves: string[]; tops: string[] } {
  const ids = new Map<string, string>();
  const collect = (id: string): SetObject[] => {
    const o = list.find((x) => x.id === id)!;
    return [o, ...list.filter((c) => c.parent === id).flatMap((c) => collect(c.id))];
  };
  const sources = unitIds.flatMap(collect);
  for (const o of sources) ids.set(o.id, newObjectId());
  const copies = sources.map((o) => {
    const base: SetObject = { ...o, id: ids.get(o.id)!, parent: o.parent && ids.has(o.parent) ? ids.get(o.parent) : o.parent, locked: false, name: rename(o) };
    // A combined piece remembers which of its pieces the others cut into: point it at the copy.
    const keep = typeof o.params.base === 'string' && ids.has(o.params.base) ? { ...base, params: { ...o.params, base: ids.get(o.params.base)! } } : base;
    return isGroup(o) ? keep : transform(base);
  });
  return { list: [...list, ...copies], leaves: copies.filter((c) => !isGroup(c)).map((c) => c.id), tops: unitIds.map((u) => ids.get(u)!) };
}
