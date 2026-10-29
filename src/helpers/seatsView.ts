/**
 * "Show the audience" view setting: hiding the seats (and crowds) clears the
 * view while working on the stage. Pictures and exports always include them.
 */
import { create } from 'zustand';
import { useExportState } from '../export/state';

const KEY = 'stage-builder:show-seats';

function initial() {
  try {
    return localStorage.getItem(KEY) !== 'hidden';
  } catch {
    return true;
  }
}

export const useSeatsView = create<{ show: boolean; setShow: (show: boolean) => void }>((set) => ({
  show: initial(),
  setShow: (show) => {
    try {
      localStorage.setItem(KEY, show ? 'shown' : 'hidden');
    } catch {
      /* private mode: just don't remember */
    }
    set({ show });
  },
}));

/** Are seats drawn right now? */
export function useSeatsShown() {
  const show = useSeatsView((s) => s.show);
  const exporting = useExportState((s) => s.exporting);
  return show || exporting;
}
