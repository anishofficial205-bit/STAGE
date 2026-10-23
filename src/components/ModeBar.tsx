import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { MODES, type Mode } from '../modes';
import { useBlackBoxUI } from '../templates/blackBox/blocks';
import { useObjectUI } from '../objects/ui';
import { useShell } from './shell';
import { recordWithPicture } from '../projects/library';


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

/** The floating rail on the left: the four steps (keys 1–4), then Backstage & venue under Advanced (5), and the layer and panel toggles. */
export function ModeBar() {
  const mode = useProjectStore((s) => s.mode);
  const setMode = useProjectStore((s) => s.setMode);
  const panels = useShell((s) => s.panels);
  const togglePanels = useShell((s) => s.togglePanels);

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
    <nav className="rail" aria-label="Mode">
      <button
        className="rail__logo"
        onClick={() => {
          void recordWithPicture();
          useShell.getState().setHome(true);
        }}
        title="Home: start something new or open a recent project"
        aria-label="Home"
      >
        <span />
      </button>
      <div className="rail__modes" role="tablist" aria-label="Mode" data-tour="modes">
        {MODES.filter((m) => !m.advanced).map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            aria-disabled={m.soon || undefined}
            className={`rail__mode ${mode === m.id ? 'is-active' : ''} ${m.soon ? 'is-soon' : ''}`}
            onClick={() => !m.soon && setMode(m.id)}
            title={m.soon ? `${m.label} — coming soon` : `${m.description} (${MODES.indexOf(m) + 1})`}
          >
            <span className="rail__icon">
              <ModeIcon mode={m.id} />
            </span>
            {m.label}
          </button>
        ))}
      </div>
      <div className="rail__foot">
        <span className="rail__caption">Advanced</span>
        {MODES.filter((m) => m.advanced).map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className={`rail__mode rail__mode--advanced ${mode === m.id ? 'is-active' : ''}`}
            onClick={() => setMode(m.id)}
            title={`${m.description} (${MODES.indexOf(m) + 1})`}
          >
            <span className="rail__icon">
              <ModeIcon mode={m.id} />
            </span>
            Backstage &amp; venue
          </button>
        ))}
        <span className="rail__rule" />
        <button className={`rail__tool ${panels ? '' : 'is-on'}`} onClick={togglePanels} title={panels ? 'Hide panels to see the full stage (F)' : 'Show the panels again (F)'} aria-pressed={!panels}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d={panels ? 'M9 4v16M15 4v16' : 'M8 9l-2 3 2 3M16 9l2 3-2 3'} />
          </svg>
          Focus mode
        </button>
      </div>
    </nav>
  );
}
