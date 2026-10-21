import { useMemo, useState } from 'react';
import { useActiveData, useActiveObjects, useActiveParams, useProjectStore } from '../../store/useProjectStore';
import { getTemplate } from '../../templates/registry';
import { getStageInfo } from '../../helpers/stageInfo';
import { getObjectType } from '../../objects/registry';
import { isOffStage, place } from '../../objects/geometry';
import { setProps } from '../../objects/actions';

/** IDs of objects that are partly off the stage (shown with a warning). */
export function useOffStageIds() {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useActiveParams();
  const data = useActiveData();
  const objects = useActiveObjects();
  return useMemo(() => {
    const info = getStageInfo(getTemplate(templateId)!, params, data);
    return new Set(objects.filter((o) => {
      const p = place(o, info);
      return p && isOffStage(p, info);
    }).map((o) => o.id));
  }, [templateId, params, data, objects]);
}

const Eye = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);
const Lock = ({ on }: { on?: boolean }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d={on ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2'} />
  </svg>
);

/** Figma-style list of placed objects: select, rename (double-click), hide, lock, drag to reorder. */
export function LayersPanel() {
  const objects = useActiveObjects();
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const select = useProjectStore((s) => s.select);
  const updateObjects = useProjectStore((s) => s.updateObjects);
  const offStage = useOffStageIds();
  const [editing, setEditing] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // Newest at the top, like a design tool.
  const rows = [...objects].reverse();

  const moveTo = (id: string, targetId: string) => {
    if (id === targetId) return;
    updateObjects((list) => {
      const from = list.findIndex((o) => o.id === id);
      const item = list[from];
      const rest = list.filter((o) => o.id !== id);
      const to = rest.findIndex((o) => o.id === targetId);
      // Rows are displayed reversed, so dropping "above" a row means after it in the list.
      rest.splice(to + 1, 0, item);
      return rest;
    });
  };

  if (!objects.length) return <p className="hint layers__empty">No objects yet. Add some from the library on the left.</p>;

  return (
    <ul className="layers" role="listbox" aria-multiselectable>
      {rows.map((o) => {
        const type = getObjectType(o.type);
        const selected = selectedIds.includes(o.id);
        return (
          <li
            key={o.id}
            className={`layer ${selected ? 'is-selected' : ''} ${o.hidden ? 'is-hidden' : ''} ${dragId === o.id ? 'is-dragging' : ''}`}
            role="option"
            aria-selected={selected}
            draggable={editing !== o.id}
            onDragStart={(e) => {
              setDragId(o.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => dragId && e.preventDefault()}
            onDrop={() => dragId && moveTo(dragId, o.id)}
            onDragEnd={() => setDragId(null)}
            onClick={(e) => select([o.id], e.shiftKey || e.metaKey || e.ctrlKey)}
            onDoubleClick={() => setEditing(o.id)}
          >
            <span className="layer__icon">{type?.icon}</span>
            {editing === o.id ? (
              <input
                className="layer__input"
                autoFocus
                defaultValue={o.name}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => {
                  setProps(o.id, { name: e.target.value.trim() || o.name });
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditing(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="layer__name">{o.name}</span>
            )}
            {offStage.has(o.id) && <span className="layer__warn" title="Partly off the stage">!</span>}
            <button
              className={`layer__btn ${o.hidden ? 'is-on' : ''}`}
              title={o.hidden ? 'Show' : 'Hide'}
              onClick={(e) => {
                e.stopPropagation();
                setProps(o.id, { hidden: !o.hidden });
              }}
            >
              <Eye off={o.hidden} />
            </button>
            <button
              className={`layer__btn ${o.locked ? 'is-on' : ''}`}
              title={o.locked ? 'Unlock' : 'Lock (can’t be moved in the view)'}
              onClick={(e) => {
                e.stopPropagation();
                setProps(o.id, { locked: !o.locked });
              }}
            >
              <Lock on={o.locked} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
