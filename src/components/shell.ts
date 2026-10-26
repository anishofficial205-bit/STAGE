import { useEffect } from 'react';
import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import { useLightsUI } from '../lighting/ui';
import { useBlockingUI } from '../blocking/ui';
import { useVenueUI } from '../venue/ui';
import { useForeign } from './layers/selection';

const KEY = 'stage-builder:panels';
/** Below this width the side panels become drawers over the stage. */
export const NARROW = 1100;

function initialPanels() {
  try {
    return localStorage.getItem(KEY) !== 'hidden';
  } catch {
    return true;
  }
}

/** The left panel's tabs (null: tucked away). */
export type DockTab = 'add' | 'edit' | 'pictures';
const DOCK_KEY = 'stage-builder:dock';
function initialDock(): DockTab | null {
  try {
    const v = localStorage.getItem(DOCK_KEY);
    return v === 'none' ? null : v === 'edit' || v === 'pictures' ? v : 'add';
  } catch {
    return 'add';
  }
}

interface Shell {
  /** Focus mode off: panels shown. */
  panels: boolean;
  togglePanels: () => void;
  /** The left panel: which tab is open, or null when it's tucked away. */
  dock: DockTab | null;
  setDock: (tab: DockTab | null) => void;
  /** On narrow screens the Layers panel is a drawer: is it open? */
  layers: boolean;
  setLayers: (open: boolean) => void;
  /** The start screen ("What are you making?") is showing. */
  home: boolean;
  setHome: (home: boolean) => void;
  /** The New project dialog is open. */
  newProject: boolean;
  /** The new-project dialog reused to change the open project's stage. */
  changingStage: boolean;
  setNewProject: (open: boolean, changingStage?: boolean) => void;
}

const narrow = () => window.innerWidth < NARROW;

/** Focus layout: the panels float over the full-screen stage and can be tucked away. */
export const useShell = create<Shell>((set) => ({
  panels: initialPanels(),
  togglePanels: () =>
    set((s) => {
      try {
        localStorage.setItem(KEY, s.panels ? 'hidden' : 'shown');
      } catch {
        /* private mode: just don't remember */
      }
      return { panels: !s.panels };
    }),
  dock: initialDock(),
  setDock: (dock) => {
    try {
      localStorage.setItem(DOCK_KEY, dock ?? 'none');
    } catch {
      /* not remembered */
    }
    // On a narrow screen only one panel is out at a time.
    set(dock && narrow() ? { dock, layers: false } : { dock });
  },
  layers: false,
  setLayers: (layers) => set(layers && narrow() ? { layers, dock: null } : { layers }),
  // The home page always comes first.
  home: true,
  setHome: (home) => set({ home }),
  newProject: false,
  changingStage: false,
  setNewProject: (newProject, changingStage = false) => set({ newProject, changingStage }),
}));

/**
 * The left panel follows what you're doing without getting in the way: picking a
 * piece leaves it alone (the quick bar over the piece has the common actions and
 * More opens Edit), so you can keep adding. The stage and things picked from
 * another mode have no quick bar, so they open Edit — and letting go of them
 * goes back to the tab you were on.
 */
export function useDockFollowsSelection() {
  useEffect(() => {
    /** Is something picked in the current mode? */
    const anySelected = () => {
      const m = useProjectStore.getState().mode;
      if (m === 'lights') return !!useLightsUI.getState().selected;
      if (m === 'blocking') return !!useBlockingUI.getState().selected;
      if (m === 'venue') return !!useVenueUI.getState().selected;
      return useProjectStore.getState().selectedIds.length > 0;
    };
    let had = anySelected();
    // The tab the panel was on before a pick switched it to Edit: letting go goes back there.
    let back: DockTab | null = null;
    const toEdit = () => {
      const sh = useShell.getState();
      if (!sh.dock || sh.dock === 'edit') return;
      back = sh.dock;
      sh.setDock('edit');
    };
    const goBack = () => {
      const sh = useShell.getState();
      if (back && sh.dock === 'edit') sh.setDock(back);
      back = null;
    };
    const onSelect = () => {
      const has = anySelected();
      if (!has && had && !useProjectStore.getState().stageSelected) goBack();
      had = has;
    };
    const unsubs = [
      useProjectStore.subscribe((s, p) => {
        if (s.mode !== p.mode) {
          had = anySelected();
          goBack();
        }
        if (s.stageSelected && !p.stageSelected) {
          if (useShell.getState().dock) toEdit();
          else useShell.getState().setDock('edit');
        }
        if (!s.stageSelected && p.stageSelected && !anySelected()) goBack();
        if (s.selectedIds !== p.selectedIds) onSelect();
      }),
      useLightsUI.subscribe(onSelect),
      useBlockingUI.subscribe(onSelect),
      useVenueUI.subscribe(onSelect),
      useForeign.subscribe((s, p) => {
        if (s.sel && s.sel !== p.sel) {
          if (useShell.getState().dock) toEdit();
          else useShell.getState().setDock('edit');
        }
        if (!s.sel && p.sel) goBack();
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);
}
