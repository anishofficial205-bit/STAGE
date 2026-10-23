import { useEffect } from 'react';
import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import { useLightsUI } from '../lighting/ui';
import { useBlockingUI } from '../blocking/ui';
import { useVenueUI } from '../venue/ui';

const KEY = 'stage-builder:panels';
/** Below this width the side panels become drawers over the stage. */
export const NARROW = 1100;
/** Below this width only one drawer is open at a time. */
export const TINY = 768;

function initialPanels() {
  try {
    return localStorage.getItem(KEY) !== 'hidden';
  } catch {
    return true;
  }
}

type Drawer = 'left' | 'right';

interface Shell {
  /** Focus mode off: panels shown. */
  panels: boolean;
  togglePanels: () => void;
  /** On narrow screens: which drawers are open. */
  drawers: Record<Drawer, boolean>;
  setDrawer: (d: Drawer, open: boolean) => void;
  /** Open the drawer for the current task and close the other. */
  focusDrawer: (d: Drawer) => void;
  /** The start screen ("What are you making?") is showing. */
  home: boolean;
  setHome: (home: boolean) => void;
  /** The New project dialog is open. */
  newProject: boolean;
  setNewProject: (open: boolean) => void;
}

/** Focus layout: the side panels float over the full-screen stage and can be tucked away. */
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
  drawers: { left: true, right: false },
  setDrawer: (d, open) =>
    set((s) => {
      const tiny = window.innerWidth < TINY;
      const drawers = { ...s.drawers, [d]: open };
      if (open && tiny) drawers[d === 'left' ? 'right' : 'left'] = false;
      return { drawers };
    }),
  focusDrawer: (d) => set({ drawers: { left: d === 'left', right: d === 'right' } }),
  // The home page always comes first.
  home: true,
  setHome: (home) => set({ home }),
  newProject: false,
  setNewProject: (newProject) => set({ newProject }),
}));

/**
 * On narrow screens, open the drawer for what you're doing: the tools when you
 * switch mode, the details when you select something.
 */
export function useTaskDrawers() {
  useEffect(() => {
    const focus = (d: Drawer) => {
      if (window.innerWidth < NARROW) useShell.getState().focusDrawer(d);
    };
    /** Is something picked in the current mode? */
    const anySelected = () => {
      const m = useProjectStore.getState().mode;
      if (m === 'lights') return !!useLightsUI.getState().selected;
      if (m === 'blocking') return !!useBlockingUI.getState().selected;
      if (m === 'venue') return !!useVenueUI.getState().selected;
      return useProjectStore.getState().selectedIds.length > 0;
    };
    let had = anySelected();
    const onSelect = () => {
      const has = anySelected();
      if (has && !had) focus('right');
      had = has;
    };
    const unsubs = [
      useProjectStore.subscribe((s, p) => {
        if (s.mode !== p.mode) {
          focus('left');
          had = anySelected();
        }
        if (s.selectedIds !== p.selectedIds) onSelect();
      }),
      useLightsUI.subscribe(onSelect),
      useBlockingUI.subscribe(onSelect),
      useVenueUI.subscribe(onSelect),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);
}
