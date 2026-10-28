import { create } from 'zustand';
import type { FixtureState, Haze } from './types';

const ALL_KEY = 'stage-builder:light-all-settings';
function readAll() {
  try {
    return localStorage.getItem(ALL_KEY) === 'yes';
  } catch {
    return false;
  }
}

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
  /** Only these lights shine (to see what each one does); not saved. */
  solo: string[] | null;
  /** The table of every light. */
  tableOpen: boolean;
  /** The import dialog. */
  importOpen: boolean;
  /** Edit shows every setting, not just the main ones (remembered). */
  allSettings: boolean;
  select: (sel: LightSelection, additive?: boolean) => void;
  setFocusMode: (on: boolean) => void;
  toggleWorkLight: () => void;
  setLive: (live: { states: Record<string, FixtureState>; haze: Haze } | null) => void;
  setPlotOpen: (open: boolean) => void;
  setSolo: (ids: string[] | null) => void;
  setTableOpen: (open: boolean) => void;
  setImportOpen: (open: boolean) => void;
  toggleAllSettings: () => void;
}>((set, get) => ({
  selected: null,
  focusMode: false,
  workLight: false,
  live: null,
  plotOpen: false,
  solo: null,
  tableOpen: false,
  importOpen: false,
  allSettings: readAll(),
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
  setSolo: (solo) => set({ solo }),
  setTableOpen: (tableOpen) => set({ tableOpen }),
  setImportOpen: (importOpen) => set({ importOpen }),
  toggleAllSettings: () =>
    set((s) => {
      try {
        localStorage.setItem(ALL_KEY, s.allSettings ? 'no' : 'yes');
      } catch {
        /* private mode: just don't remember */
      }
      return { allSettings: !s.allSettings };
    }),
}));
