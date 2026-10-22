import { Field } from '../../components/fields';
import { useActiveData, useProjectStore } from '../../store/useProjectStore';
import type { ParamDef } from '../../types';
import { PLATFORM_HEIGHTS, useBlackBoxUI, type BlackBoxData, type Block } from './blocks';
import { blockActions } from './actions';

/** Params of a selected block, in the same schema format as template params. */
const PLATFORM_FIELDS: ParamDef[] = [
  { key: 'width', label: 'Width', group: '', type: 'number', default: 1.2, min: 0.6, max: 6, step: 0.1 },
  { key: 'depth', label: 'Depth', group: '', type: 'number', default: 2.4, min: 0.6, max: 6, step: 0.1 },
  { key: 'height', label: 'Height', group: '', type: 'select', default: '0.4', options: PLATFORM_HEIGHTS.map((h) => ({ value: String(h), label: `${h} m` })) },
];
const SEATING_FIELDS: ParamDef[] = [
  { key: 'rows', label: 'Rows', group: '', type: 'number', unit: 'none', default: 4, min: 1, max: 15, step: 1 },
  { key: 'seatsPerRow', label: 'Seats per row', group: '', type: 'number', unit: 'none', default: 8, min: 2, max: 30, step: 1 },
  { key: 'rake', label: 'Rake (rise per row)', group: '', type: 'number', default: 0.25, min: 0, max: 0.5, step: 0.01 },
];

/** Block toolbox shown at the top of the Black Box properties panel. */
export function BlackBoxPanel() {
  const data = useActiveData() as BlackBoxData;
  const units = useProjectStore((s) => s.units);
  const selectedId = useBlackBoxUI((s) => s.selectedId);
  const blocks = data?.blocks ?? [];
  const selected = blocks.find((b) => b.id === selectedId);
  const platforms = blocks.filter((b) => b.kind === 'platform').length;

  return (
    <section className="group">
      <h3 className="group__title">Blocks</h3>
      <div className="btn-row">
        <button className="btn" onClick={() => blockActions.add('platform')}>
          + Add platform
        </button>
        <button className="btn" onClick={() => blockActions.add('seating')}>
          + Add seating block
        </button>
      </div>
      <p className="hint">
        {platforms} platform{platforms === 1 ? '' : 's'} · {blocks.length - platforms} seating block{blocks.length - platforms === 1 ? '' : 's'}
      </p>

      {selected ? (
        <SelectedBlock block={selected} index={blocks.filter((b) => b.kind === selected.kind).indexOf(selected) + 1} units={units} />
      ) : (
        <p className="hint">
          Click a block to select it, then drag it across the floor. Blocks snap to a {units === 'ft' ? '2 ft' : '0.5 m'} grid and to each other’s edges.
          Keys: R rotates 15° (Shift+R 90°), ⌘D duplicates, Delete removes.
        </p>
      )}
      <button className="btn btn--link" onClick={blockActions.resetLayout} title="Re-place all blocks using the starting layout below">
        Reset to starting layout
      </button>
    </section>
  );
}

export function SelectedBlock({ block, index, units }: { block: Block; index: number; units: 'm' | 'ft' }) {
  const fields = block.kind === 'platform' ? PLATFORM_FIELDS : SEATING_FIELDS;
  const value = (key: string) => {
    const v = (block as unknown as Record<string, number>)[key];
    return key === 'height' ? String(v) : v;
  };
  return (
    <div className="block-editor">
      <div className="block-editor__head">
        <strong>{block.kind === 'platform' ? `Platform ${index}` : `Seating block ${index}`}</strong>
        <button className="btn btn--ghost" onClick={() => useBlackBoxUI.getState().select(null)} title="Deselect (Esc)">
          Done
        </button>
      </div>
      {fields.map((def) => (
        <Field
          key={def.key}
          def={def}
          value={value(def.key)}
          units={units}
          onChange={(v) => blockActions.patch(block.id, { [def.key]: def.key === 'height' ? Number(v) : v })}
        />
      ))}
      <div className="field">
        <span className="field__label">Rotation: {Math.round(block.rotation)}°</span>
        <div className="btn-row">
          <button className="btn" onClick={() => blockActions.rotate(block.id, -15)} title="Rotate 15° anticlockwise">
            ⟲ 15°
          </button>
          <button className="btn" onClick={() => blockActions.rotate(block.id, 15)} title="Rotate 15° clockwise (R)">
            ⟳ 15°
          </button>
          <button className="btn" onClick={() => blockActions.rotate(block.id, 90)} title="Rotate 90° (Shift+R)">
            90°
          </button>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={() => blockActions.duplicate(block.id)}>
          Duplicate
        </button>
        <button className="btn btn--danger" onClick={() => blockActions.remove(block.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}
