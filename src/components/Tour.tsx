import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';

/**
 * First-run tour: three tooltips pointing at the stage picker, the properties
 * panel and the view buttons. Dismissible; replay it from the "?" button.
 */
export const TOUR_EVENT = 'stage-builder:tour';
const DONE_KEY = 'stage-builder:tour-done';

const STEPS = [
  {
    target: 'modes',
    side: 'bottom',
    title: 'Work in modes',
    text: 'Stage sets the size and shape, Set builds the scenery. Press 1–5 to switch. Things from other modes stay in view but can’t be picked.',
  },
  {
    target: 'picker',
    side: 'right',
    title: 'Pick a stage',
    text: 'Choose the kind of stage closest to your venue. You can switch at any time.',
  },
  {
    target: 'panel',
    side: 'left',
    title: 'Adjust the dimensions',
    text: 'Type your venue’s real measurements or drag the sliders — the model updates live. Size presets give you a quick starting point.',
  },
  {
    target: 'views',
    side: 'bottom',
    title: 'Check the views',
    text: 'Jump to seats around the venue to see what the audience sees. Drag in the 3D view to look around, scroll to zoom.',
  },
] as const;

const TIP_W = 280;

export function Tour() {
  const [step, setStep] = useState<number | null>(() => {
    try {
      return localStorage.getItem(DONE_KEY) ? null : 0;
    } catch {
      return null;
    }
  });
  const [rect, setRect] = useState<DOMRect | null>(null);

  const close = useCallback(() => {
    setStep(null);
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const replay = () => {
      useProjectStore.getState().setMode('stage');
      setStep(0);
    };
    window.addEventListener(TOUR_EVENT, replay);
    return () => window.removeEventListener(TOUR_EVENT, replay);
  }, []);

  useLayoutEffect(() => {
    if (step === null) return;
    const measure = () => setRect(document.querySelector(`[data-tour="${STEPS[step].target}"]`)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener('resize', measure);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('keydown', onKey);
    };
  }, [step, close]);

  if (step === null || !rect) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const pos =
    s.side === 'right'
      ? { left: rect.right + 14, top: rect.top + 60 }
      : s.side === 'left'
        ? { left: rect.left - TIP_W - 14, top: rect.top + 60 }
        : { left: Math.max(12, rect.left + rect.width / 2 - TIP_W / 2), top: rect.bottom + 14 };

  return (
    <div className="tour" aria-live="polite">
      <div className="tour__ring" style={{ left: rect.left + 3, top: rect.top + 3, width: rect.width - 6, height: rect.height - 6 }} />
      <div className={`tour__tip tour__tip--${s.side}`} style={{ ...pos, width: TIP_W }} role="dialog" aria-label={s.title}>
        <div className="tour__step">
          Step {step + 1} of {STEPS.length}
        </div>
        <div className="tour__title">{s.title}</div>
        <p className="tour__text">{s.text}</p>
        <div className="tour__actions">
          <button className="btn btn--ghost" onClick={close}>
            Skip
          </button>
          <button className="btn btn--primary" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
