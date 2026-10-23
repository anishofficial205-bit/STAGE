import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { Field } from '../fields';
import { useActiveBlocking, useProjectStore } from '../../store/useProjectStore';
import { checksKey, runChecks } from '../../blocking/checks';
import { blockingPdf } from '../../blocking/sheets';
import { useBlockingUI, type BlockingWarning } from '../../blocking/ui';
import { viewportBridge } from '../../objects/ui';
import { download } from '../../graphics/specSheet';
import { exportName } from '../../export/exports';
import { Plain } from '../../glossary/Plain';

const ICON: Record<BlockingWarning['kind'], string> = { wings: '👁', hidden: '▦', collision: '⚠', upstaged: '↺' };
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

let lastKey = '';

export async function runBlockingChecks() {
  const three = viewportBridge.three;
  const ui = useBlockingUI.getState();
  if (!three || ui.checking !== null) return;
  ui.setChecking(0);
  const s = useProjectStore.getState();
  lastKey = checksKey(s.blockingByTemplate[s.templateId]!);
  try {
    ui.setWarnings(await runChecks(three.scene as THREE.Scene, (p) => useBlockingUI.getState().setChecking(p)));
  } finally {
    useBlockingUI.getState().setChecking(null);
  }
}

/** Checks list (click a warning to jump there) and blocking-sheet exports. */
export function ChecksSection() {
  const b = useActiveBlocking();
  const warnings = useBlockingUI((s) => s.warnings);
  const checking = useBlockingUI((s) => s.checking);
  const highlight = useBlockingUI((s) => s.highlight);
  const units = useProjectStore((s) => s.units);
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const stale = warnings && checksKey(b) !== lastKey;
  const setChecks = (change: Partial<typeof b.checks>) => useProjectStore.getState().setBlocking((x) => ({ ...x, checks: { ...x.checks, ...change } }), `checks:${Object.keys(change).join()}`);
  const exportPdf = async (only?: string) => {
    setBusy(true);
    try {
      const p = only ? b.performers.find((x) => x.id === only) : undefined;
      download(await blockingPdf(only), exportName(p ? `track-${p.name.replace(/\W+/g, '-').toLowerCase()}.pdf` : 'blocking.pdf'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="group">
        <h3 className="group__title">Checks</h3>
        <Field def={{ key: 'hs', label: 'Flag when hidden from more than (%) of seats', group: '', type: 'number', unit: 'none', default: 20, min: 5, max: 90, step: 5 }} value={b.checks.hiddenShare} units={units} onChange={(v) => setChecks({ hiddenShare: v as number })} />
        <label className="field field--inline">
          <span className="field__label">
            Flag: <Plain text="Upstaging" />
          </span>
          <button type="button" role="switch" aria-checked={b.checks.upstaged} className={`switch ${b.checks.upstaged ? 'is-on' : ''}`} onClick={() => setChecks({ upstaged: !b.checks.upstaged })}>
            <span className="switch__knob" />
          </button>
        </label>
        <button className="btn" onClick={() => void runBlockingChecks()} disabled={checking !== null || !b.performers.length}>
          {checking !== null ? `Checking… ${Math.round(checking * 100)}%` : 'Run checks'}
        </button>
        {stale && <p className="hint">The blocking has changed since the last check.</p>}
        {warnings && !warnings.length && <p className="panel-msg panel-msg--info">No problems found in this scene.</p>}
        {warnings && warnings.length > 0 && (
          <ul className="warning-list">
            {warnings.map((w) => (
              <li key={w.id}>
                <button
                  className={`warning ${highlight?.id === w.id ? 'is-active' : ''}`}
                  onClick={() => {
                    const ui = useBlockingUI.getState();
                    ui.setPlaying(false);
                    ui.setTime(w.time);
                    // Highlight rather than select, so this list stays open.
                    ui.setHighlight(highlight?.id === w.id ? null : w);
                  }}
                >
                  <span className="warning__time">
                    {fmt(w.time)}
                    {w.until > w.time ? `–${fmt(w.until)}` : ''}
                  </span>
                  <span>
                    {ICON[w.kind]} {w.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="group">
        <h3 className="group__title">Blocking sheets</h3>
        <button className="btn" disabled={busy || !b.performers.length} onClick={() => void exportPdf()}>
          {busy ? 'Making PDF…' : 'Export blocking sheets (PDF)'}
        </button>
        <div className="look-save" style={{ marginTop: 8 }}>
          <select className="field__select" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Performer">
            <option value="">One performer’s track…</option>
            {b.performers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn btn--small" disabled={!who || busy} onClick={() => void exportPdf(who)}>
            PDF
          </button>
        </div>
      </section>
    </>
  );
}

/** While playing, run the checks once if there are no results yet. */
export function useAutoCheck() {
  const playing = useBlockingUI((s) => s.playing);
  const ran = useRef(false);
  useEffect(() => {
    if (playing && !useBlockingUI.getState().warnings && !ran.current) {
      ran.current = true;
      void runBlockingChecks();
    }
  }, [playing]);
}
