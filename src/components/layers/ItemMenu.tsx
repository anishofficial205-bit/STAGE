import { useRef } from 'react';
import { create } from 'zustand';
import { useProjectStore } from '../../store/useProjectStore';
import { useShell } from '../shell';
import { useDismiss } from '../useDismiss';
import { Modal } from '../Modal';
import { DOMAIN_MODE, editIn, modeLabel, type Pick } from './selection';
import { can, duplicate, groupSize, isHidden, isLocked, nameOf, remove, toggleHidden, toggleLocked, ungroup, type Item } from './ops';

interface MenuState {
  item: Item;
  /** What "Edit in [mode]" selects there. */
  pick: Pick;
  x: number;
  y: number;
  onRename?: () => void;
}

/** The one menu for any item — from a layers row (⋯ or right-click) or a right-click in the 3D view. */
export const useItemMenu = create<{ menu: MenuState | null; open: (m: MenuState) => void; close: () => void }>((set) => ({
  menu: null,
  open: (menu) => set({ menu }),
  close: () => set({ menu: null }),
}));

/** Deleting a group asks first: everything in it, or just the group. */
const useGroupDelete = create<{ item: Item | null; ask: (item: Item | null) => void }>((set) => ({ item: null, ask: (item) => set({ item }) }));

/** Delete, asking first when it's a group with things in it. */
export function deleteItem(item: Item) {
  if (groupSize(item) > 0) useGroupDelete.getState().ask(item);
  else remove([item]);
}

export function ItemMenu() {
  const menu = useItemMenu((s) => s.menu);
  const close = useItemMenu((s) => s.close);
  const confirm = useGroupDelete((s) => s.item);
  return (
    <>
      {menu && <MenuList m={menu} onClose={close} />}
      {confirm && <GroupDelete item={confirm} />}
    </>
  );
}

function MenuList({ m, onClose }: { m: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);
  const mode = useProjectStore((s) => s.mode);
  // Re-render when the item changes (hidden, locked).
  useProjectStore((s) => s.objectsByTemplate);
  useProjectStore((s) => s.lightingByTemplate);
  useProjectStore((s) => s.blockingByTemplate);
  const { item, pick } = m;
  const caps = can(item);
  const target = DOMAIN_MODE[item.domain];
  const act = (f: () => void) => () => {
    onClose();
    f();
  };
  return (
    <div className="menu__list layer-menu" role="menu" ref={ref} style={{ left: Math.min(m.x, window.innerWidth - 200), top: Math.min(m.y, window.innerHeight - 260) }}>
      {item.domain === 'stage' ? (
        <>
          <button role="menuitem" onClick={act(() => editIn(pick))}>
            Stage settings
          </button>
          <button role="menuitem" onClick={act(() => useShell.getState().setNewProject(true, true))}>
            Change stage type…
          </button>
        </>
      ) : (
        <>
          {caps.rename && m.onRename && (
            <button role="menuitem" onClick={act(m.onRename)}>
              Rename
            </button>
          )}
          {caps.duplicate && (
            <button role="menuitem" onClick={act(() => duplicate([item]))}>
              Duplicate
            </button>
          )}
          {caps.hide && (
            <button role="menuitem" onClick={act(() => toggleHidden(item))}>
              {isHidden(item) ? 'Show' : 'Hide'}
            </button>
          )}
          {caps.lock && (
            <button role="menuitem" onClick={act(() => toggleLocked(item))}>
              {isLocked(item) ? 'Unlock' : 'Lock'}
            </button>
          )}
          {target !== mode && (
            <button role="menuitem" onClick={act(() => editIn(pick))}>
              Edit in {modeLabel(target)}
            </button>
          )}
          <button role="menuitem" className="is-danger" onClick={act(() => deleteItem(item))}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}

function GroupDelete({ item }: { item: Item }) {
  const n = groupSize(item);
  const close = () => useGroupDelete.getState().ask(null);
  return (
    <Modal title={`Delete the group and its ${n} item${n === 1 ? '' : 's'}?`} onClose={close}>
      <p className="modal__text">“{nameOf(item)}” holds {n} item{n === 1 ? '' : 's'}. You can delete them all, or just take the group apart and keep them.</p>
      <div className="modal__actions">
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button className="btn" onClick={() => (close(), ungroup(item))}>
          Ungroup only
        </button>
        <button className="btn btn--danger" autoFocus onClick={() => (close(), remove([item]))}>
          Delete all
        </button>
      </div>
    </Modal>
  );
}
