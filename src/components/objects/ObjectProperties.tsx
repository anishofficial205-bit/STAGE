import { Field } from '../fields';
import { useActiveObjects, useProjectStore } from '../../store/useProjectStore';
import { getObjectType } from '../../objects/registry';
import { effectiveElevation } from '../../objects/geometry';
import { setElevation, setParams, setProps, setRotation } from '../../objects/actions';
import type { NumberParam, ParamDef, ParamValue } from '../../types';
import { useOffStageIds } from './LayersPanel';

const pos = (key: string, label: string, help?: string): NumberParam => ({ key, label, group: 'Position', type: 'number', default: 0, min: -200, max: 200, step: 0.05, help });

/** Properties of the selected set object(s): name, position, rotation and the object's own params. */
export function ObjectProperties() {
  const objects = useActiveObjects();
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const units = useProjectStore((s) => s.units);
  const { removeObjects, duplicateObjects, select } = useProjectStore.getState();
  const offStage = useOffStageIds();
  const selected = objects.filter((o) => selectedIds.includes(o.id));

  if (selected.length > 1) {
    return (
      <div className="obj-props">
        <div className="panel-head">
          <h2 className="panel-title">{selected.length} objects</h2>
          <button className="btn btn--link" onClick={() => select([])}>
            Deselect
          </button>
        </div>
        <p className="hint">Drag any of them to move them together. Shift-click to add or remove from the selection.</p>
        <div className="btn-row">
          <button className="btn" onClick={() => duplicateObjects(selectedIds)}>
            Duplicate
          </button>
          <button className="btn btn--danger" onClick={() => removeObjects(selectedIds)}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  const o = selected[0];
  const type = o && getObjectType(o.type);
  if (!o || !type) return null;

  const groups: { name: string; defs: ParamDef[] }[] = [];
  for (const def of type.params) {
    if (def.key === type.elevationParam) continue; // shown as "Height above floor"
    if (def.visible && !def.visible(o.params)) continue;
    let g = groups.find((x) => x.name === def.group);
    if (!g) groups.push((g = { name: def.group, defs: [] }));
    g.defs.push(def);
  }

  return (
    <div className="obj-props">
      <div className="panel-head">
        <input className="obj-props__name" value={o.name} onChange={(e) => setProps(o.id, { name: e.target.value }, `name:${o.id}`)} aria-label="Object name" />
        <button className="btn btn--link" onClick={() => select([])} title="Deselect (Esc)">
          Done
        </button>
      </div>
      <p className="hint obj-props__type">{type.name}{o.locked ? ' · locked' : ''}</p>
      {offStage.has(o.id) && <p className="panel-msg panel-msg--warning">This object is partly off the stage.</p>}

      <section className="group">
        <h3 className="group__title">Position</h3>
        <div className="field-pair">
          <Field def={pos('x', 'X', 'Left/right from the stage centre.')} value={o.x} units={units} onChange={(v) => setProps(o.id, { x: v as number }, `x:${o.id}`)} />
          <Field def={pos('z', 'Z', 'Upstage (−) / downstage (+) from the stage centre.')} value={o.z} units={units} onChange={(v) => setProps(o.id, { z: v as number }, `z:${o.id}`)} />
        </div>
        <Field
          def={{ ...pos('elevation', type.placement === 'hanging' ? 'Height above floor (bottom)' : 'Height above floor'), min: 0, max: 50 }}
          value={effectiveElevation(o, type)}
          units={units}
          onChange={(v) => setElevation(o.id, v as number)}
        />
        <Field
          def={{ key: 'rotation', label: 'Rotation (°)', group: '', type: 'number', unit: 'none', default: 0, min: -180, max: 180, step: 15 }}
          value={o.rotation}
          units={units}
          onChange={(v) => setRotation(o.id, v as number)}
        />
      </section>

      {groups.map((g) => (
        <section key={g.name} className="group">
          <h3 className="group__title">{g.name}</h3>
          {g.defs.map((def) => (
            <Field key={def.key} def={def} value={o.params[def.key]} units={units} onChange={(v) => setParams(o.id, { [def.key]: v as ParamValue }, `param:${o.id}:${def.key}`)} />
          ))}
        </section>
      ))}

      <div className="btn-row">
        <button className="btn" onClick={() => duplicateObjects([o.id])} title="Duplicate (⌘D)">
          Duplicate
        </button>
        <button className="btn" onClick={() => setProps(o.id, { locked: !o.locked })}>
          {o.locked ? 'Unlock' : 'Lock'}
        </button>
        <button className="btn btn--danger" onClick={() => removeObjects([o.id])} title="Delete">
          Delete
        </button>
      </div>
    </div>
  );
}
