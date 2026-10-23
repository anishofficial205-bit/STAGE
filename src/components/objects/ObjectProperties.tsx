import { Field } from '../fields';
import { useActiveObjects, useProjectStore } from '../../store/useProjectStore';
import { getObjectType } from '../../objects/registry';
import { placementOf } from '../../objects/types';
import { effectiveElevation } from '../../objects/geometry';
import { setElevation, setParams, setProps, setRotation } from '../../objects/actions';
import type { NumberParam, ParamDef, ParamValue } from '../../types';
import { useOffStageIds } from '../../objects/offStage';
import { ArrayTool, MultiProperties } from './ArrangeTools';
import { FacesSection } from './FacesSection';
import { Plain } from '../../glossary/Plain';
import { MoreOptions } from '../MoreOptions';
import { Collapsible } from '../Collapsible';
import { useRef } from 'react';
import { ALL_FACES } from '../../objects/faceMaterial';
import { ACCEPT, importOnto } from '../../graphics/library';
import type { SetObject } from '../../objects/types';
import { removePick } from '../layers/ops';

const QUICK_COLOURS: [string, string][] = [
  ['White', '#f2efe9'],
  ['Bone', '#e8e1d2'],
  ['Grey', '#8d8f93'],
  ['Black', '#1c1c1e'],
  ['Oak', '#b08a5a'],
  ['Sage', '#8a9a7b'],
  ['Navy', '#2b3a5c'],
  ['Red', '#7e1c22'],
];

/** One colour for the whole piece, or a picture on it. Per-face materials are under More options. */
function QuickLook({ o }: { o: SetObject }) {
  const setFaceStyle = useProjectStore((s) => s.setFaceStyle);
  const file = useRef<HTMLInputElement>(null);
  const current = (o.faces?.[ALL_FACES]?.color ?? '').toLowerCase();
  return (
    <section className="group">
      <h3 className="group__title">Colour</h3>
      <div className="color-field">
        {QUICK_COLOURS.map(([name, hex]) => (
          <button
            key={hex}
            type="button"
            className={`swatch ${current === hex ? 'is-active' : ''}`}
            style={{ background: hex }}
            title={name}
            aria-label={name}
            onClick={() => setFaceStyle(o.id, ALL_FACES, { material: 'paint', color: hex, roughness: 0.8 }, `quick-colour:${o.id}`)}
          />
        ))}
        <button className="btn btn--small" onClick={() => file.current?.click()} title="Put a picture (JPG, PNG, SVG or PDF) on this piece">
          + Picture…
        </button>
        <input
          ref={file}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importOnto({ objectId: o.id, face: ALL_FACES }, [f]);
            e.target.value = '';
          }}
        />
      </div>
    </section>
  );
}

const pos = (key: string, label: string, help?: string): NumberParam => ({ key, label, group: 'Position', type: 'number', default: 0, min: -200, max: 200, step: 0.05, help });

/** Properties of the selected set object(s): name, position, rotation and the object's own params. */
export function ObjectProperties() {
  const objects = useActiveObjects();
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const units = useProjectStore((s) => s.units);
  const { duplicateObjects, select } = useProjectStore.getState();
  const offStage = useOffStageIds();
  const selected = objects.filter((o) => selectedIds.includes(o.id));

  if (selected.length > 1) return <MultiProperties />;

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
  // Size first; everything else is under More options.
  const size = groups.find((g) => g.name === 'Size');
  const others = groups.filter((g) => g !== size);

  return (
    <div className="obj-props">
      <div className="panel-head">
        <input className="obj-props__name" value={o.name} onChange={(e) => setProps(o.id, { name: e.target.value }, `name:${o.id}`)} aria-label="Object name" />
        <button className="btn btn--link" onClick={() => select([])} title="Deselect (Esc)">
          Done
        </button>
      </div>
      <p className="hint obj-props__type">
        <Plain text={type.name} />
        {o.locked ? ' · locked' : ''}
      </p>
      {offStage.has(o.id) && <p className="panel-msg panel-msg--warning">This object is partly off the stage.</p>}

      {size && (
        <section className="group">
          <h3 className="group__title">Size</h3>
          {size.defs.map((def) => (
            <Field key={def.key} def={def} value={o.params[def.key]} units={units} onChange={(v) => setParams(o.id, { [def.key]: v as ParamValue }, `param:${o.id}:${def.key}`)} />
          ))}
        </section>
      )}
      <QuickLook o={o} />
      <Collapsible id="exact-position" title="Exact position" defaultOpen={false}>
        <p className="hint">The easiest way to move a piece is to drag it on the stage.</p>
        <div className="field-pair">
          <Field def={pos('x', 'Left ↔ Right', 'From the stage centre: negative is to the left, positive to the right (as the audience sees it).')} value={o.x} units={units} onChange={(v) => setProps(o.id, { x: v as number }, `x:${o.id}`)} />
          <Field def={pos('z', 'Front ↔ Back', 'From the stage centre: positive is toward the audience (front), negative toward the back.')} value={o.z} units={units} onChange={(v) => setProps(o.id, { z: v as number }, `z:${o.id}`)} />
        </div>
        <Field
          def={{ ...pos('elevation', placementOf(type, o.params) === 'hanging' ? 'Raise / lower (bottom edge)' : 'Raise / lower'), min: 0, max: 50 }}
          value={effectiveElevation(o, type)}
          units={units}
          onChange={(v) => setElevation(o.id, v as number)}
        />
        <Field
          def={{ key: 'rotation', label: 'Turn (°)', group: '', type: 'number', unit: 'none', default: 0, min: -180, max: 180, step: 15 }}
          value={o.rotation}
          units={units}
          onChange={(v) => setRotation(o.id, v as number)}
        />
      </Collapsible>

      <MoreOptions id="set-object">

        {others.map((g) => (
          <section key={g.name} className="group">
            <h3 className="group__title">{g.name}</h3>
            {g.defs.map((def) => (
              <Field key={def.key} def={def} value={o.params[def.key]} units={units} onChange={(v) => setParams(o.id, { [def.key]: v as ParamValue }, `param:${o.id}:${def.key}`)} />
            ))}
          </section>
        ))}

        {type.Panel && <type.Panel o={o} />}
        <FacesSection o={o} />
        <ArrayTool />
      </MoreOptions>

      <div className="btn-row">
        <button className="btn" onClick={() => duplicateObjects([o.id])} title="Duplicate (⌘D)">
          Duplicate
        </button>
        <button className="btn" onClick={() => setProps(o.id, { locked: !o.locked })}>
          {o.locked ? 'Unlock' : 'Lock'}
        </button>
        <button className="btn btn--danger" onClick={() => removePick({ domain: 'set', kind: 'object', ids: [o.id] })} title="Delete">
          Delete
        </button>
      </div>
    </div>
  );
}
