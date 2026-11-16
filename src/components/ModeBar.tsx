import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { MODES, type Mode } from '../modes';
import { useBlackBoxUI } from '../templates/blackBox/blocks';
import { useObjectUI } from '../objects/ui';
import { useShell } from './shell';
import { ThemeToggle } from './ThemeToggle';


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

/** Full view: every mode's things (set, lights, performers, masking) at full strength, so you see the finished picture while you work. Off: other modes are dimmed again. */
function FullView() {
  const on = useProjectStore((s) => s.otherLayers === 'show');
  return (
    <button
      className={`modes__btn modes__full ${on ? 'is-active' : ''}`}
      aria-pressed={on}
      onClick={() => useProjectStore.getState().setOtherLayers(on ? 'dim' : 'show')}
      title={on ? 'Full view is on: everything shows at full. Click to dim other modes (V)' : 'See everything at full: set, lights and performers together (V)'}
    >
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      Full view
    </button>
  );
}

/** The mode switcher at the top centre: Set, Lights, Performers (keys 1–3), then Backstage (4), and the light/dark switch. Also holds the mode keys and F for Focus mode. */
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
      // V: Full view on/off.
      if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const s = useProjectStore.getState();
        s.setOtherLayers(s.otherLayers === 'show' ? 'dim' : 'show');
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
      <span className="modes__sep" aria-hidden />
      <FullView />
      <ThemeToggle className="modes__theme" />
    </nav>
  );
}
