import { useCallback, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useViews } from './useViews';
import { useDismiss } from './useDismiss';
import { Plain } from '../glossary/Plain';
import { plainText } from '../glossary/terms';
import { useSightlines } from '../sightlines/store';
import { useStageSeats } from './sightlines/useStageSeats';
import type { PresetView } from '../types';

/** Seat view and sightlines matter most while building the set and blocking; elsewhere they live in More views. */
export const seatToolsInMenu = (mode: string) => mode === 'lights' || mode === 'venue';

/** The view the audience gets: the middle of the house if the stage has one, else the first seat view. */
function audienceView(views: PresetView[]) {
  const presets = views.filter((v) => v.id !== 'top' && v.id !== 'reset' && !v.id.startsWith('saved-'));
  return presets.find((v) => v.id === 'middle') ?? presets.find((v) => !/wing|side|left|right/i.test(v.id)) ?? views.find((v) => v.id === 'reset');
}

/** Audience view, Top view and Reset, with every other view (and saved seats) under More views. */
export function CameraBar() {
  const views = useViews();
  const s = useProjectStore();
  const mode = useProjectStore((x) => x.mode);
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
    <nav className="topbar__views glass" aria-label="Camera views" data-tour="views">
      <button className="pill" onClick={() => go(audience)} title={audience ? `From ${plainText(audience.label).toLowerCase()}` : undefined}>
        Audience view
      </button>
      <button className="pill" onClick={() => go(top)}>
        Top view
      </button>
      <button className="pill pill--muted" onClick={() => go(reset)} title="Show the whole stage">
        Reset
      </button>
      <span className="menu" ref={ref}>
        <button className="pill pill--more" onClick={() => setOpen(!open)} aria-expanded={open}>
          More views ▾
        </button>
        {open && (
          <span className="menu__list menu__list--views" role="menu">
            {/* Narrow screens: the three main buttons move in here. */}
            <button role="menuitem" className="menu__narrow" onClick={() => (go(audience), close())}>
              Audience view
            </button>
            <button role="menuitem" className="menu__narrow" onClick={() => (go(top), close())}>
              Top view
            </button>
            <button role="menuitem" className="menu__narrow" onClick={() => (go(reset), close())}>
              Reset
            </button>
            <span className="menu__sep menu__narrow" />
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
            {audience && audience.id !== 'reset' && (
              <button role="menuitem" onClick={() => (go(audience), close())}>
                <Plain text={audience.label} />
              </button>
            )}
            {seatToolsInMenu(mode) && seats.length > 0 && (
              <>
                <span className="menu__sep" />
                <button role="menuitem" onClick={() => (sight.set({ seatView: !sight.seatView, current: sight.seatView ? null : sight.current, blocking: null }), close())}>
                  {sight.seatView ? '✓ ' : ''}Seat view: see from any seat
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
