import { useEffect, useState, type ReactNode } from 'react';
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
import { MoreOptions } from '../MoreOptions';

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
export function ChecksSection({ more }: { more?: ReactNode }) {
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
        <h3 className="group__title">
          Checks {checking !== null && <span className="hint">· checking… {Math.round(checking * 100)}%</span>}
        </h3>
        {!b.performers.length && <p className="hint">Checks run by themselves once there are performers on stage.</p>}
        {warnings && !warnings.length && !stale && <p className="panel-msg panel-msg--info">Looks good — nobody is hidden, seen in the wings or bumping into anyone.</p>}
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
                    <span className="warning__icon">{ICON[w.kind]}</span> {w.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <MoreOptions id="blocking">
        {more}
        <section className="group">
          <h3 className="group__title">Check settings</h3>
          <Field def={{ key: 'hs', label: 'Flag when hidden from more than (%) of seats', group: '', type: 'number', unit: 'none', default: 20, min: 5, max: 90, step: 5 }} value={b.checks.hiddenShare} units={units} onChange={(v) => setChecks({ hiddenShare: v as number })} />
          <label className="field field--inline">
            <span className="field__label">
              Flag: <Plain text="Upstaging" />
            </span>
            <button type="button" role="switch" aria-checked={b.checks.upstaged} className={`switch ${b.checks.upstaged ? 'is-on' : ''}`} onClick={() => setChecks({ upstaged: !b.checks.upstaged })}>
              <span className="switch__knob" />
            </button>
          </label>
        </section>
        {b.performers.length > 0 && (
          <section className="group">
            <h3 className="group__title">Blocking sheets</h3>
            <button className="btn" disabled={busy} onClick={() => void exportPdf()}>
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
        )}
      </MoreOptions>
    </>
  );
}

/** Checks run by themselves: a moment after each change to the blocking, and when playback starts with stale results. */
export function useAutoCheck() {
  const b = useActiveBlocking();
  const playing = useBlockingUI((s) => s.playing);
  const busy = useBlockingUI((s) => s.checking !== null);
  const key = checksKey(b);
  const performers = b.performers.length;
  // After each change (and again if something changed while a check was running).
  useEffect(() => {
    if (!performers || busy || key === lastKey) return;
    const timer = window.setTimeout(() => {
      if (useBlockingUI.getState().checking === null) void runBlockingChecks();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [key, performers, busy]);
  useEffect(() => {
    if (playing && performers && key !== lastKey && useBlockingUI.getState().checking === null) void runBlockingChecks();
  }, [playing, performers, key]);
}
