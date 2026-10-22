import { Field } from '../fields';
import { Collapsible } from '../Collapsible';
import { useProjectStore } from '../../store/useProjectStore';
import { formatLength } from '../../units';
import type { ParamDef } from '../../types';
import { wallLength } from '../../venue/geometry';
import { WALL_MATERIALS } from '../../venue/types';
import { venueActions } from '../../venue/actions';
import { useVenueUI, type VenueTool } from '../../venue/ui';

const TOOLS: { id: VenueTool; label: string; key: string; hint: string }[] = [
  { id: 'select', label: 'Select', key: 'V', hint: 'Click a wall (here or in 3D) to select it. Drag it to move it, drag its round ends to reshape. Drag the background to pan, scroll to zoom.' },
  { id: 'wall', label: 'Wall', key: 'W', hint: 'Click to start, click to add corners, double-click (or Enter) to finish; click the first corner to close a room. Snaps to the grid, 90°/45° angles, wall ends and the stage — hold Shift for any angle, ⌘/Ctrl to place freely.' },
];

/** Left side in Venue mode: the drawing tools. */
export function VenueTools() {
  const tool = useVenueUI((s) => s.tool);
  const draft = useVenueUI((s) => s.draft.length);
  const walls = useProjectStore((s) => s.venue.walls.length);
  const hint = TOOLS.find((t) => t.id === tool)?.hint;
  return (
    <Collapsible id="venue-tools" title="Plan tools">
      <div className="tool-list" role="toolbar" aria-label="Plan tools">
        {TOOLS.map((t) => (
          <button key={t.id} className={`tool-btn ${tool === t.id ? 'is-active' : ''}`} onClick={() => useVenueUI.getState().setTool(t.id)} aria-pressed={tool === t.id} title={`${t.label} (${t.key})`}>
            <span>{t.label}</span>
            <kbd>{t.key}</kbd>
          </button>
        ))}
      </div>
      <p className="hint">{hint}</p>
      {tool === 'wall' && draft > 0 && <p className="panel-msg panel-msg--info">{draft} corner{draft === 1 ? '' : 's'} placed. Esc cancels, Backspace removes the last one.</p>}
      <p className="hint">
        {walls} wall{walls === 1 ? '' : 's'}
      </p>
    </Collapsible>
  );
}

const WALL_FIELDS: ParamDef[] = [
  { key: 'length', label: 'Length', group: '', type: 'number', default: 1, min: 0.1, max: 200, step: 0.05 },
  { key: 'thickness', label: 'Thickness', group: '', type: 'number', default: 0.2, min: 0.05, max: 2, step: 0.01 },
  { key: 'height', label: 'Height', group: '', type: 'number', default: 4, min: 0.5, max: 30, step: 0.1 },
  { key: 'material', label: 'Material', group: '', type: 'select', default: 'plaster', options: Object.entries(WALL_MATERIALS).map(([value, m]) => ({ value, label: m.label })) },
];

/** Right side in Venue mode: the selected wall, or an overview. */
export function VenueProperties() {
  const units = useProjectStore((s) => s.units);
  const walls = useProjectStore((s) => s.venue.walls);
  const selected = useVenueUI((s) => s.selected);
  const cutaway = useVenueUI((s) => s.cutaway);
  const wall = selected?.kind === 'wall' ? walls.find((w) => w.id === selected.id) : undefined;
  if (wall)
    return (
      <div className="props">
        <div className="panel-head">
          <h2 className="panel-title">Wall</h2>
          <button className="btn btn--link" onClick={() => useVenueUI.getState().select(null)} title="Deselect (Esc)">
            Done
          </button>
        </div>
        {WALL_FIELDS.map((def) => (
          <Field
            key={def.key}
            def={def}
            value={def.key === 'length' ? wallLength(wall) : (wall as unknown as Record<string, number | string>)[def.key]}
            units={units}
            onChange={(v) => (def.key === 'length' ? venueActions.setLength(wall.id, v as number) : venueActions.patchWall(wall.id, { [def.key]: v }))}
          />
        ))}
        <div className="btn-row">
          <button className="btn btn--danger" onClick={() => venueActions.removeWall(wall.id)} title="Delete (Delete key)">
            Delete wall
          </button>
        </div>
      </div>
    );
  const total = walls.reduce((t, w) => t + wallLength(w), 0);
  return (
    <div className="props">
      <div className="panel-head">
        <h2 className="panel-title">Venue</h2>
      </div>
      <p className="sidebar__empty">Draw the building around the stage on the plan: walls first, then rooms and doors. The stage and seating show in grey.</p>
      <p className="hint">
        {walls.length} wall{walls.length === 1 ? '' : 's'}
        {walls.length ? ` · ${formatLength(total, units)} in total` : ''}
      </p>
      <label className="field field--inline">
        <span className="field__label">Cut-away 3D view</span>
        <button type="button" role="switch" aria-checked={cutaway} className={`switch ${cutaway ? 'is-on' : ''}`} onClick={() => useVenueUI.getState().toggleCutaway()}>
          <span className="switch__knob" />
        </button>
      </label>
    </div>
  );
}

/** Split / plan / 3D toggle and the cut-away button, over the venue views. */
export function VenueViewBar() {
  const layout = useVenueUI((s) => s.layout);
  const cutaway = useVenueUI((s) => s.cutaway);
  return (
    <div className="venue-bar">
      <div className="segmented" role="group" aria-label="Venue layout">
        {(['split', 'plan', '3d'] as const).map((l) => (
          <button key={l} className={layout === l ? 'is-active' : ''} onClick={() => useVenueUI.getState().setLayout(l)}>
            {l === 'split' ? 'Split' : l === 'plan' ? 'Plan' : '3D'}
          </button>
        ))}
      </div>
      {layout !== 'plan' && (
        <button className={`btn ${cutaway ? 'is-active' : ''}`} onClick={() => useVenueUI.getState().toggleCutaway()} title="Lower every wall to 1 m in 3D to look into the rooms">
          Cut-away
        </button>
      )}
    </div>
  );
}
