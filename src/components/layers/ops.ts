import { useProjectStore } from '../../store/useProjectStore';
import { setProps } from '../../objects/actions';
import { leafIds } from '../../objects/groups';
import { lightActions } from '../../lighting/actions';
import { blockingActions } from '../../blocking/actions';
import { venueActions } from '../../venue/actions';
import type { Domain, Pick } from './selection';

/** One thing in the layers list that can be acted on. */
export interface Item {
  domain: Domain;
  kind: string;
  id: string;
}

const objects = () => {
  const s = useProjectStore.getState();
  return s.objectsByTemplate[s.templateId] ?? [];
};
const lighting = () => {
  const s = useProjectStore.getState();
  return s.lightingByTemplate[s.templateId];
};
const blocking = () => {
  const s = useProjectStore.getState();
  return s.blockingByTemplate[s.templateId];
};
const setGroups = (update: (g: { id: string; name: string; ids: string[] }[]) => { id: string; name: string; ids: string[] }[]) =>
  useProjectStore.getState().setBlocking((b) => ({ ...b, groups: update(b.groups) }));

/** What can be done to an item (the row buttons and ⋯ menu follow this). */
export function can(it: Item) {
  const k = `${it.domain}/${it.kind}`;
  return {
    rename: ['set/object', 'set/folder', 'lights/fixture', 'lights/position', 'performers/performer', 'performers/group', 'venue/room', 'venue/route'].includes(k),
    hide: ['set/object', 'set/folder', 'lights/fixture', 'performers/performer', 'venue/route'].includes(k),
    lock: ['set/object', 'set/folder', 'lights/fixture', 'performers/performer'].includes(k),
    duplicate: ['set/object', 'set/folder', 'lights/fixture'].includes(k),
    remove: it.domain !== 'stage',
  };
}

export function rename(it: Item, name: string) {
  if (!name.trim()) return;
  name = name.trim();
  if (it.domain === 'set') setProps(it.id, { name });
  else if (it.kind === 'fixture') lightActions.patch([it.id], { name });
  else if (it.kind === 'position') lightActions.patchPosition(it.id, { name });
  else if (it.kind === 'performer') blockingActions.patchPerformers([it.id], { name });
  else if (it.domain === 'performers' && it.kind === 'group') setGroups((g) => g.map((x) => (x.id === it.id ? { ...x, name } : x)));
  else if (it.kind === 'room') venueActions.patchRoom(it.id, { name });
  else if (it.kind === 'route') venueActions.patchRoute(it.id, { name });
}

export function isHidden(it: Item): boolean {
  if (it.domain === 'set') return !!objects().find((o) => o.id === it.id)?.hidden;
  if (it.kind === 'fixture') return !!lighting()?.fixtures.find((f) => f.id === it.id)?.hidden;
  if (it.kind === 'performer') return !!blocking()?.performers.find((p) => p.id === it.id)?.hidden;
  if (it.kind === 'route') return !useProjectStore.getState().venue.routes.find((r) => r.id === it.id)?.visible;
  return false;
}
export function isLocked(it: Item): boolean {
  if (it.domain === 'set') return !!objects().find((o) => o.id === it.id)?.locked;
  if (it.kind === 'fixture') return !!lighting()?.fixtures.find((f) => f.id === it.id)?.locked;
  if (it.kind === 'performer') return !!blocking()?.performers.find((p) => p.id === it.id)?.locked;
  return false;
}

export function toggleHidden(it: Item) {
  const hidden = !isHidden(it);
  if (it.domain === 'set') setProps(it.id, { hidden });
  else if (it.kind === 'fixture') lightActions.patch([it.id], { hidden });
  else if (it.kind === 'performer') blockingActions.patchPerformers([it.id], { hidden });
  else if (it.kind === 'route') venueActions.patchRoute(it.id, { visible: !hidden });
}
export function toggleLocked(it: Item) {
  const locked = !isLocked(it);
  if (it.domain === 'set') setProps(it.id, { locked });
  else if (it.kind === 'fixture') lightActions.patch([it.id], { locked });
  else if (it.kind === 'performer') blockingActions.patchPerformers([it.id], { locked });
}

export function duplicate(items: Item[]) {
  const set = items.filter((i) => i.domain === 'set').flatMap((i) => leafIds(i.id, objects()));
  if (set.length) useProjectStore.getState().duplicateObjects(set);
  const fx = items.filter((i) => i.kind === 'fixture').map((i) => i.id);
  if (fx.length) lightActions.duplicate(fx);
}

