import { useState, type ReactNode } from 'react';
import { Field } from '../fields';
import { useActiveObjects, useProjectStore } from '../../store/useProjectStore';
import { isGroup, unitsOf } from '../../objects/groups';
import { setProps } from '../../objects/actions';
import { align, distribute, flipSelection, makeArray, mirrorCopy, type AlignMode, type ArrayOptions } from '../../objects/arrange';
import { Collapsible } from '../Collapsible';
import { removePick } from '../layers/ops';

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d={d} />
  </svg>
);
/** Plan-view icons: left/right are stage-left/right as seen from the audience; front is downstage. */
const ALIGN: { mode: AlignMode; title: string; icon: string }[] = [
  { mode: 'left', title: 'Align left edges', icon: 'M4 3v18M8 7h10M8 15h6' },
  { mode: 'centre', title: 'Align centres (left–right)', icon: 'M12 3v18M6 7h12M8 15h8' },
  { mode: 'right', title: 'Align right edges', icon: 'M20 3v18M6 7h10M10 15h6' },
  { mode: 'back', title: 'Align back edges (upstage)', icon: 'M3 4h18M7 8v10M15 8v6' },
  { mode: 'middle', title: 'Align middles (up–downstage)', icon: 'M3 12h18M7 6v12M15 8v8' },
  { mode: 'front', title: 'Align front edges (downstage)', icon: 'M3 20h18M7 6v10M15 10v6' },
];

function IconButton({ title, onClick, children, disabled }: { title: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button className="btn btn--icon btn--tool" title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** Shown when several objects (or a group) are selected. */
export function MultiProperties() {
  const objects = useActiveObjects();
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const { duplicateObjects, select, groupSelection, ungroupSelection } = useProjectStore.getState();
  const units = unitsOf(selectedIds, objects);
  const groupUnit = units.length === 1 ? objects.find((o) => o.id === units[0] && isGroup(o)) : undefined;
  const hasGroup = units.some((u) => isGroup(objects.find((o) => o.id === u)!));

  return (
    <div className="obj-props">
      <div className="panel-head">
        {groupUnit ? (
          <input className="obj-props__name" value={groupUnit.name} onChange={(e) => setProps(groupUnit.id, { name: e.target.value }, `name:${groupUnit.id}`)} aria-label="Group name" />
        ) : (
          <h2 className="panel-title">{selectedIds.length} objects</h2>
        )}
        <button className="btn btn--link" onClick={() => select([])}>
          Done
        </button>
      </div>
      <p className="hint obj-props__type">
        {groupUnit ? `Group · ${selectedIds.length} objects. Double-click one in the view to select it alone.` : 'Drag any of them to move them together.'}
      </p>

      <div className="btn-row">
        {units.length > 1 && (
          <button className="btn" onClick={groupSelection} title="Group (⌘G)">
            Group
          </button>
        )}
        {hasGroup && (
          <button className="btn" onClick={ungroupSelection} title="Ungroup (⇧⌘G)">
            Ungroup
          </button>
        )}
      </div>

      {units.length > 1 && (
        <section className="group">
          <h3 className="group__title">Align</h3>
          <div className="tool-row">
            {ALIGN.map((a) => (
              <IconButton key={a.mode} title={a.title} onClick={() => align(a.mode)}>
                <I d={a.icon} />
              </IconButton>
            ))}
          </div>
          <h3 className="group__title">Distribute evenly</h3>
          <div className="btn-row">
            <button className="btn" disabled={units.length < 3} onClick={() => distribute('x')} title="Equal gaps across the width (needs 3 or more)">
              Across width
            </button>
            <button className="btn" disabled={units.length < 3} onClick={() => distribute('z')} title="Equal gaps across the depth (needs 3 or more)">
              Across depth
            </button>
          </div>
        </section>
      )}

      <section className="group">
        <h3 className="group__title">Mirror</h3>
        <div className="btn-row">
          <button className="btn" onClick={flipSelection} title="Flip the selection left–right in place">
            Flip left–right
          </button>
          <button className="btn" onClick={mirrorCopy} title="Make a mirrored copy on the other side of the stage centre line">
            Mirror copy
          </button>
        </div>
      </section>

      {units.length === 1 && <ArrayTool />}

      <div className="btn-row">
        <button className="btn" onClick={() => duplicateObjects(selectedIds)}>
          Duplicate
        </button>
        <button className="btn btn--danger" onClick={() => removePick({ domain: 'set', kind: 'object', ids: selectedIds })}>
          Delete
        </button>
      </div>
    </div>
  );
}

/** Repeat the selected piece (or group) in a line or an arc. */
export function ArrayTool() {
  const units = useProjectStore((s) => s.units);
  const [o, setO] = useState<ArrayOptions>({ mode: 'line', count: 4, spacing: 1.5, direction: 'x', radius: 4, angle: 90 });
  const set = (k: keyof ArrayOptions) => (v: unknown) => setO({ ...o, [k]: v });
  return (
    <Collapsible id="array" title="Array" defaultOpen={false}>
      <Field
        def={{ key: 'mode', label: 'Arrange in', group: '', type: 'select', default: 'line', options: [{ value: 'line', label: 'A line' }, { value: 'arc', label: 'An arc' }] }}
        value={o.mode}
        units={units}
        onChange={set('mode')}
      />
      <Field def={{ key: 'count', label: 'Total number', group: '', type: 'number', unit: 'none', default: 4, min: 2, max: 50, step: 1 }} value={o.count} units={units} onChange={(v) => set('count')(Math.round(v as number))} />
      {o.mode === 'line' ? (
        <>
          <Field def={{ key: 'spacing', label: 'Spacing (centre to centre)', group: '', type: 'number', default: 1.5, min: -50, max: 50, step: 0.05 }} value={o.spacing} units={units} onChange={set('spacing')} />
          <Field
            def={{ key: 'direction', label: 'Direction', group: '', type: 'select', default: 'x', options: [{ value: 'x', label: 'Across the stage' }, { value: 'z', label: 'Up/downstage' }] }}
            value={o.direction}
            units={units}
            onChange={set('direction')}
          />
        </>
      ) : (
        <>
          <Field def={{ key: 'radius', label: 'Radius', group: '', type: 'number', default: 4, min: 0.5, max: 50, step: 0.05, help: 'Distance to the centre of the arc, in front of the piece.' }} value={o.radius} units={units} onChange={set('radius')} />
          <Field def={{ key: 'angle', label: 'Total angle (°)', group: '', type: 'number', unit: 'none', default: 90, min: 5, max: 360, step: 5 }} value={o.angle} units={units} onChange={set('angle')} />
        </>
      )}
      <button className="btn" onClick={() => makeArray(o)}>
        Create array
      </button>
    </Collapsible>
  );
}
