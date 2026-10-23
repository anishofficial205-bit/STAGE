import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';

/**
 * Which labels the 3D view shows. Each mode shows only its own:
 * Stage — stage dimensions; Set — the selected piece's size; Lights — the
 * selected light and its aim; Blocking — performers and entrances; Venue — rooms.
 * Hovering anything shows its label, and the "All dimensions" setting shows
 * every dimension in every mode.
 */
export type LabelKind = 'stage-dim' | 'object-dim' | 'entrance' | 'performer' | 'path' | 'light' | 'room';

/** Higher wins when two labels overlap; the loser hides until hovered. */
export const LABEL_PRIORITY: Record<LabelKind, number> = {
  'object-dim': 70,
  light: 70,
  performer: 60,
  entrance: 50,
  room: 50,
  'stage-dim': 40,
  path: 30,
};

const PREF = 'stage-builder:all-dimensions';
const load = () => {
  try {
    return localStorage.getItem(PREF) === '1';
  } catch {
    return false;
  }
};

export const useLabelPrefs = create<{ allDimensions: boolean; toggleAllDimensions: () => void }>((set) => ({
  allDimensions: load(),
  toggleAllDimensions: () =>
    set((s) => {
      try {
        localStorage.setItem(PREF, s.allDimensions ? '0' : '1');
      } catch {
        /* not remembered */
      }
      return { allDimensions: !s.allDimensions };
    }),
}));

/** The thing under the pointer (e.g. "obj:abc", "perf:xyz"), so its label can show. */
export const useHoverLabel = create<{ key: string | null; set: (key: string | null) => void }>((set) => ({
  key: null,
  set: (key) => set({ key }),
}));

/** Pointer handlers that mark `key` as hovered (spread onto a mesh or group). */
export const hoverProps = (key: string) => ({
  onPointerOver: () => useHoverLabel.getState().set(key),
  onPointerOut: () => {
    if (useHoverLabel.getState().key === key) useHoverLabel.getState().set(null);
  },
});

/** True while the pointer is over the thing with this key. */
export const useHovered = (key?: string) => useHoverLabel((s) => !!key && s.key === key);

/** data-lp value for a label: its kind's priority, raised when selected and above everything when hovered. */
export const labelPriority = (kind: LabelKind, selected = false, hovered = false) => LABEL_PRIORITY[kind] + (selected ? 20 : 0) + (hovered ? 100 : 0);

const OWN_MODE: Record<LabelKind, string> = {
  'stage-dim': 'set',
  'object-dim': 'set',
  light: 'lights',
  performer: 'blocking',
  entrance: 'blocking',
  path: 'blocking',
  room: 'venue',
};

/** Labels that show in their mode without needing a selection. */
const ALWAYS_IN_MODE = new Set<LabelKind>(['performer', 'entrance', 'room']);

export function useShowLabel(kind: LabelKind, { selected = false, hoverKey }: { selected?: boolean; hoverKey?: string } = {}) {
  const mode = useProjectStore((s) => s.mode);
  // The stage's measurements show while the stage itself is selected.
  const stageSelected = useProjectStore((s) => s.stageSelected);
  if (kind === 'stage-dim') selected = selected || stageSelected;
  const all = useLabelPrefs((s) => s.allDimensions);
  const hovered = useHoverLabel((s) => !!hoverKey && s.key === hoverKey);
  if (hovered) return true;
  if (all && (kind === 'stage-dim' || kind === 'object-dim')) return true;
  if (mode !== OWN_MODE[kind]) return false;
  return ALWAYS_IN_MODE.has(kind) || selected;
}