/** The item's name as the user sees it (for "Deleted 'Wall panel 3'"). */
export function nameOf(it: Item): string {
  const v = useProjectStore.getState().venue;
  if (it.domain === 'set') return objects().find((o) => o.id === it.id)?.name ?? 'set piece';
  if (it.kind === 'fixture') return lighting()?.fixtures.find((f) => f.id === it.id)?.name ?? 'light';
  if (it.kind === 'position') return lighting()?.positions.find((p) => p.id === it.id)?.name ?? 'light bar';
  if (it.kind === 'performer') return blocking()?.performers.find((p) => p.id === it.id)?.name ?? 'performer';
  if (it.domain === 'performers' && it.kind === 'group') return blocking()?.groups.find((g) => g.id === it.id)?.name ?? 'group';
  if (it.kind === 'room') return v.rooms.find((r) => r.id === it.id)?.name ?? 'room';
  if (it.kind === 'route') return v.routes.find((r) => r.id === it.id)?.name ?? 'route';
  if (it.kind === 'door') return v.doors.find((d) => d.id === it.id)?.entrance ?? 'door';
  if (it.kind === 'path') {
    const b = blocking();
    const path = b?.scenes.flatMap((sc) => sc.paths).find((x) => x.id === it.id);
    const who = path && b?.performers.find((x) => x.id === path.performerId)?.name;
    return who ? `${who}’s path` : 'path';
  }
  if (it.kind === 'mark') return 'spike mark';
  if (it.kind === 'entrance') return blocking()?.entrances.find((e) => e.id === it.id)?.name ?? 'entrance';
  if (it.kind === 'furniture') return 'furniture';
  if (it.kind === 'wall') return 'wall';
  return it.kind;
}

/** How many things a group holds (0 for anything that isn't a group). */
export function groupSize(it: Item): number {
  if (it.domain === 'set' && it.kind === 'folder') return leafIds(it.id, objects()).length;
  if (it.domain === 'performers' && it.kind === 'group') return blocking()?.groups.find((g) => g.id === it.id)?.ids.length ?? 0;
  return 0;
}

/** Take a group apart, keeping what's inside it. */
export function ungroup(it: Item) {
  if (it.domain === 'set') {
    const store = useProjectStore.getState();
    const folder = objects().find((o) => o.id === it.id);
    store.batch(`Ungrouped “${folder?.name ?? 'group'}”`, () =>
      store.updateObjects((list) => list.filter((o) => o.id !== it.id).map((o) => (o.parent === it.id ? { ...o, parent: folder?.parent } : o))),
    );
  } else useProjectStore.getState().batch(`Ungrouped “${nameOf(it)}”`, () => blockingActions.removeGroup(it.id));
}

/** Delete items as one undo step, with "Deleted 'Wall panel 3' · Undo". Groups take everything inside them. */
export function remove(items: Item[]) {
  items = items.filter((i) => i.domain !== 'stage');
  if (!items.length) return;
  const label = items.length === 1 ? `Deleted “${nameOf(items[0])}”` : `Deleted ${items.length} items`;
  useProjectStore.getState().batch(label, () => removeNow(items));
}

function removeNow(items: Item[]) {
  // Everything in a cast group goes with it.
  const castGroups = items.filter((i) => i.domain === 'performers' && i.kind === 'group');
  const groupMembers = castGroups.flatMap((i) => blocking()?.groups.find((g) => g.id === i.id)?.ids ?? []).map((id) => ({ domain: 'performers' as const, kind: 'performer', id }));
  items = [...items, ...groupMembers];
  const set = items.filter((i) => i.domain === 'set');
  if (set.length) useProjectStore.getState().removeObjects([...new Set(set.flatMap((i) => [i.id, ...leafIds(i.id, objects())]))]);
  const fx = items.filter((i) => i.kind === 'fixture').map((i) => i.id);
  if (fx.length) lightActions.remove(fx);
  items.filter((i) => i.kind === 'position').forEach((i) => lightActions.removePosition(i.id));
  const perf = items.filter((i) => i.kind === 'performer').map((i) => i.id);
  if (perf.length) blockingActions.removePerformers(perf);
  items.filter((i) => i.domain === 'performers' && i.kind === 'group').forEach((i) => blockingActions.removeGroup(i.id));
  items.filter((i) => i.kind === 'path').forEach((i) => blockingActions.removePath(i.id));
  items.filter((i) => i.kind === 'mark').forEach((i) => blockingActions.removeMark(i.id));
  items.filter((i) => i.kind === 'entrance').forEach((i) => blockingActions.removeEntrance(i.id));
  for (const i of items) {
    if (i.kind === 'room') venueActions.removeRoom(i.id);
    else if (i.kind === 'door') venueActions.removeDoor(i.id);
    else if (i.kind === 'furniture') venueActions.removeFurniture(i.id);
    else if (i.kind === 'route') venueActions.removeRoute(i.id);
    else if (i.kind === 'wall') venueActions.removeWall(i.id);
  }
}

/** Delete what a selection points at. */
export const removePick = (p: Pick) => remove(p.ids.map((id) => ({ domain: p.domain, kind: p.kind, id })));
