import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { nudge } from '../objects/actions';
import { M_PER_FT } from '../units';

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/**
 * App-wide keyboard shortcuts:
 *   ⌘/Ctrl+Z undo · ⌘/Ctrl+Shift+Z (or Ctrl+Y) redo
 *   With objects selected: Delete removes · ⌘/Ctrl+D duplicates · ⌘/Ctrl+G groups (Shift: ungroups) · arrows nudge (Shift = bigger steps) · Esc deselects
 */
export function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      const s = useProjectStore.getState();
      const key = e.key.toLowerCase();

      if (mod && (key === 'z' || key === 'y')) {
        if (typing) return; // let text fields undo their own typing
        e.preventDefault();
        if (key === 'y' || e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (typing || !s.selectedIds.length) return;

      if (mod && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) s.ungroupSelection();
        else s.groupSelection();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.removeObjects(s.selectedIds);
      } else if (mod && key === 'd') {
        e.preventDefault();
        s.duplicateObjects(s.selectedIds);
      } else if (ARROWS[e.key]) {
        e.preventDefault();
        // 5 cm (Shift: 50 cm), or 1 in (Shift: 1 ft) when working in feet.
        const step = s.units === 'ft' ? (e.shiftKey ? 1 : 1 / 12) * M_PER_FT : e.shiftKey ? 0.5 : 0.05;
        const [dx, dz] = ARROWS[e.key];
        nudge(dx * step, dz * step);
      } else if (e.key === 'Escape') {
        s.select([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
