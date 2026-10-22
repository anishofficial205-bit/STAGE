import { create } from 'zustand';
import type { Pt } from '../../helpers/shapes';

export type CustomTool = 'draw' | 'seat-edge' | null;

/** Build Your Own editing state (not saved): the active tool, the outline being drawn, and what's picked. */
export const useCustomUI = create<{
  tool: CustomTool;
  draft: Pt[];
  hover: Pt | null;
  selectedShape: string | null;
  selectedPoint: number | null;
  setTool: (tool: CustomTool) => void;
  setDraft: (draft: Pt[]) => void;
  setHover: (hover: Pt | null) => void;
  selectShape: (id: string | null, point?: number | null) => void;
}>((set) => ({
  tool: null,
  draft: [],
  hover: null,
  selectedShape: null,
  selectedPoint: null,
  setTool: (tool) => set({ tool, draft: [], hover: null, ...(tool ? { selectedShape: null, selectedPoint: null } : {}) }),
  setDraft: (draft) => set({ draft }),
  setHover: (hover) => set({ hover }),
  selectShape: (selectedShape, selectedPoint = null) => set({ selectedShape, selectedPoint }),
}));
