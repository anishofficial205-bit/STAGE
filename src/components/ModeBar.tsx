import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { MODES, type Mode, type OtherLayers } from '../modes';
import { useBlackBoxUI } from '../templates/blackBox/blocks';
import { useObjectUI } from '../objects/ui';
import { useShell } from './shell';
import { useLightsUI } from '../lighting/ui';

const LAYER_LABEL: Record<OtherLayers, string> = { show: 'Other layers: shown', dim: 'Other layers: dimmed', hide: 'Other layers: hidden' };
const NEXT: Record<OtherLayers, OtherLayers> = { show: 'dim', dim: 'hide', hide: 'show' };

const ICONS: Record<Mode, string> = {
  venue: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6',
  stage: 'M3 6h18M5 6v12M19 6v12M3 18h18M8 6c0 4 2 6 4 6s4-2 4-6',
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

/** The floating rail on the left: one button per mode (keys 1–5), plus layer and panel toggles. */
export function ModeBar() {
  const mode = useProjectStore((s) => s.mode);
  const otherLayers = useProjectStore((s) => s.otherLayers);
  const setMode = useProjectStore((s) => s.setMode);
  const setOtherLayers = useProjectStore((s) => s.setOtherLayers);
  const panels = useShell((s) => s.panels);
  const togglePanels = useShell((s) => s.togglePanels);

  // Leaving a mode drops whatever was picked in it.
  useEffect(() => {
    if (mode !== 'stage') useBlackBoxUI.getState().select(null);
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
      // F: Focus mode — except where F already means something (Venue's furniture tool, aiming a selected light).
      if (e.key.toLowerCase() === 'f') {
        const m = useProjectStore.getState().mode;
        const aiming = m === 'lights' && useLightsUI.getState().selected?.kind === 'fixture';
        if ((m === 'venue' && !e.shiftKey) || aiming) return;
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
      <span className="rail__logo" aria-hidden>
        <span />
      </span>
      <div className="rail__modes" role="tablist" aria-label="Mode" data-tour="modes">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            aria-disabled={m.soon || undefined}
            className={`rail__mode ${mode === m.id ? 'is-active' : ''} ${m.soon ? 'is-soon' : ''}`}
            onClick={() => !m.soon && setMode(m.id)}
            title={m.soon ? `${m.label} — coming soon` : `${m.description} (${i + 1})`}
          >
            <span className="rail__icon">
              <ModeIcon mode={m.id} />
            </span>
            {m.label}
          </button>
        ))}
      </div>
      <div className="rail__foot">
        <button
          className={`rail__tool is-${otherLayers}`}
          onClick={() => setOtherLayers(NEXT[otherLayers])}
          title="Things from other modes stay in view but can’t be picked. Click to show, dim or hide them."
          aria-label={LAYER_LABEL[otherLayers]}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
            <path d="m12 3 9 5-9 5-9-5 9-5Z" />
            <path d="m3 13 9 5 9-5" opacity={otherLayers === 'hide' ? 0.25 : 1} />
          </svg>
          {otherLayers === 'show' ? 'Other modes' : otherLayers === 'dim' ? 'Others dim' : 'Others off'}
        </button>
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
