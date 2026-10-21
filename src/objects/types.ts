import type { ReactNode } from 'react';
import type { ParamDef, Params, Vec3 } from '../types';

/**
 * Set objects: the pieces users place on a stage (flats, platforms, trusses...).
 *
 * Local frame of every object: origin at the centre of its footprint on the
 * floor, Y up, the front facing +Z (towards the audience by default).
 */

/** How an object is placed: on the floor, flat against a wall, or hung from above. */
export type Placement = 'floor' | 'wall' | 'hanging';

/** A face that can later take a graphic or a material. Sizes in metres. */
export interface ObjectFace {
  id: string;
  name: string;
  width: number;
  height: number;
}

/** Local bounding box: width (X) × depth (Z) centred on the origin, from y = 0 up to height. */
export interface ObjectSize {
  width: number;
  depth: number;
  height: number;
}

/**
 * Which param an edge handle changes. A plain key sets the param to the new
 * size; `scale` converts (e.g. a half-round platform's depth is half its diameter → scale 2).
 */
export type ResizeRule = string | { key: string; scale: number };
export interface ResizeMap {
  width?: ResizeRule;
  depth?: ResizeRule;
}

export interface SetObjectType {
  id: string;
  name: string;
  category: string;
  /** Small SVG drawing for the library tile (24 × 24 viewBox). */
  icon: ReactNode;
  params: ParamDef[];
  constraints: (params: Params) => Params;
  build: (params: Params) => ReactNode;
  faces: (params: Params) => ObjectFace[];
  placement: Placement;
  size: (params: Params) => ObjectSize;
  /** Params driven by the edge handles (may depend on the current params). */
  resize?: ResizeMap | ((params: Params) => ResizeMap);
  /** For objects whose height above the floor is a param (e.g. a backdrop's bottom gap). */
  elevationParam?: string;
  /** Default height above the floor when placed (hanging pieces). */
  defaultElevation?: number;
  /** Local truss/bar lines other objects can hang from. */
  hangLines?: (params: Params) => [Vec3, Vec3][];
  /** This object is something you can step up onto; returns its top height (e.g. a platform). */
  platformTop?: (params: Params) => number;
  /** Steps/ramps: snap against a platform's edge and match its height via this param. */
  climbs?: { heightParam: string };
}

/** A placed object, as saved in the project. Position is relative to the stage centre. */
export interface SetObject {
  id: string;
  type: string;
  name: string;
  params: Params;
  x: number;
  z: number;
  /** Height of the object's base above the floor it stands on (or above the stage floor when hanging). */
  elevation: number;
  /** Degrees about the vertical axis. */
  rotation: number;
  hidden?: boolean;
  locked?: boolean;
}

export function resizeRule(type: SetObjectType, params: Params, axis: 'width' | 'depth'): { key: string; scale: number } | null {
  const map = typeof type.resize === 'function' ? type.resize(params) : type.resize;
  const r = map?.[axis];
  if (!r) return null;
  return typeof r === 'string' ? { key: r, scale: 1 } : r;
}
