import type { ComponentType, ReactNode } from 'react';
import type { Pt } from './helpers/shapes';

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

/** A colour (hex), with optional named swatches. */
export interface ColorParam extends ParamBase {
  type: 'color';
  default: string;
  presets?: { value: string; label: string }[];
}

export type ParamDef = NumberParam | BooleanParam | SelectParam | ColorParam;

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
  /** Non-rectangular surfaces: outline in the surface's own plane (x across, y up), centred on `position`. */
  outline?: Pt[];
  holes?: Pt[][];
  /** A lit surface (LED screen): graphics on it glow. */
  glow?: boolean;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface PanelMessage {
  kind: 'info' | 'warning';
  text: string;
}

/** Sky, lighting and ground. Templates may override any part (e.g. time of day outdoors). */
export interface Environment {
  background: string;
  /** Physical sky instead of a flat background colour. */
  sky?: { sunPosition: Vec3; turbidity?: number; rayleigh?: number };
  stars?: boolean;
  fog: string;
  ground: string;
  grid: { cell: string; section: string };
  hemisphere: { sky: string; ground: string; intensity: number };
  ambient: number;
  /** Key light. `direction` points from the scene towards the light. */
  sun: { color: string; intensity: number; direction: Vec3 };
}

/**
 * Optional free-form data a template keeps beside its params (e.g. the Black
 * Box's movable blocks). It is saved, exported and imported with the project.
 */
export interface TemplateDataHooks {
  initial: (params: Params) => unknown;
  /** Turn stored or imported data back into something usable. */
  sanitize: (raw: unknown, params: Params) => unknown;
  /** Runs after every param change: return updated data (e.g. regenerate a layout, keep blocks in the room). */
  onParamsChange?: (next: Params, prev: Params, data: unknown) => unknown;
}

/**
 * Where set objects can go. Objects are positioned relative to `centre`, so
 * they keep their place on the stage when its dimensions change.
 */
export interface StageInfo {
  /** Stage centre on the floor plan, [x, z]. */
  centre: [number, number];
  /** Areas you can stand on and their floor heights (stage, apron, platforms...). */
  floors: { outline: Pt[]; height: number }[];
  /** Overhead bars and truss lines that hanging pieces can attach to. */
  rigging?: [Vec3, Vec3][];
  /**
   * A framed opening (proscenium arch): world z of the line just behind it where the
   * main curtain hangs, the opening's width and height, and the depth of the stage behind it.
   */
  opening?: { z: number; width: number; height: number; backZ: number };
}

/** One audience seat in world space, for seat view and sightline checks. */
export interface SeatInfo {
  x: number;
  /** Height of the floor the seat stands on. */
  y: number;
  z: number;
  /** Direction the seat faces (radians about Y; the seat looks along (-sin, -cos)). */
  facing: number;
  /** Seating block or section, e.g. "Stalls", "Left", "Section A". */
  block: string;
  row: number;
  num: number;
  /** Human label, e.g. "Stalls B12". */
  label: string;
}

/** A named set of realistic dimensions, e.g. "School auditorium". */
export interface SizePreset {
  name: string;
  description: string;
  /** Params to apply on top of the current ones. */
  params: Params;
  /** Also rebuild the template's data (e.g. re-place Black Box blocks for the new room). */
  resetData?: boolean;
}

/**
 * Which params mean "stage width / depth / height" in this template, so
 * dimensions can be carried across when switching templates.
 */
export interface SharedDimensions {
  width?: string;
  depth?: string;
  height?: string;
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
  /** Returns the 3D scene for these params (and the template's data, if it has any). */
  build: (params: Params, data?: unknown) => ReactNode;
  audienceSides: AudienceSide[];
  /** Template-specific camera views. "Top view" and "Reset view" are added by the app. */
  presetViews: (params: Params, data?: unknown) => PresetView[];
  surfaces: (params: Params, data?: unknown) => Surface[];
  /** Rough extent of everything in the scene; used for top view, reset view and shadows. */
  bounds: (params: Params, data?: unknown) => Bounds;
  /** Optional notes/warnings shown at the top of the properties panel. */
  messages?: (params: Params, data?: unknown) => PanelMessage[];
  /** Override parts of the default sky, lighting and ground. */
  environment?: (params: Params) => Partial<Environment>;
  data?: TemplateDataHooks;
  /** Extra controls shown in the properties panel above the params (e.g. block editing). */
  Panel?: ComponentType;
  presets?: SizePreset[];
  dimensions?: SharedDimensions;
  /** Stage floor areas and rigging, for placing set objects. */
  stage?: (params: Params, data?: unknown) => StageInfo;
  /** Ways onto the stage the template itself has (vomitories, aisles), for Blocking. Facing is the way onto the stage, in degrees (0 = towards +z). */
  entrances?: (params: Params, data?: unknown) => { key: string; name: string; x: number; z: number; facing: number }[];
  /** Every audience seat (for seat view and sightlines). */
  seats?: (params: Params, data?: unknown) => SeatInfo[];
}
