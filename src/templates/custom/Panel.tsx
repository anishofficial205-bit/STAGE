import { useState } from 'react';
import { Field } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { useActiveData, useProjectStore } from '../../store/useProjectStore';
import { formatLength } from '../../units';
import type { ParamDef } from '../../types';
import { useBlackBoxUI } from '../blackBox/blocks';
import { blockActions } from '../blackBox/actions';
import { SelectedBlock } from '../blackBox/Panel';
import { MATERIAL_COLORS, outline, bbox, type CustomData, type DrawnShape } from './shapes';
import { customActions } from './actions';
import { useCustomUI } from './ui';
import { saveMyTemplate } from './myTemplates';

const SHAPE_FIELDS: ParamDef[] = [
  { key: 'height', label: 'Height', group: '', type: 'number', default: 0.6, min: 0, max: 3, step: 0.05 },
  { key: 'edge', label: 'Edge', group: '', type: 'select', default: 'straight', options: [
    { value: 'straight', label: 'Straight' },
    { value: 'stepped', label: 'Stepped (a step all round)' },
  ] },
  { key: 'material', label: 'Material', group: '', type: 'select', default: 'black', options: Object.entries(MATERIAL_COLORS).map(([value, m]) => ({ value, label: m.label })) },
  { key: 'radius', label: 'Round all corners', group: '', type: 'number', default: 0, min: 0, max: 5, step: 0.05 },
];
const CORNER: ParamDef = { key: 'r', label: 'This corner’s radius', group: '', type: 'number', default: 0, min: 0, max: 5, step: 0.05 };

function ShapeEditor({ shape }: { shape: DrawnShape }) {
  const units = useProjectStore((s) => s.units);
  const point = useCustomUI((s) => s.selectedPoint);
  const b = bbox(outline(shape));
  const corner = point !== null ? shape.points[point] : undefined;
  return (
    <div className="block-editor">
      <div className="block-editor__head">
        <input className="obj-props__name" value={shape.name} onChange={(e) => customActions.patch(shape.id, { name: e.target.value })} aria-label="Shape name" />
        <button className="btn btn--ghost" onClick={() => useCustomUI.getState().selectShape(null)} title="Deselect (Esc)">
          Done
        </button>
      </div>
      <p className="hint">
        {formatLength(b.x1 - b.x0, units)} × {formatLength(b.z1 - b.z0, units)} · {shape.points.length} corners
      </p>
      {SHAPE_FIELDS.map((def) => (
        <Field key={def.key} def={def} value={(shape as unknown as Record<string, number | string>)[def.key]} units={units} onChange={(v) => customActions.patch(shape.id, { [def.key]: v })} />
      ))}
      {corner && point !== null && (
        <div className="block-editor__corner">
          <Field def={CORNER} value={corner.r ?? shape.radius} units={units} onChange={(v) => customActions.setPointRadius(shape.id, point, v as number)} />
          <div className="btn-row">
            {corner.r !== undefined && (
              <button className="btn btn--link" onClick={() => customActions.setPointRadius(shape.id, point, undefined)}>
                Use the shape’s radius
              </button>
            )}
            <button className="btn" onClick={() => customActions.removePoint(shape.id, point)} disabled={shape.points.length <= 3}>
              Delete corner
            </button>
          </div>
        </div>
      )}
      <p className="hint">Drag a corner to move it (snaps to the grid; ⌘/Ctrl for free). Drag the blue diamond on an edge to curve it, or click it to add a corner. Double-click a corner to delete it.</p>
      <div className="btn-row">
        <button className="btn" onClick={() => customActions.duplicate(shape.id)}>
          Duplicate
        </button>
        <button className="btn btn--danger" onClick={() => customActions.remove(shape.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}

function SaveDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState(useProjectStore.getState().projectName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    try {
      const t = await saveMyTemplate(name);
      useProjectStore.setState({ lastAction: { label: `Saved “${t.name}” to My templates`, nonce: Date.now() } });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  };
  return (
    <Modal title="Save as my template" onClose={onClose}>
      <p className="modal__text">Saves the stage shapes, seating and room so you can start other projects from them. It appears under My templates in the Stage panel.</p>
      <label className="field">
        <span className="field__label">Name</span>
        <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} autoFocus />
      </label>
      {error && <p className="panel-msg panel-msg--warning">{error}</p>}
      <div className="modal__actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn--primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

/** Tools for Build Your Own: draw, seat along an edge, edit the picked shape or block, save as a template. */
export function CustomPanel() {
  const data = useActiveData() as CustomData;
  const units = useProjectStore((s) => s.units);
  const tool = useCustomUI((s) => s.tool);
  const draft = useCustomUI((s) => s.draft.length);
  const selectedShape = useCustomUI((s) => s.selectedShape);
  const selectedBlock = useBlackBoxUI((s) => s.selectedId);
  const [saving, setSaving] = useState(false);
  const shapes = data?.shapes ?? [];
  const blocks = data?.blocks ?? [];
  const shape = shapes.find((s) => s.id === selectedShape);
  const block = blocks.find((b) => b.id === selectedBlock);
  const toggle = (t: 'draw' | 'seat-edge') => useCustomUI.getState().setTool(tool === t ? null : t);

  return (
    <section className="group">
      <h3 className="group__title">Stage shapes</h3>
      <div className="btn-row">
        <button className={`btn ${tool === 'draw' ? 'is-active' : ''}`} onClick={() => toggle('draw')} aria-pressed={tool === 'draw'}>
          ✎ Draw stage
        </button>
        <button className={`btn ${tool === 'seat-edge' ? 'is-active' : ''}`} onClick={() => toggle('seat-edge')} disabled={!shapes.length} aria-pressed={tool === 'seat-edge'}>
          Seating along an edge
        </button>
        <button className="btn" onClick={() => blockActions.add('seating')}>
          + Seating block
        </button>
      </div>
      {tool === 'draw' && (
        <p className="panel-msg panel-msg--info">
          Click on the floor to add corners ({draft} so far). Double-click, press Enter or click the first corner to finish. Hold Shift for 15° angles, ⌘/Ctrl to place off the grid. Backspace removes the last corner, Esc cancels.
        </p>
      )}
      {tool === 'seat-edge' && <p className="panel-msg panel-msg--info">Click an edge of a stage shape: seating rows appear facing it.</p>}
      {!tool && !shapes.length && <p className="hint">Start with “Draw stage” and click out any shape on the floor — an L, a hexagon, a runway…</p>}

      {shape ? (
        <ShapeEditor shape={shape} />
      ) : block ? (
        <SelectedBlock block={block} index={blocks.filter((b) => b.kind === block.kind).indexOf(block) + 1} units={units} />
      ) : (
        shapes.length > 0 && (
          <ul className="shape-list">
            {shapes.map((s) => (
              <li key={s.id}>
                <button className="btn btn--ghost" onClick={() => useCustomUI.getState().selectShape(s.id)}>
                  {s.name} <span className="hint">· {formatLength(s.height, units)} high</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      <button className="btn" onClick={() => setSaving(true)} disabled={!shapes.length && !blocks.length} title="Keep this stage to reuse in other projects">
        Save as my template…
      </button>
      {saving && <SaveDialog onClose={() => setSaving(false)} />}
    </section>
  );
}
