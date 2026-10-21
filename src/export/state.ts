import { create } from 'zustand';
import type { PresetView, Vec3 } from '../types';

/** While exporting, UI-only things (grid, handles, outlines, hover markers) are hidden. */
export const useExportState = create<{ exporting: boolean; presentation: boolean; set: (s: Partial<{ exporting: boolean; presentation: boolean }>) => void }>((set) => ({
  exporting: false,
  presentation: false,
  set: (s) => set(s),
}));

/** Dimension labels currently in the scene, so exports can draw them into the image. */
export interface LabelEntry {
  a: Vec3;
  b: Vec3;
  label?: string;
}
export const labelRegistry = new Set<LabelEntry>();

export interface CaptureOptions {
  width: number;
  height: number;
  view?: PresetView;
  labels: boolean;
  type?: 'image/png' | 'image/jpeg';
}

/** Filled in by the viewport's Capturer component. */
export const exporter: {
  capture: ((o: CaptureOptions) => Promise<string>) | null;
  turntable: ((seconds: number, size: [number, number]) => Promise<Blob>) | null;
} = { capture: null, turntable: null };
