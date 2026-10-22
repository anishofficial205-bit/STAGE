import type { Params, StageInfo, Vec3 } from '../types';
import type { Pt } from '../helpers/shapes';
import { allOnStage, floorHeightAt } from '../helpers/stageInfo';
import { num } from '../helpers/params';
import { getObjectType } from './registry';
import { placementOf, type ObjectSize, type SetObject, type SetObjectType } from './types';

/** A set object resolved into world space for the current stage. */
export interface Placed {
  obj: SetObject;
  type: SetObjectType;
  size: ObjectSize;
  /** World position of the footprint centre. */
  wx: number;
  wz: number;
  /** World height of the object's base. */
  baseY: number;
  /** Height above the floor it stands on. */
  elevation: number;
}

/** Rotate a local floor-plan vector by `deg` about the vertical axis (same convention as Three's rotation.y). */
export function rotateXZ(x: number, z: number, deg: number): Pt {
  const t = (deg * Math.PI) / 180;
  return [x * Math.cos(t) + z * Math.sin(t), -x * Math.sin(t) + z * Math.cos(t)];
}

/** Inverse of rotateXZ: world vector → local. */
export const unrotateXZ = (x: number, z: number, deg: number): Pt => rotateXZ(x, z, -deg);

export const effectiveElevation = (obj: SetObject, type: SetObjectType) => (type.elevationParam ? num(obj.params, type.elevationParam) : obj.elevation);

export function place(obj: SetObject, info: StageInfo, params: Params = obj.params): Placed | null {
  const type = getObjectType(obj.type);
  if (!type) return null;
  const wx = info.centre[0] + obj.x;
  const wz = info.centre[1] + obj.z;
  const elevation = type.elevationParam ? num(params, type.elevationParam) : obj.elevation;
  return { obj, type, size: type.size(params), wx, wz, baseY: (type.onGround ? 0 : floorHeightAt(info, wx, wz)) + elevation, elevation };
}

export function corners(p: Pick<Placed, 'size' | 'wx' | 'wz'> & { obj: Pick<SetObject, 'rotation'> }): Pt[] {
  const { width: w, depth: d } = p.size;
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => {
    const [rx, rz] = rotateXZ(x, z, p.obj.rotation);
    return [p.wx + rx, p.wz + rz] as Pt;
  });
}

export function aabb(p: Parameters<typeof corners>[0]) {
  const c = corners(p);
  const xs = c.map((q) => q[0]);
  const zs = c.map((q) => q[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/** Floor and wall pieces that are (even partly) off every stage floor. Hanging pieces are exempt. */
export const isOffStage = (p: Placed, info: StageInfo) => placementOf(p.type, p.obj.params) !== 'hanging' && !allOnStage(info, corners(p));

/** World-space hang lines of a placed object (e.g. a truss others can hang from). */
export function worldHangLines(p: Placed): [Vec3, Vec3][] {
  if (!p.type.hangLines) return [];
  return p.type.hangLines(p.obj.params).map(([a, b]) => {
    const tr = (v: Vec3): Vec3 => {
      const [rx, rz] = rotateXZ(v[0], v[2], p.obj.rotation);
      return [p.wx + rx, p.baseY + v[1], p.wz + rz];
    };
    return [tr(a), tr(b)];
  });
}
