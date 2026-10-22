import { create } from 'zustand';
import type { Pt } from './types';
import type { SnapResult } from './geometry';

export type VenueTool = 'select' | 'wall';
export type VenueLayout = 'split' | 'plan' | '3d';
export type VenueSelection = { kind: 'wall'; id: string } | null;

const LAYOUT_KEY = 'stage-builder:venue-layout';
const savedLayout = (): VenueLayout => {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    return v === 'plan' || v === '3d' ? v : 'split';
  } catch {
    return 'split';
  }
};

/** Venue editing state shared by the 2D plan and the 3D view (not saved with the project). */
export const useVenueUI = create<{
  tool: VenueTool;
  draft: Pt[];
  hover: SnapResult | null;
  selected: VenueSelection;
  layout: VenueLayout;
  /** Lower every wall to 1 m in 3D so you can see into the rooms. */
  cutaway: boolean;
  setTool: (tool: VenueTool) => void;
  setDraft: (draft: Pt[]) => void;
  setHover: (hover: SnapResult | null) => void;
  select: (sel: VenueSelection) => void;
  setLayout: (layout: VenueLayout) => void;
  toggleCutaway: () => void;
}>((set) => ({
  tool: 'select',
  draft: [],
  hover: null,
  selected: null,
  layout: savedLayout(),
  cutaway: false,
  setTool: (tool) => set({ tool, draft: [], hover: null, ...(tool !== 'select' ? { selected: null } : {}) }),
  setDraft: (draft) => set({ draft }),
  setHover: (hover) => set({ hover }),
  select: (selected) => set({ selected }),
  setLayout: (layout) => {
    try {
      localStorage.setItem(LAYOUT_KEY, layout);
    } catch {
      // ignore
    }
    set({ layout });
  },
  toggleCutaway: () => set((s) => ({ cutaway: !s.cutaway })),
}));
