import { create } from 'zustand';

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
export type DockTab = 'add' | 'pictures';
const DOCK_KEY = 'stage-builder:dock';
function initialDock(): DockTab | null {
  try {
    const v = localStorage.getItem(DOCK_KEY);
    return v === 'none' ? null : v === 'pictures' ? v : 'add';
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
