import { useMemo, useState, type ReactNode } from 'react';
import { useActiveData, useActiveObjects, useActiveParams, useProjectStore } from '../../store/useProjectStore';
import { getTemplate } from '../../templates/registry';
import { getStageInfo } from '../../helpers/stageInfo';
import { getObjectType } from '../../objects/registry';
import { isOffStage, place } from '../../objects/geometry';
import { setProps } from '../../objects/actions';
import { isGroup, leafIds } from '../../objects/groups';
import type { SetObject } from '../../objects/types';

/** IDs of objects that are partly off the stage (shown with a warning). */
export function useOffStageIds() {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useActiveParams();
  const data = useActiveData();
  const objects = useActiveObjects();
  return useMemo(() => {
    const info = getStageInfo(getTemplate(templateId)!, params, data);
    return new Set(
      objects
        .filter((o) => {
          const p = place(o, info);
          return p && isOffStage(p, info);
        })
        .map((o) => o.id),
    );
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
const Folder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M3 6h6l2 2h10v11H3z" />
  </svg>
);

/**
 * Figma-style layers: a tree of objects and groups (folders). Click to select
 * (a group selects everything in it), Shift-click to add, double-click to
 * rename, drag to reorder within the same folder, eye/lock buttons on hover.
 */
export function LayersPanel() {
  const objects = useActiveObjects();
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const select = useProjectStore((s) => s.select);
  const updateObjects = useProjectStore((s) => s.updateObjects);
  const offStage = useOffStageIds();
  const [editing, setEditing] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const ids = new Set(objects.map((o) => o.id));
  const childrenOf = (parent: string | undefined) =>
    objects.filter((o) => (parent ? o.parent === parent : !o.parent || !ids.has(o.parent))).reverse(); // newest on top

  const moveTo = (id: string, targetId: string) => {
    if (id === targetId) return;
    updateObjects((list) => {
      const item = list.find((o) => o.id === id)!;
      const target = list.find((o) => o.id === targetId)!;
      if (item.parent !== target.parent) return list; // reorder within the same folder only
      const rest = list.filter((o) => o.id !== id);
      rest.splice(rest.findIndex((o) => o.id === targetId) + 1, 0, item);
      return rest;
    });
  };

  const row = (o: SetObject, depth: number): ReactNode => {
    const group = isGroup(o);
    const leaves = group ? leafIds(o.id, objects) : [o.id];
    const selected = leaves.length > 0 && leaves.every((id) => selectedIds.includes(id));
    const warn = leaves.some((id) => offStage.has(id));
    const open = !collapsed.has(o.id);
    return (
      <li key={o.id}>
        <div
          className={`layer ${selected ? 'is-selected' : ''} ${o.hidden ? 'is-hidden' : ''} ${dragId === o.id ? 'is-dragging' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
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
          onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? select([...new Set([...selectedIds, ...leaves])].filter((id) => !(selected && leaves.includes(id)))) : select(leaves))}
          onDoubleClick={() => setEditing(o.id)}
        >
          {group ? (
            <button
              className={`layer__chevron ${open ? 'is-open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                const next = new Set(collapsed);
                if (open) next.add(o.id);
                else next.delete(o.id);
                setCollapsed(next);
              }}
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              ▸
            </button>
          ) : (
            <span className="layer__chevron-space" />
          )}
          <span className="layer__icon">{group ? <Folder /> : getObjectType(o.type)?.icon}</span>
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
          {warn && (
            <span className="layer__warn" title="Partly off the stage">
              !
            </span>
          )}
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
        </div>
        {group && open && <ul className="layers__children">{childrenOf(o.id).map((c) => row(c, depth + 1))}</ul>}
      </li>
    );
  };

  if (!objects.length) return <p className="hint layers__empty">No objects yet. Add some from the library on the left.</p>;
  return (
    <ul className="layers" role="listbox" aria-multiselectable>
      {childrenOf(undefined).map((o) => row(o, 0))}
    </ul>
  );
}
