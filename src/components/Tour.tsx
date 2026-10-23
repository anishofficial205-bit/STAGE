import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import type { Mode } from '../modes';

/**
 * Tooltip tours, only when asked for from Help: "Take a tour" (the mode bar,
 * stage picker, panel and views) and "Tour of this mode" for Venue, Lights and
 * Blocking. Nothing opens by itself — first-time help comes from one-off tips
 * (see Tips). When a tour ends you're back in the mode you started from.
 */
export const TOUR_EVENT = 'stage-builder:tour';
/** Tour of the current mode (Venue, Lights or Blocking). */
export const MODE_TOUR_EVENT = 'stage-builder:mode-tour';
const DONE_KEY = 'stage-builder:tour-done';
const modeKey = (m: Mode) => `stage-builder:tour-${m}`;
export const hasModeTour = (m: Mode) => !!MODE_TOURS[m];

interface Step {
  target: string;
  side: 'right' | 'left' | 'bottom' | 'top';
  title: string;
  text: string;
}

const FIRST_RUN: Step[] = [
  { target: 'modes', side: 'right', title: 'Work in modes', text: 'Stage, Set, Lights and Blocking — press 1–4 to switch (5 opens the venue, under Advanced). Things from other modes stay in view but can’t be picked.' },
  { target: 'picker', side: 'right', title: 'Pick a stage', text: 'Choose the kind of stage closest to your venue. You can switch at any time.' },
  { target: 'panel', side: 'left', title: 'Adjust the dimensions', text: 'Type your venue’s real measurements or drag the sliders — the model updates live. Size presets give you a quick starting point.' },
  { target: 'views', side: 'bottom', title: 'Check the views', text: 'Jump to seats around the venue to see what the audience sees. Drag in the 3D view to look around, scroll to zoom.' },
];

const MODE_TOURS: Partial<Record<Mode, Step[]>> = {
  venue: [
    { target: 'venue-tools', side: 'right', title: 'Draw the building', text: 'Walls (W), rooms (M), doors (D) and furniture (F). Rooms show their name and area; mark doors that lead onto the stage.' },
    { target: 'plan', side: 'right', title: 'Plan and 3D together', text: 'Draw on the plan and see it built in 3D. Selecting something in one selects it in the other. Import a floor plan to trace over it.' },
    { target: 'panel', side: 'left', title: 'Routes and entrances', text: 'Use the Route tool to time walks between rooms; named stage entrances are listed here and used in Blocking.' },
  ],
  lights: [
    { target: 'light-library', side: 'right', title: 'Hang some lights', text: 'Drag a light onto a light bar, side pole or lighting frame — or click it to hang it above the stage. Shift-click to select several.' },
    { target: 'panel', side: 'left', title: 'Aim and colour', text: 'Select a light to focus it (click a point on stage, or drag its target), pick a gel or colour temperature, add a gobo.' },
    { target: 'light-looks', side: 'right', title: 'Looks', text: 'Save lighting states as looks and fade between them. The work light (right) helps while you build; the Lighting plan prints the drawing for the crew.' },
  ],
  blocking: [
    { target: 'cast', side: 'right', title: 'Your cast', text: 'Add performers, name and colour them. Shift-click several to group them or set a formation.' },
    { target: 'panel', side: 'left', title: 'Paths', text: 'Select a performer and draw their path. Paths can start or end at an entrance; add pauses and timing.' },
    { target: 'playbar', side: 'top', title: 'Play it', text: 'Play the scene (Space), scrub, slow it down. Checks catch performers seen waiting at the side, hidden or bumping into each other.' },
  ],
};

const TIP_W = 290;

const markSeen = (k: string) => {
  try {
    localStorage.setItem(k, '1');
  } catch {
    // ignore
  }
};

export function Tour() {
  const mode = useProjectStore((s) => s.mode);
  const [tour, setTour] = useState<{ steps: Step[]; key: string; step: number; returnTo: Mode } | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const close = useCallback(() => {
    if (tour) {
      markSeen(tour.key);
      // Back to where you were when the tour started.
      if (useProjectStore.getState().mode !== tour.returnTo) useProjectStore.getState().setMode(tour.returnTo);
    }
    setTour(null);
  }, [tour]);

  useEffect(() => {
    const replay = () => {
      const returnTo = useProjectStore.getState().mode;
      useProjectStore.getState().setMode('stage');
      setTour({ steps: FIRST_RUN, key: DONE_KEY, step: 0, returnTo });
    };
    const modeTour = () => {
      const m = useProjectStore.getState().mode;
      const steps = MODE_TOURS[m];
      if (steps) setTour({ steps, key: modeKey(m), step: 0, returnTo: m });
    };
    window.addEventListener(TOUR_EVENT, replay);
    window.addEventListener(MODE_TOUR_EVENT, modeTour);
    return () => {
      window.removeEventListener(TOUR_EVENT, replay);
      window.removeEventListener(MODE_TOUR_EVENT, modeTour);
    };
  }, []);

  // Leaving the mode a mode tour is about ends that tour.
  useEffect(() => {
    if (tour && tour.key !== DONE_KEY && tour.key !== modeKey(mode)) setTour(null);
  }, [mode, tour]);

  useLayoutEffect(() => {
    if (!tour) return;
    const measure = () => setRect(document.querySelector(`[data-tour="${tour.steps[tour.step].target}"]`)?.getBoundingClientRect() ?? null);
    measure();
    const id = setInterval(measure, 500);
    window.addEventListener('resize', measure);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('keydown', onKey);
    };
  }, [tour, close]);

  if (!tour || !rect) return null;
  const s = tour.steps[tour.step];
  const last = tour.step === tour.steps.length - 1;
  const pos =
    s.side === 'right'
      ? { left: rect.right + 14, top: Math.min(rect.top + 40, window.innerHeight - 220) }
      : s.side === 'left'
        ? { left: rect.left - TIP_W - 14, top: rect.top + 60 }
        : s.side === 'top'
          ? { left: Math.max(12, rect.left + rect.width / 2 - TIP_W / 2), top: rect.top - 190 }
          : { left: Math.max(12, rect.left + rect.width / 2 - TIP_W / 2), top: rect.bottom + 14 };
  return (
    <div className="tour" aria-live="polite">
      <div className="tour__ring" style={{ left: rect.left + 3, top: rect.top + 3, width: rect.width - 6, height: Math.min(rect.height, window.innerHeight - rect.top) - 6 }} />
      <div className={`tour__tip tour__tip--${s.side}`} style={{ ...pos, width: TIP_W }} role="dialog" aria-label={s.title}>
        <div className="tour__step">
          Step {tour.step + 1} of {tour.steps.length}
        </div>
        <div className="tour__title">{s.title}</div>
        <p className="tour__text">{s.text}</p>
        <div className="tour__actions">
          <button className="btn btn--ghost" onClick={close}>
            {last ? 'Close' : 'Skip'}
          </button>
          <button className="btn btn--primary" onClick={() => (last ? close() : setTour({ ...tour, step: tour.step + 1 }))}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
