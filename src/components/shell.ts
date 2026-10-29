import { create } from 'zustand';

const KEY = 'stage-builder:panels';
/** Below this width the sidebar starts folded (open, it covers the stage). */
export const NARROW = 1100;

function initialPanels() {
  try {
    return localStorage.getItem(KEY) !== 'hidden';
  } catch {
    return true;
  }
}

/** The left sidebar's tabs (null: folded to its rail). */
export type DockTab = 'add' | 'pictures' | 'library' | 'edit' | 'layers';
const TABS: DockTab[] = ['add', 'pictures', 'library', 'edit', 'layers'];
const DOCK_KEY = 'stage-builder:dock';
function initialDock(): DockTab | null {
  // On a small screen the sidebar would cover the stage: start folded.
  if (window.innerWidth < NARROW) return null;
  try {
    const v = localStorage.getItem(DOCK_KEY);
    return v === 'none' ? null : TABS.includes(v as DockTab) ? (v as DockTab) : 'add';
  } catch {
    return 'add';
  }
}

interface Shell {
  /** Focus mode off: panels shown. */
  panels: boolean;
  togglePanels: () => void;
  /** The left sidebar: which tab is open, or null when it's folded to its rail. */
  dock: DockTab | null;
  setDock: (tab: DockTab | null) => void;
  /** The start screen ("What are you making?") is showing. */
  home: boolean;
  setHome: (home: boolean) => void;
  /** The New project dialog is open. */
  newProject: boolean;
  /** The new-project dialog reused to change the open project's stage. */
  changingStage: boolean;
  /** The stage type to start the dialog on (e.g. a stage-type tile on Home). */
  newProjectPick: string | null;
  setNewProject: (open: boolean, changingStage?: boolean, pick?: string | null) => void;
}

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
    set({ dock });
  },
  // The home page always comes first.
  home: true,
  setHome: (home) => set({ home }),
  newProject: false,
  changingStage: false,
  newProjectPick: null,
  setNewProject: (newProject, changingStage = false, newProjectPick = null) => set({ newProject, changingStage, newProjectPick }),
}));
