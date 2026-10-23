import { useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { ACCEPT, importOnto, removeFaceGraphic } from '../../graphics/library';
import { SURFACE, useObjectUI } from '../../objects/ui';
import { announceMenuOpened } from '../useDismiss';
import { duplicate, isLocked, remove, toggleHidden, toggleLocked } from '../layers/ops';

/** Right-click menu on a face: add/replace or remove its graphic. */
export function FaceContextMenu() {
  const menu = useObjectUI((s) => s.menu);
  const input = useRef<HTMLInputElement>(null);
  const hasGraphic = useProjectStore((s) => {
    if (!menu) return false;
    const t = menu.target;
    if (t.objectId === SURFACE) return !!s.surfaceStylesByTemplate[s.templateId]?.[t.face]?.graphic;
    const o = (s.objectsByTemplate[s.templateId] ?? []).find((x) => x.id === t.objectId);
    return !!(o?.faces?.[t.face] ?? o?.faces?.['*'])?.graphic;
  });
  useEffect(() => {
    if (!menu) return;
    announceMenuOpened('face-menu');
    const close = () => useObjectUI.getState().setMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [menu]);
  const target = menu?.target;
  return (
    <>
      {menu && target && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()} role="menu">
          <button
            role="menuitem"
            onClick={() => {
              input.current?.click();
            }}
          >
            {hasGraphic ? 'Replace graphic…' : 'Add graphic…'}
          </button>
          {hasGraphic && (
            <button
              role="menuitem"
              onClick={() => {
                removeFaceGraphic(target);
                useObjectUI.getState().setMenu(null);
              }}
            >
              Remove graphic
            </button>
          )}
          <button
            role="menuitem"
            onClick={() => {
              useObjectUI.getState().setSelectedFace(target);
              if (target.objectId !== SURFACE) useProjectStore.getState().select([target.objectId]);
              useObjectUI.getState().setMenu(null);
            }}
          >
            Edit face…
          </button>
          {target.objectId !== SURFACE && <ObjectItems id={target.objectId} />}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          if (target) void importOnto(target, [...(e.target.files ?? [])]);
          e.target.value = '';
          useObjectUI.getState().setMenu(null);
        }}
      />
    </>
  );
}

/** The same item actions as the layers menu, for the piece under the cursor. */
function ObjectItems({ id }: { id: string }) {
  const item = { domain: 'set' as const, kind: 'object', id };
  const close = () => useObjectUI.getState().setMenu(null);
  const act = (f: () => void) => () => (close(), f());
  return (
    <>
      <span className="context-menu__rule" />
      <button role="menuitem" onClick={act(() => duplicate([item]))}>
        Duplicate
      </button>
      <button role="menuitem" onClick={act(() => toggleHidden(item))}>
        Hide
      </button>
      <button role="menuitem" onClick={act(() => toggleLocked(item))}>
        {isLocked(item) ? 'Unlock' : 'Lock'}
      </button>
      <button role="menuitem" className="is-danger" onClick={act(() => remove([item]))}>
        Delete
      </button>
    </>
  );
}
