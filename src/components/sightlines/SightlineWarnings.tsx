import { useProjectStore } from '../../store/useProjectStore';
import { useSightlines } from '../../sightlines/store';
import { formatLength } from '../../units';
import { Field } from '../fields';
import { useTallWarnings } from './useTallWarnings';

/** Thrust / traverse / in-the-round: tall pieces that block a section's view. */
export function SightlineWarnings() {
  const templateId = useProjectStore((s) => s.templateId);
  const units = useProjectStore((s) => s.units);
  const threshold = useSightlines((s) => s.tallThreshold);
  const warnings = useTallWarnings();
  if (!['in-the-round', 'thrust', 'traverse'].includes(templateId)) return null;
  return (
    <div className="sight-warn">
      {warnings.map((w) => (
        <p key={w.objectId} className="panel-msg panel-msg--warning">
          <button className="btn btn--link" onClick={() => useProjectStore.getState().select([w.objectId])}>
            {w.name}
          </button>{' '}
          ({formatLength(w.height, units)} tall) blocks views from {w.blocks.join(', ')}.
        </p>
      ))}
      <Field
        def={{ key: 'tall', label: 'Warn about pieces taller than', group: '', type: 'number', default: 1.5, min: 0.3, max: 10, step: 0.1, help: 'With the audience round the stage, tall pieces block somebody’s view.' }}
        value={threshold}
        units={units}
        onChange={(v) => useSightlines.getState().set({ tallThreshold: v as number })}
      />
    </div>
  );
}
