import { create } from 'zustand';
import type { Pt } from './types';
import type { SeatInfo } from '../types';

export type BlockingSelection = { kind: 'performer'; ids: string[] } | { kind: 'path' | 'entrance' | 'mark'; id: string } | null;
export type BlockingTool = 'path' | 'entrance' | 'mark' | null;

export interface BlockingWarning {
  id: string;
  kind: 'wings' | 'hidden' | 'collision' | 'upstaged';
  time: number;
  /** Until when it lasts (for the list). */
  until: number;
  performerIds: string[];
  text: string;
  /** Seats that see (or can't see) the performer, to show in the view. */
  seats?: SeatInfo[];
}

/** Blocking-mode state (not saved): selection, tools, playback and check results. */
export const useBlockingUI = create<{
  selected: BlockingSelection;
  tool: BlockingTool;
  draft: Pt[];
  hover: Pt | null;
  time: number;
  playing: boolean;
  rate: number;
  follow: boolean;
  warnings: BlockingWarning[] | null;
  checking: number | null;
  highlight: BlockingWarning | null;
  select: (sel: BlockingSelection, additive?: boolean) => void;
  setTool: (tool: BlockingTool) => void;
  setDraft: (draft: Pt[]) => void;
  setHover: (hover: Pt | null) => void;
  setTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setRate: (rate: number) => void;
  toggleFollow: () => void;
  setWarnings: (w: BlockingWarning[] | null) => void;
  setChecking: (p: number | null) => void;
  setHighlight: (w: BlockingWarning | null) => void;
}>((set, get) => ({
  selected: null,
  tool: null,
  draft: [],
  hover: null,
  time: 0,
  playing: false,
  rate: 1,
  follow: false,
  warnings: null,
  checking: null,
  highlight: null,
  select: (sel, additive = false) => {
    const cur = get().selected;
    if (additive && sel?.kind === 'performer' && cur?.kind === 'performer') {
      const ids = [...cur.ids];
      for (const id of sel.ids) ids.includes(id) ? ids.splice(ids.indexOf(id), 1) : ids.push(id);
      set({ selected: ids.length ? { kind: 'performer', ids } : null });
    } else set({ selected: sel });
  },
  setTool: (tool) => set({ tool, draft: [], hover: null }),
  setDraft: (draft) => set({ draft }),
  setHover: (hover) => set({ hover }),
  setTime: (time) => set({ time: Math.max(0, time) }),
  setPlaying: (playing) => set({ playing }),
  setRate: (rate) => set({ rate }),
  toggleFollow: () => set((s) => ({ follow: !s.follow })),
  setWarnings: (warnings) => set({ warnings }),
  setChecking: (checking) => set({ checking }),
  setHighlight: (highlight) => set({ highlight }),
}));
