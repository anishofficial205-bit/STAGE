import { create } from 'zustand';
import type { RootState } from '@react-three/fiber';
import type { Vec3 } from '../types';

/** Short-lived UI state for set objects (not saved, not in undo history). */
export interface FaceRef {
  objectId: string;
  face: string;
}
/** A stage surface (from the template's surfaces()) rather than an object face. */
export const SURFACE = '@surface';

export const useObjectUI = create<{
  guides: [Vec3, Vec3][];
  setGuides: (g: [Vec3, Vec3][]) => void;
  /** Face under the mouse in the panel's face list (highlighted in the view). */
  hoverFace: FaceRef | null;
  /** Face being edited in the panel (picked from the list or by Alt-clicking it). */
  selectedFace: FaceRef | null;
  setHoverFace: (f: FaceRef | null) => void;
  setSelectedFace: (f: FaceRef | null) => void;
  /** While on, dragging the selected face in the view pans its graphic instead of moving the object. */
  repositioning: boolean;
  setRepositioning: (on: boolean) => void;
  /** Right-click menu on a face. */
  menu: { x: number; y: number; target: FaceRef } | null;
  setMenu: (m: { x: number; y: number; target: FaceRef } | null) => void;
}>((set) => ({
  repositioning: false,
  setRepositioning: (repositioning) => set({ repositioning }),
  menu: null,
  setMenu: (menu) => set({ menu }),
  guides: [],
  setGuides: (guides) => set({ guides }),
  hoverFace: null,
  selectedFace: null,
  setHoverFace: (hoverFace) => set({ hoverFace }),
  setSelectedFace: (selectedFace) => set({ selectedFace }),
}));

/** The main viewport's three.js state, so DOM code (drag-and-drop from the library) can raycast into the scene. */
export const viewportBridge: { three: RootState | null } = { three: null };

/** dataTransfer type used when dragging a library tile into the viewport. */
export const OBJECT_DRAG_TYPE = 'application/x-stage-object';
/** dataTransfer type used when dragging a graphic from the library. */
export const GRAPHIC_DRAG_TYPE = 'application/x-stage-graphic';
