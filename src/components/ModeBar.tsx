import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { MODES, type Mode } from '../modes';
import { useBlackBoxUI } from '../templates/blackBox/blocks';
import { useObjectUI } from '../objects/ui';
import { useShell } from './shell';


const ICONS: Record<Mode, string> = {
  venue: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6',
  set: 'M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3zM6 18v2M18 18v2',
  lights: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
  blocking: 'M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 21l1.5-7L8 12l1-4h6l1 4-2.5 2L15 21',
};

export function ModeIcon({ mode, size = 18 }: { mode: Mode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[mode]} />
    </svg>
  );
}

/** The mode switcher at the top centre: Set, Lights, Performers (keys 1–3), then Backstage (4). Also holds the mode keys and F for Focus mode. */
export function ModeBar() {
  const mode = useProjectStore((s) => s.mode);
  const setMode = useProjectStore((s) => s.setMode);

  // Leaving a mode drops whatever was picked in it.
  useEffect(() => {
    if (mode !== 'set') useBlackBoxUI.getState().select(null);
    if (mode !== 'set') {
      const ui = useObjectUI.getState();
      ui.setSelectedFace(null);
      ui.setRepositioning(false);
    }
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // F: Focus mode, in every mode.
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        useShell.getState().togglePanels();
        return;
      }
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < MODES.length) {
        e.preventDefault();
        useProjectStore.getState().setMode(MODES[i].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <nav className="modes" aria-label="Mode" role="tablist" data-tour="modes">
      {MODES.map((m) => (
        <span key={m.id} className="modes__item">
          {m.advanced && <span className="modes__sep" aria-hidden />}
          <button
            role="tab"
            aria-selected={mode === m.id}
            className={`modes__btn ${mode === m.id ? 'is-active' : ''} ${m.advanced ? 'modes__btn--quiet' : ''}`}
            onClick={() => setMode(m.id)}
            title={`${m.description} (${MODES.indexOf(m) + 1})`}
          >
            {!m.advanced && <ModeIcon mode={m.id} />}
            {m.advanced ? 'Backstage' : m.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
