import { create } from 'zustand';
import type { Pt } from './types';
import type { SnapResult } from './geometry';

export type VenueTool = 'select' | 'wall' | 'room' | 'door' | 'furniture';
export type VenueLayout = 'split' | 'plan' | '3d';
export type VenueSelection = { kind: 'wall' | 'room' | 'door' | 'furniture'; id: string } | null;

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
  /** Choices for the room, door and furniture tools. */
  roomType: string;
  doorPreset: 'single' | 'double' | 'opening' | 'loading';
  furnitureType: string;
  /** A message under the plan (e.g. "That area isn't enclosed by walls"). */
  notice: string | null;
  setChoice: (c: Partial<{ roomType: string; doorPreset: 'single' | 'double' | 'opening' | 'loading'; furnitureType: string }>) => void;
  setNotice: (notice: string | null) => void;
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
  roomType: 'green-room',
  doorPreset: 'single',
  furnitureType: 'dressing-table',
  notice: null,
  setChoice: (c) => set(c),
  setNotice: (notice) => set({ notice }),
  setTool: (tool) => set({ tool, draft: [], hover: null, notice: null, ...(tool !== 'select' ? { selected: null } : {}) }),
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
