import { useEffect, useState } from 'react';
import { Modal } from './Modal';

/** Open the shortcuts sheet from anywhere (the "?" key or the help menu). */
export const SHORTCUTS_EVENT = 'stage-builder:shortcuts';

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'General',
    rows: [
      ['⌘Z / Ctrl+Z', 'Undo'],
      ['⇧⌘Z / Ctrl+Y', 'Redo'],
      ['⌘S / Ctrl+S', 'Save now (your work also saves automatically)'],
      ['1 – 5', 'Switch mode: Venue, Stage, Set, Lights, Blocking'],
      ['?', 'Show this sheet'],
      ['Esc', 'Deselect, or leave a seat'],
    ],
  },
  {
    title: 'Set pieces',
    rows: [
      ['Click / Shift-click', 'Select / add to the selection'],
      ['Double-click', 'Select one piece inside a group'],
      ['Drag', 'Move along the floor (snaps to grid, stage edges and other pieces)'],
      ['⌘/Ctrl while dragging', 'Move freely, without snapping'],
      ['Shift while rotating, resizing or raising', 'Free movement (no 15° / 5 cm steps)'],
      ['Arrow keys', 'Nudge 5 cm (Shift: 50 cm)'],
      ['Delete / Backspace', 'Delete'],
      ['⌘D / Ctrl+D', 'Duplicate'],
      ['⌘G / ⇧⌘G', 'Group / ungroup'],
      ['Alt/Option-click a face', 'Pick that face for colour, material or graphics'],
      ['Right-click a face', 'Add, replace or remove its graphic'],
    ],
  },
  {
    title: 'Venue plan',
    rows: [
      ['W / V', 'Wall tool / select tool'],
      ['Click, double-click', 'Add a corner, finish the wall (click the first corner to close a room)'],
      ['Shift / ⌘/Ctrl while drawing', 'Any angle / no snapping'],
      ['Enter, Backspace, Esc', 'Finish, remove the last corner, cancel'],
      ['Scroll, drag background', 'Zoom, pan the plan'],
    ],
  },
  {
    title: 'Seat view',
    rows: [
      ['Click a seat', 'Sit there'],
      ['← →', 'Next / previous seat in the row'],
      ['↑ ↓', 'Row behind / in front'],
    ],
  },
  {
    title: 'Black Box blocks',
    rows: [
      ['R / Shift+R', 'Rotate 15° / 90°'],
      ['⌘D, Delete', 'Duplicate, delete'],
    ],
  },
  {
    title: 'Camera',
    rows: [
      ['Drag', 'Orbit'],
      ['Right-drag', 'Pan'],
      ['Scroll', 'Zoom'],
    ],
  },
];

export function ShortcutsSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.key === '?') setOpen((o) => !o);
    };
    window.addEventListener(SHORTCUTS_EVENT, show);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(SHORTCUTS_EVENT, show);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  if (!open) return null;
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setOpen(false)} wide>
      <div className="shortcuts">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="group__title">{g.title}</h3>
            <dl>
              {g.rows.map(([k, v]) => (
                <div key={k} className="shortcut">
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
