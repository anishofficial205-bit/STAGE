import { create } from 'zustand';
import type { FixtureState, Haze } from './types';

export type LightSelection = { kind: 'fixture' | 'position'; ids: string[] } | null;

/** Lights-mode editing state (not saved with the project). */
export const useLightsUI = create<{
  selected: LightSelection;
  /** Next click in the view aims the selected lights there. */
  focusMode: boolean;
  /** Flat bright light for building; off shows the stage as lit. */
  workLight: boolean;
  /** While a look fades in: the in-between states (not saved). */
  live: { states: Record<string, FixtureState>; haze: Haze } | null;
  plotOpen: boolean;
  select: (sel: LightSelection, additive?: boolean) => void;
  setFocusMode: (on: boolean) => void;
  toggleWorkLight: () => void;
  setLive: (live: { states: Record<string, FixtureState>; haze: Haze } | null) => void;
  setPlotOpen: (open: boolean) => void;
}>((set, get) => ({
  selected: null,
  focusMode: false,
  workLight: false,
  live: null,
  plotOpen: false,
  select: (sel, additive = false) => {
    const cur = get().selected;
    if (additive && sel && cur && cur.kind === sel.kind) {
      const ids = [...cur.ids];
      for (const id of sel.ids) ids.includes(id) ? ids.splice(ids.indexOf(id), 1) : ids.push(id);
      set({ selected: ids.length ? { kind: sel.kind, ids } : null, focusMode: false });
    } else set({ selected: sel, focusMode: false });
  },
  setFocusMode: (focusMode) => set({ focusMode }),
  toggleWorkLight: () => set((s) => ({ workLight: !s.workLight })),
  setLive: (live) => set({ live }),
  setPlotOpen: (plotOpen) => set({ plotOpen }),
}));
