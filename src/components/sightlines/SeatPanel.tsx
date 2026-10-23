import { useEffect, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useSightlines } from '../../sightlines/store';
import { rowLetter } from '../../helpers/seats';
import { blockingFor, seatViewOf, stepSeat } from './seatActions';
import { useStageSeats } from './useStageSeats';
import { seatToolsInMenu } from '../CameraBar';

const pct = (f: number) => `${Math.round(f * 100)}%`;

/** Viewport toolbar: seat view and sightline check toggles, with a legend and progress. */
export function ViewTools() {
  const { seatView, sightlinesOn, progress, current, set } = useSightlines();
  const { seats } = useStageSeats();
  const mode = useProjectStore((x) => x.mode);
  if (!seats.length || seatToolsInMenu(mode)) return null;
  return (
    <div className="view-tools">
      <button
        className={`btn ${seatView ? 'is-active' : ''}`}
        onClick={() => set({ seatView: !seatView, current: seatView ? null : current, blocking: null })}
        title="Hover the seating and click a seat to see from it"
      >
        Seat view
      </button>
      <button className={`btn ${sightlinesOn ? 'is-active' : ''}`} onClick={() => set({ sightlinesOn: !sightlinesOn, results: null, progress: sightlinesOn ? null : 0 })} title="Shade every seat by how much of the stage it can see">
        Sightlines
      </button>
      {sightlinesOn && (
        <span className="legend">
          {progress !== null ? (
            `Checking ${pct(progress)}…`
          ) : (
            <>
              <i className="legend__bar" /> clear → blocked
            </>
          )}
        </span>
      )}
      {seatView && !current && <span className="hint view-tools__hint">Hover the seats, then click one to sit there.</span>}
    </div>
  );
}

/** Shown while sitting in a seat: where you are, neighbours, save, and what blocks the view. */
export function SeatPanel() {
  const { seatView, current, blocking, set } = useSightlines();
  const objects = useProjectStore((s) => s.objectsByTemplate[s.templateId]) ?? [];
  const [naming, setNaming] = useState<string | null>(null);

  useEffect(() => {
    if (!seatView || !current) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (useProjectStore.getState().selectedIds.length) return; // arrows nudge selected objects instead
      const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      if (moves[e.key]) {
        e.preventDefault();
        stepSeat(...moves[e.key]);
      } else if (e.key === 'Escape') set({ current: null, blocking: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seatView, current, set]);

  if (!seatView || !current) return null;
  const names = (blocking?.ids ?? []).map((id) => objects.find((o) => o.id === id)?.name ?? 'an object');
  const save = (name: string) => {
    const v = seatViewOf(current);
    useProjectStore.getState().saveView({ ...v, id: `saved-${Date.now().toString(36)}`, label: `★ ${name || current.label}` });
    setNaming(null);
  };

  return (
    <div className="seat-panel" role="region" aria-label="Seat view">
      <div className="seat-panel__where">
        <strong>{current.block || 'Seat'}</strong> · Row {rowLetter(current.row)} · Seat {current.num}
      </div>
      <div className="seat-panel__steps" title="Arrow keys also move between seats">
        <button className="btn btn--icon" onClick={() => stepSeat(-1, 0)} aria-label="Previous seat">←</button>
        <button className="btn btn--icon" onClick={() => stepSeat(1, 0)} aria-label="Next seat">→</button>
        <button className="btn btn--icon" onClick={() => stepSeat(0, 1)} aria-label="Row behind">↑</button>
        <button className="btn btn--icon" onClick={() => stepSeat(0, -1)} aria-label="Row in front">↓</button>
      </div>
      {naming !== null ? (
        <form
          className="seat-panel__save"
          onSubmit={(e) => {
            e.preventDefault();
            save(naming.trim());
          }}
        >
          <input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} placeholder={current.label} aria-label="View name" />
          <button className="btn btn--primary" type="submit">Save</button>
        </form>
      ) : (
        <button className="btn" onClick={() => setNaming('')}>Save as view</button>
      )}
      <button className={`btn ${blocking ? 'is-active' : ''}`} onClick={() => set({ blocking: blocking ? null : blockingFor(current) })}>
        What’s blocking this seat?
      </button>
      {blocking && (
        <div className="seat-panel__result">
          {blocking.clear >= 0.999 && !names.length ? (
            'Clear view of the whole acting area.'
          ) : (
            <>
              Sees {pct(blocking.clear)} of the acting area.
              {names.length > 0 && <> Blocked by <strong>{names.join(', ')}</strong> (outlined in red).</>}
              {blocking.stage && <> Part of the view is hidden by the venue itself.</>}
            </>
          )}
        </div>
      )}
      <button className="btn btn--link" onClick={() => set({ current: null, blocking: null })}>Leave seat</button>
    </div>
  );
}
