import { create } from 'zustand';
import { useProjectStore } from '../../store/useProjectStore';
import { useLightsUI } from '../../lighting/ui';
import { useBlockingUI } from '../../blocking/ui';
import { useVenueUI, type VenueSelection } from '../../venue/ui';
import { MODES, type Mode } from '../../modes';

/** The groups in the layers list, and the mode that edits each one. */
export type Domain = 'stage' | 'set' | 'lights' | 'performers' | 'venue';
export const DOMAIN_MODE: Record<Domain, Mode> = { stage: 'set', set: 'set', lights: 'lights', performers: 'blocking', venue: 'venue' };
export const modeLabel = (m: Mode) => MODES.find((d) => d.id === m)?.label ?? m;

/** What a layers row points at: e.g. set/object, lights/fixture, lights/position, performers/performer, venue/room. */
export interface Pick {
  domain: Domain;
  kind: string;
  ids: string[];
}

/**
 * Something from another mode picked in the layers list. It isn't selected in its
 * own mode (so its 3D handles stay out of the way); Properties shows a short view
 * with "Edit in [mode]".
 */
export const useForeign = create<{ sel: Pick | null; set: (sel: Pick | null) => void }>((set) => ({ sel: null, set: (sel) => set({ sel }) }));

/** The current mode's own selection, as a Pick. */
export function ownSelection(): Pick | null {
  const s = useProjectStore.getState();
  if (s.mode === 'set') {
    if (s.stageSelected) return { domain: 'stage', kind: 'stage', ids: ['stage'] };
    return s.selectedIds.length ? { domain: 'set', kind: 'object', ids: s.selectedIds } : null;
  }
  if (s.mode === 'lights') {
    const l = useLightsUI.getState().selected;
    return l ? { domain: 'lights', kind: l.kind, ids: l.ids } : null;
  }
  if (s.mode === 'blocking') {
    const b = useBlockingUI.getState().selected;
    if (!b) return null;
    return b.kind === 'performer' ? { domain: 'performers', kind: 'performer', ids: b.ids } : { domain: 'performers', kind: b.kind, ids: [b.id] };
  }
  const v = useVenueUI.getState().selected;
  return v ? { domain: 'venue', kind: v.kind, ids: [v.id] } : null;
}

/** Re-renders on any selection change; returns the own selection and the foreign one. */
export function useSelections() {
  useProjectStore((s) => s.selectedIds);
  useProjectStore((s) => s.stageSelected);
  useProjectStore((s) => s.mode);
  useLightsUI((s) => s.selected);
  useBlockingUI((s) => s.selected);
  useVenueUI((s) => s.selected);
  const foreign = useForeign((s) => s.sel);
  return { own: ownSelection(), foreign };
}

/** Select in the domain's own store (the domain must belong to the current mode). */
export function selectOwn(p: Pick, additive = false) {
  useForeign.getState().set(null);
  if (p.domain === 'stage') return useProjectStore.getState().selectStage(true);
  if (p.domain === 'set') return useProjectStore.getState().select(p.ids, additive);
  if (p.domain === 'lights') return useLightsUI.getState().select({ kind: p.kind as 'fixture' | 'position', ids: p.ids }, additive);
  if (p.domain === 'performers') {
    if (p.kind === 'performer') return useBlockingUI.getState().select({ kind: 'performer', ids: p.ids }, additive);
    return useBlockingUI.getState().select({ kind: p.kind as 'path' | 'entrance' | 'mark', id: p.ids[0] });
  }
  useVenueUI.getState().select({ kind: p.kind as NonNullable<VenueSelection>['kind'], id: p.ids[0] });
}

/** Pick from the layers list: in the current mode it selects; from another mode it shows the short view. */
export function pick(p: Pick, additive = false) {
  if (DOMAIN_MODE[p.domain] === useProjectStore.getState().mode) return selectOwn(p, additive);
  const cur = useForeign.getState().sel;
  if (additive && cur && cur.domain === p.domain && cur.kind === p.kind) {
    const ids = [...cur.ids];
    for (const id of p.ids) ids.includes(id) ? ids.splice(ids.indexOf(id), 1) : ids.push(id);
    useForeign.getState().set(ids.length ? { ...cur, ids } : null);
  } else useForeign.getState().set(p);
}

/** Switch to the mode that edits this and select it there. */
export function editIn(p: Pick) {
  useProjectStore.getState().setMode(DOMAIN_MODE[p.domain]);
  selectOwn(p);
}

// A foreign pick only lasts until the mode changes or the mode's own selection does.
useProjectStore.subscribe((s, prev) => {
  if (s.mode !== prev.mode || (s.selectedIds !== prev.selectedIds && s.selectedIds.length) || (s.stageSelected && !prev.stageSelected)) useForeign.getState().set(null);
});
for (const store of [useLightsUI, useBlockingUI, useVenueUI] as const) {
  (store as unknown as { subscribe: (f: (s: { selected: unknown }, p: { selected: unknown }) => void) => void }).subscribe((s, p) => {
    if (s.selected && s.selected !== p.selected) useForeign.getState().set(null);
  });
}
