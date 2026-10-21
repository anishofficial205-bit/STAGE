import { create } from 'zustand';
import type { RootState } from '@react-three/fiber';
import type { Vec3 } from '../types';

/** Short-lived UI state for set objects (not saved, not in undo history). */
export const useObjectUI = create<{
  guides: [Vec3, Vec3][];
  setGuides: (g: [Vec3, Vec3][]) => void;
}>((set) => ({
  guides: [],
  setGuides: (guides) => set({ guides }),
}));

/** The main viewport's three.js state, so DOM code (drag-and-drop from the library) can raycast into the scene. */
export const viewportBridge: { three: RootState | null } = { three: null };

/** dataTransfer type used when dragging a library tile into the viewport. */
export const OBJECT_DRAG_TYPE = 'application/x-stage-object';
