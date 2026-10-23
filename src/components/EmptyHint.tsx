import { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useSightlines } from '../sightlines/store';
import { STARTER_SETS } from '../starters';

/** Friendly hint on an empty stage, pointing at the object library (and starter sets). */
export function EmptyHint() {
  const empty = useProjectStore((s) => (s.objectsByTemplate[s.templateId] ?? []).length === 0);
  const templateId = useProjectStore((s) => s.templateId);
  const seatView = useSightlines((s) => s.seatView);
  const mode = useProjectStore((s) => s.mode);
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!empty || seatView || dismissed === templateId || mode !== 'set') return null;
  const first = STARTER_SETS[templateId]?.[0];
  return (
      <div className="empty-hint" role="note">
        <div>
          <strong>Your stage is empty.</strong> When the size is right, switch to{' '}
          <button className="btn btn--link" onClick={() => useProjectStore.getState().setMode('set')}>
            Set mode
          </button>{' '}
          (key 2) to add scenery and props.
        </div>
        <button className="empty-hint__close" onClick={() => setDismissed(templateId)} aria-label="Dismiss">
          ×
        </button>
      </div>
    );
  return (
    <div className="empty-hint" role="note">
      <span className="empty-hint__arrow" aria-hidden>←</span>
      <div>
        <strong>Your stage is empty.</strong> Drag a piece from <em>Add objects</em> on the left into the view, or click a tile to place it at stage centre.
        {first && (
          <>
            {' '}
            Or start from an example:{' '}
            <button className="btn btn--link" onClick={() => useProjectStore.getState().loadStarterSet(first)}>
              load “{first.name}”
            </button>
            .
          </>
        )}
      </div>
      <button className="empty-hint__close" onClick={() => setDismissed(templateId)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
