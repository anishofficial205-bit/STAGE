import { create } from 'zustand';
import type { SeatInfo } from '../types';

interface SightlineState {
  seatView: boolean;
  /** Seat under the mouse in seat view. */
  hovered: SeatInfo | null;
  /** Seat the camera is sitting in. */
  current: SeatInfo | null;
  /** Objects (ids) in the way from the current seat, and whether the stage itself blocks part of the view. */
  blocking: { ids: string[]; stage: boolean; clear: number } | null;
  sightlinesOn: boolean;
  /** Clear-view fraction per seat (same order as the template's seats()), or null while not computed. */
  results: Float32Array | null;
  /** 0–1 while computing. */
  progress: number | null;
  /** Objects taller than this (m above the stage floor) trigger warnings on thrust / traverse / in-the-round. */
  tallThreshold: number;
  set: (s: Partial<SightlineState>) => void;
}

/** Seat view and sightline state (UI only; not saved, not undoable). */
export const useSightlines = create<SightlineState>((set) => ({
  seatView: false,
  hovered: null,
  current: null,
  blocking: null,
  sightlinesOn: false,
  results: null,
  progress: null,
  tallThreshold: 1.5,
  set: (s) => set(s),
}));
