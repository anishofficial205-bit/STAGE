import type { ReactNode } from 'react';

/**
 * Coordinate convention used by every template:
 *   - Units are metres.
 *   - Y is up. The audience floor is y = 0.
 *   - The stage sits around the origin; the "front" audience is towards +Z.
 *   - Stage left/right follow the performer's view (performer faces +Z),
 *     so stage left is +X and stage right is -X.
 */
export type Vec3 = [number, number, number];

export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

interface ParamBase {
  key: string;
  label: string;
  /** Panel section heading, e.g. "Stage" or "Seating". */
  group: string;
  help?: string;
  /** Hide the control when it doesn't apply (e.g. pit depth when there's no pit). */
  visible?: (params: Params) => boolean;
}

export interface NumberParam extends ParamBase {
  type: 'number';
  default: number;
  min: number;
  max: number;
  step: number;
  /** 'length' values are stored in metres and shown in m/ft. 'none' is shown as-is (counts, ratios). */
  unit?: 'length' | 'none';
}

export interface BooleanParam extends ParamBase {
  type: 'boolean';
  default: boolean;
}

export interface SelectParam extends ParamBase {
  type: 'select';
  default: string;
  options: { value: string; label: string }[];
}

export type ParamDef = NumberParam | BooleanParam | SelectParam;

export type AudienceSide = 'front' | 'left' | 'right' | 'back' | 'custom';

/** A named camera position. Computed from params so it follows the stage as it resizes. */
export interface PresetView {
  id: string;
  label: string;
  position: Vec3;
  target: Vec3;
}

/** A flat face that graphics can be placed on later (back wall, floor, ...). */
export interface Surface {
  id: string;
  label: string;
  /** Centre of the surface. */
  position: Vec3;
  /** Euler rotation (radians). An unrotated surface lies in the XY plane facing +Z. */
  rotation: Vec3;
  width: number;
  height: number;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface PanelMessage {
  kind: 'info' | 'warning';
  text: string;
}

/**
 * The contract every stage template implements. A template is a plain object,
 * registered in templates/registry.ts. The app never special-cases a template:
 * the panel, views, labels and save/load all work from this description.
 */
export interface StageTemplate {
  id: string;
  name: string;
  description: string;
  /** Parameter schema. The properties panel is generated from this. */
  params: ParamDef[];
  /** Takes (already range-clamped) params, returns corrected params. Runs on every change. */
  constraints: (params: Params) => Params;
  /** Returns the 3D scene for these params. */
  build: (params: Params) => ReactNode;
  audienceSides: AudienceSide[];
  /** Template-specific camera views. "Top view" and "Reset view" are added by the app. */
  presetViews: (params: Params) => PresetView[];
  surfaces: (params: Params) => Surface[];
  /** Rough extent of everything in the scene; used for top view, reset view and shadows. */
  bounds: (params: Params) => Bounds;
  /** Optional notes/warnings shown at the top of the properties panel. */
  messages?: (params: Params) => PanelMessage[];
}
