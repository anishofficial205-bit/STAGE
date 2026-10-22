import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { MODES, type OtherLayers } from '../modes';
import { useBlackBoxUI } from '../templates/blackBox/blocks';
import { useObjectUI } from '../objects/ui';

const LAYER_LABEL: Record<OtherLayers, string> = { show: 'Other layers: shown', dim: 'Other layers: dimmed', hide: 'Other layers: hidden' };
const NEXT: Record<OtherLayers, OtherLayers> = { show: 'dim', dim: 'hide', hide: 'show' };

/** Mode tabs at the top centre of the view, with the "Show other layers" toggle. Keys 1–5 switch modes. */
export function ModeBar() {
  const mode = useProjectStore((s) => s.mode);
  const otherLayers = useProjectStore((s) => s.otherLayers);
  const setMode = useProjectStore((s) => s.setMode);
  const setOtherLayers = useProjectStore((s) => s.setOtherLayers);

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
    <div className="mode-bar" data-tour="modes">
      <div className="mode-bar__tabs" role="tablist" aria-label="Mode">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            aria-disabled={m.soon || undefined}
            className={`mode-bar__tab ${mode === m.id ? 'is-active' : ''} ${m.soon ? 'is-soon' : ''}`}
            onClick={() => !m.soon && setMode(m.id)}
            title={m.soon ? `${m.label} — coming soon` : `${m.description} (${i + 1})`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        className={`mode-bar__layers is-${otherLayers}`}
        onClick={() => setOtherLayers(NEXT[otherLayers])}
        title="Things from other modes stay in view but can’t be picked. Click to show, dim or hide them."
        aria-label={LAYER_LABEL[otherLayers]}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 13 9 5 9-5" opacity={otherLayers === 'hide' ? 0.25 : 1} />
        </svg>
        {otherLayers === 'show' ? 'Other layers' : otherLayers === 'dim' ? 'Dimmed' : 'Hidden'}
      </button>
    </div>
  );
}
