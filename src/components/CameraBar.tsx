import { useCallback, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useViews } from './useViews';
import { useDismiss } from './useDismiss';
import { Plain } from '../glossary/Plain';
import { plainText } from '../glossary/terms';
import { useSightlines } from '../sightlines/store';
import { useStageSeats } from './sightlines/useStageSeats';
import type { PresetView } from '../types';

/** The view the audience gets: the middle of the house if the stage has one, else the first seat view. */
function audienceView(views: PresetView[]) {
  const presets = views.filter((v) => v.id !== 'top' && v.id !== 'reset' && !v.id.startsWith('saved-'));
  return presets.find((v) => v.id === 'middle') ?? presets.find((v) => !/wing|side|left|right/i.test(v.id)) ?? views.find((v) => v.id === 'reset');
}

/** One View menu at the bottom of the stage: the main views, every other view and saved seat, Seat view and Sightlines. */
export function CameraBar() {
  const views = useViews();
  const s = useProjectStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  const sight = useSightlines();
  const { seats } = useStageSeats();

  const audience = audienceView(views);
  const top = views.find((v) => v.id === 'top');
  const reset = views.find((v) => v.id === 'reset');
  const others = views.filter((v) => v !== audience && v !== top && v !== reset);
  const go = (v?: PresetView) => v && s.requestView(v);

  return (
    <nav className="viewbar glass" aria-label="Camera views" data-tour="views">
      <span className="menu" ref={ref}>
        <button className="viewbar__btn" onClick={() => setOpen(!open)} aria-expanded={open} title="Look at the stage from somewhere else">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          View
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m6 15 6-6 6 6" /></svg>
        </button>
        {open && (
          <span className="menu__list menu__list--views" role="menu">
            <button role="menuitem" onClick={() => (go(audience), close())} title={audience ? `From ${plainText(audience.label).toLowerCase()}` : undefined}>
              From the audience
            </button>
            <button role="menuitem" onClick={() => (go(top), close())}>
              From above
            </button>
            <button role="menuitem" onClick={() => (go(reset), close())}>
              Fit the whole stage
            </button>
            {others.length > 0 && <span className="menu__sep" />}
            {others.map((v) =>
              v.id.startsWith('saved-') ? (
                <span key={v.id} className="menu__item-row">
                  <button role="menuitem" onClick={() => (go(v), close())}>
                    ★ {v.label}
                  </button>
                  <button className="saved-view__x" onClick={() => s.deleteView(v.id)} title="Remove this saved view" aria-label={`Remove ${v.label}`}>
                    ×
                  </button>
                </span>
              ) : (
                <button key={v.id} role="menuitem" onClick={() => (go(v), close())}>
                  <Plain text={v.label} />
                </button>
              ),
            )}
            {seats.length > 0 && (
              <>
                <span className="menu__sep" />
                <button role="menuitem" onClick={() => (sight.set({ seatView: !sight.seatView, current: sight.seatView ? null : sight.current, blocking: null }), close())}>
                  {sight.seatView ? '✓ ' : ''}Sit in any seat
                </button>
                <button role="menuitem" onClick={() => (sight.set({ sightlinesOn: !sight.sightlinesOn, results: null, progress: sight.sightlinesOn ? null : 0 }), close())}>
                  {sight.sightlinesOn ? '✓ ' : ''}Sightlines: how much each seat sees
                </button>
              </>
            )}
          </span>
        )}
      </span>
    </nav>
  );
}
