/**
 * Editing operations on set objects, shared by the viewport (handles,
 * dragging), the panels and the keyboard. Each change goes through the store,
 * so it is undoable; `key`s merge a continuous drag into one undo step.
 */
import { MERGE_WITH_PREVIOUS, useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { applyConstraints } from '../helpers/params';
import { getStageInfo } from '../helpers/stageInfo';
import type { Pt } from '../helpers/shapes';
import { M_PER_FT } from '../units';
import type { Params } from '../types';
import { getObjectType } from './registry';
import { place, rotateXZ, type Placed } from './geometry';
import { snapMove } from './snapping';
import { useObjectUI } from './ui';
import { placementOf, resizeRule, type SetObject } from './types';

/** Grid step for objects: 0.25 m, or 6 in when working in feet. */
export const gridStep = () => (useProjectStore.getState().units === 'ft' ? 0.5 * M_PER_FT : 0.25);

export function currentStage() {
  const s = useProjectStore.getState();
  const t = getTemplate(s.templateId)!;
  const params = s.paramsByTemplate[s.templateId];
  const data = s.dataByTemplate[s.templateId];
  return { info: getStageInfo(t, params, data), walls: t.surfaces(params, data) };
}

const objects = () => {
  const s = useProjectStore.getState();
  return s.objectsByTemplate[s.templateId] ?? [];
};

export function placedAll(): Placed[] {
  const { info } = currentStage();
  return objects().map((o) => place(o, info)).filter((p): p is Placed => !!p);
}

const patchOne = (id: string, change: (o: SetObject) => SetObject, key?: string) =>
  useProjectStore.getState().updateObjects((list) => list.map((o) => (o.id === id ? change(o) : o)), key);

/** Apply param changes through the object's constraints. */
function withParams(o: SetObject, params: Params): SetObject {
  const type = getObjectType(o.type)!;
  return { ...o, params: applyConstraints(type, { ...o.params, ...params }) };
}

/**
 * Move the selection so the primary object lands near `want` (world x, z),
 * snapping as configured. Other selected objects move by the same amount.
 */
export function moveSelection(primaryId: string, want: Pt, starts: Record<string, { x: number; z: number }>, opts: { snap: boolean; key?: string }) {
  const { info, walls } = currentStage();
  const all = placedAll();
  const primary = all.find((p) => p.obj.id === primaryId);
  if (!primary) return;
  const ids = Object.keys(starts);
  const result = snapMove({
    moving: primary,
    want,
    others: all.filter((p) => !ids.includes(p.obj.id) && !p.obj.hidden),
    info,
    walls,
    grid: gridStep(),
    enabled: opts.snap && useProjectStore.getState().snapping,
  });
  const dx = result.x - info.centre[0] - starts[primaryId].x;
  const dz = result.z - info.centre[1] - starts[primaryId].z;
  useObjectUI.getState().setGuides(result.guides);
  useProjectStore.getState().updateObjects(
    (list) =>
      list.map((o) => {
        if (!starts[o.id]) return o;
        let next: SetObject = { ...o, x: starts[o.id].x + dx, z: starts[o.id].z + dz };
        if (o.id === primaryId) {
          if (result.rotation !== undefined) next.rotation = result.rotation;
          if (result.params) next = withParams(next, result.params);
          // Hanging on rigging: the piece hangs just below the bar.
          if (result.hangY !== undefined) {
            const p = place(next, info);
            const gap = p?.type.hangGap ?? 0.3;
            if (p) next = setElevationOn(next, p.elevation - (p.baseY + p.size.height - (result.hangY - gap)));
          }
        }
        return next;
      }),
    opts.key ?? `move:${ids.join()}`,
  );
}

function setElevationOn(o: SetObject, elevation: number): SetObject {
  const type = getObjectType(o.type)!;
  const e = Math.max(0, elevation);
  return type.elevationParam ? withParams(o, { [type.elevationParam]: e }) : { ...o, elevation: e };
}

export const setElevation = (id: string, elevation: number, key = `elev:${id}`) => patchOne(id, (o) => setElevationOn(o, elevation), key);

export const setRotation = (id: string, deg: number, key = `rot:${id}`) =>
  patchOne(id, (o) => ({ ...o, rotation: ((((deg + 180) % 360) + 360) % 360) - 180 }), key);

export const setParams = (id: string, params: Params, key?: string) => patchOne(id, (o) => withParams(o, params), key);

export const setProps = (id: string, props: Partial<Pick<SetObject, 'name' | 'x' | 'z' | 'hidden' | 'locked'>>, key?: string) =>
  patchOne(id, (o) => ({ ...o, ...props }), key);

/**
 * Edge-handle resize: change width or depth while the opposite edge stays put.
 * `size` is the requested new size along that axis.
 */
export function resizeFromEdge(start: { obj: SetObject; size: number; axis: 'x' | 'z'; sign: 1 | -1 }, size: number) {
  const type = getObjectType(start.obj.type)!;
  const rule = resizeRule(type, start.obj.params, start.axis === 'x' ? 'width' : 'depth');
  if (!rule) return;
  const before = type.size(start.obj.params);
  const next = withParams(start.obj, { [rule.key]: Math.max(0.01, Math.round(size * rule.scale * 1000) / 1000) });
  const after = type.size(next.params);
  const grow = start.axis === 'x' ? after.width - before.width : after.depth - before.depth;
  const [ox, oz] = rotateXZ(start.axis === 'x' ? (start.sign * grow) / 2 : 0, start.axis === 'z' ? (start.sign * grow) / 2 : 0, start.obj.rotation);
  patchOne(start.obj.id, () => ({ ...next, x: start.obj.x + ox, z: start.obj.z + oz }), `resize:${start.obj.id}`);
}

/** Arrow-key nudge of the whole selection. */
export function nudge(dx: number, dz: number) {
  const s = useProjectStore.getState();
  const ids = s.selectedIds;
  if (!ids.length) return;
  s.updateObjects((list) => list.map((o) => (ids.includes(o.id) && !o.locked ? { ...o, x: o.x + dx, z: o.z + dz } : o)), `nudge:${ids.join()}`);
}

/** Add an object at a world point (or the stage centre) and settle it with the usual snapping. */
export function addObjectAt(typeId: string, world?: Pt) {
  const { info } = currentStage();
  const s = useProjectStore.getState();
  const at = world ? { x: world[0] - info.centre[0], z: world[1] - info.centre[1] } : undefined;
  const id = s.addObject(typeId, at);
  if (!id) return;
  const obj = objects().find((o) => o.id === id)!;
  // Hanging pieces attach to rigging straight away when there is some nearby.
  const type = getObjectType(typeId)!;
  if (placementOf(type, obj.params) !== 'floor') moveSelection(id, [info.centre[0] + obj.x, info.centre[1] + obj.z], { [id]: { x: obj.x, z: obj.z } }, { snap: true, key: MERGE_WITH_PREVIOUS });
  useObjectUI.getState().setGuides([]);
}
