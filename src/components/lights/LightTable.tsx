import { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveBlocking, useActiveLighting } from '../../store/useProjectStore';
import { useLightsUI } from '../../lighting/ui';
import { lightActions } from '../../lighting/actions';
import { FIXTURES, type Fixture, type FixtureType } from '../../lighting/types';
import { removePick } from '../layers/ops';

type SortKey = 'channel' | 'name' | 'type' | 'mount' | 'intensity';

/** Every light as a row you can edit: for people who think in channel lists. */
export function LightTable() {
  const open = useLightsUI((s) => s.tableOpen);
  if (!open) return null;
  return <Table onClose={() => useLightsUI.getState().setTableOpen(false)} />;
}

function Table({ onClose }: { onClose: () => void }) {
  const lighting = useActiveLighting();
  const performers = useActiveBlocking().performers;
  const selected = useLightsUI((s) => (s.selected?.kind === 'fixture' ? s.selected.ids : []));
  const solo = useLightsUI((s) => s.solo);
  const [find, setFind] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; up: boolean }>({ key: 'channel', up: true });
  const findRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    findRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const where = (f: Fixture) => (f.mount === 'floor' ? 'Floor' : f.mount === 'rig' ? 'Rigging' : lighting.positions.find((p) => p.id === f.mount)?.name ?? '—');
  const rows = useMemo(() => {
    const q = find.trim().toLowerCase();
    // A number finds that channel (and channels starting with it).
    const list = lighting.fixtures.filter((f) => !q || (/^\d+$/.test(q) ? String(f.channel).startsWith(q) : `${f.name} ${FIXTURES[f.type].label} ${where(f)} ${f.purpose ?? ''} ${f.standIn ?? ''} ${f.gel ?? ''}`.toLowerCase().includes(q)));
    const val = (f: Fixture): string | number => (sort.key === 'channel' ? f.channel : sort.key === 'name' ? f.name.toLowerCase() : sort.key === 'type' ? FIXTURES[f.type].label : sort.key === 'mount' ? where(f) : f.on ? f.intensity : 0);
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : a.channel - b.channel) * (sort.up ? 1 : -1);
    });
  }, [lighting, find, sort]);

  const select = (id: string, additive: boolean) => useLightsUI.getState().select({ kind: 'fixture', ids: [id] }, additive);
  const head = (key: SortKey, label: string) => (
    <th>
      <button className={`lt__sort ${sort.key === key ? 'is-on' : ''}`} onClick={() => setSort((s) => ({ key, up: s.key === key ? !s.up : true }))}>
        {label}
        {sort.key === key ? (sort.up ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
  const many = selected.length > 1;
  const sel = lighting.fixtures.filter((f) => selected.includes(f.id));

  return (
    <div className="modal-backdrop lt__backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--wide lt" role="dialog" aria-modal="true" aria-label="All lights">
        <div className="lt__top">
          <h2 className="modal__title">All lights</h2>
          <input
            ref={findRef}
            className="field__input lt__find"
            placeholder="Find: type a channel number, a name, a colour…"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && rows[0]) select(rows[0].id, false);
            }}
          />
          <span className="hint">
            {rows.length} of {lighting.fixtures.length}
          </span>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
        {sel.length > 0 && (
          <div className="lt__bar">
            <b>{many ? `${sel.length} lights picked` : sel[0].name}</b>
            <label className="lt__inline">
              Brightness
              <input type="number" min={0} max={100} className="field__input lt__num" value={Math.round(sel[0].intensity)} onChange={(e) => lightActions.patch(selected, { intensity: Math.min(100, Math.max(0, Number(e.target.value) || 0)), on: Number(e.target.value) > 0 }, `lt-int:${selected.join()}`)} />
            </label>
            <label className="lt__inline">
              Colour
              <input type="color" className="color-field__picker" value={sel[0].color} onChange={(e) => lightActions.patch(selected, { color: e.target.value, gel: undefined, kelvin: undefined }, `lt-col:${selected.join()}`)} />
            </label>
            <button className={`btn btn--small ${solo ? 'is-active' : ''}`} onClick={() => useLightsUI.getState().setSolo(solo ? null : selected)}>
              {solo ? 'Show all' : 'Solo'}
            </button>
            <button className="btn btn--small btn--danger" onClick={() => removePick({ domain: 'lights', kind: 'fixture', ids: selected })}>
              Delete
            </button>
            <span className="hint">⇧ or ⌘ click rows to pick several; changes here apply to all of them.</span>
          </div>
        )}
        <div className="lt__wrap">
          <table className="lt__table">
            <thead>
              <tr>
                {head('channel', 'Ch')}
                {head('name', 'Name')}
                {head('type', 'Kind')}
                {head('mount', 'Hangs on')}
                <th>Colour</th>
                {head('intensity', 'Level')}
                <th>On</th>
                <th>Follows</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr
                  key={f.id}
                  className={selected.includes(f.id) ? 'is-selected' : ''}
                  onMouseDown={(e) => {
                    if ((e.target as HTMLElement).closest('input, select, button')) return;
                    select(f.id, e.shiftKey || e.metaKey || e.ctrlKey);
                  }}
                >
                  <td>
                    <input className="lt__cell lt__ch" type="number" min={1} value={f.channel} onFocus={() => !selected.includes(f.id) && select(f.id, false)} onChange={(e) => lightActions.patch([f.id], { channel: Math.max(1, Math.round(Number(e.target.value) || 1)) }, `lt-ch:${f.id}`)} />
                  </td>
                  <td>
                    <input className="lt__cell" value={f.name} onFocus={() => !selected.includes(f.id) && select(f.id, false)} onChange={(e) => lightActions.patch([f.id], { name: e.target.value }, `lt-name:${f.id}`)} />
                    {f.standIn && <small className="lt__standin">Stands in for {f.standIn}</small>}
                  </td>
                  <td>
                    <select className="lt__cell" value={f.type} onChange={(e) => lightActions.patch([f.id], (x) => changeType(x, e.target.value as FixtureType))}>
                      {(Object.keys(FIXTURES) as FixtureType[]).map((t) => (
                        <option key={t} value={t}>
                          {FIXTURES[t].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="lt__muted">{where(f)}</td>
                  <td>
                    <span className="lt__colour">
                      <input type="color" className="lt__swatch" value={f.color} onChange={(e) => lightActions.patch([f.id], { color: e.target.value, gel: undefined, kelvin: undefined }, `lt-col:${f.id}`)} aria-label="Colour" />
                      <small>{f.gel ?? (f.kelvin ? `${f.kelvin} K` : '')}</small>
                    </span>
                  </td>
                  <td>
                    <input className="lt__cell lt__num" type="number" min={0} max={100} value={Math.round(f.intensity)} onChange={(e) => lightActions.patch([f.id], { intensity: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }, `lt-int:${f.id}`)} />
                  </td>
                  <td>
                    <input type="checkbox" checked={f.on} onChange={() => lightActions.patch([f.id], { on: !f.on })} aria-label="On" />
                  </td>
                  <td>
                    {FIXTURES[f.type].point ? (
                      <span className="lt__muted">—</span>
                    ) : (
                      <select className="lt__cell" value={f.follow ?? ''} onChange={(e) => lightActions.patch([f.id], { follow: e.target.value || undefined })}>
                        <option value="">—</option>
                        {performers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <input className="lt__cell" value={f.purpose ?? ''} placeholder="—" onChange={(e) => lightActions.patch([f.id], { purpose: e.target.value || undefined }, `lt-purpose:${f.id}`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="sl-note lt__none">No lights match “{find}”.</p>}
        </div>
      </div>
    </div>
  );
}

/** Switch a light's kind, keeping its beam and edge within what the new kind can do. */
function changeType(f: Fixture, type: FixtureType): Partial<Fixture> {
  const spec = FIXTURES[type];
  return { type, beam: spec.beam[1] ? Math.min(spec.beam[1], Math.max(spec.beam[0], f.beam)) : spec.beam[2], soft: spec.soft };
}
