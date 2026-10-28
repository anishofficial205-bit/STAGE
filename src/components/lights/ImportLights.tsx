import { useEffect, useMemo, useRef, useState } from 'react';
import { useLightsUI } from '../../lighting/ui';
import { FIELDS, guessMapping, parseCsv, recalledMapping, rememberMapping, rowsToLights, type FieldKey, type Mapping } from '../../lighting/csv';
import { readMvr } from '../../lighting/mvr';
import { placeImported, type ImportLight } from '../../lighting/importPlace';
import { FIXTURES } from '../../lighting/types';
import { useActiveLighting } from '../../store/useProjectStore';

type Loaded = { kind: 'csv'; name: string; head: string[]; rows: string[][] } | { kind: 'mvr'; name: string; lights: ImportLight[]; models: number };

const UNITS: { id: string; label: string; scale: number }[] = [
  { id: 'm', label: 'Metres', scale: 1 },
  { id: 'ft', label: 'Feet', scale: 0.3048 },
  { id: 'mm', label: 'Millimetres', scale: 0.001 },
  { id: 'in', label: 'Inches', scale: 0.0254 },
];

/** Bring in lights from a spreadsheet (CSV) or an MVR file. */
export function ImportLights() {
  const open = useLightsUI((s) => s.importOpen);
  if (!open) return null;
  return <ImportDialog onClose={() => useLightsUI.getState().setImportOpen(false)} />;
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapping, setMapping] = useState<Mapping>({});
  const [units, setUnits] = useState('m');
  const [up, setUp] = useState<'z' | 'y'>('z');
  const [replace, setReplace] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const existing = useActiveLighting().fixtures.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const read = async (file: File) => {
    setError('');
    setBusy(true);
    try {
      if (/\.mvr$/i.test(file.name)) {
        const r = await readMvr(file);
        setLoaded({ kind: 'mvr', name: file.name, ...r });
      } else {
        const table = parseCsv(await file.text());
        // The heading row: the first row with several non-numeric cells.
        const at = Math.max(0, table.findIndex((r) => r.filter((c) => c && !/^-?\d/.test(c)).length >= 2));
        const head = table[at] ?? [];
        const rows = table.slice(at + 1);
        if (!head.length || !rows.length) throw new Error('That file has no rows of lights in it.');
        setMapping(recalledMapping(head) ?? guessMapping(head));
        setLoaded({ kind: 'csv', name: file.name, head, rows });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file couldn’t be read.');
    }
    setBusy(false);
  };

  const lights = useMemo(() => {
    if (!loaded) return [];
    if (loaded.kind === 'mvr') return loaded.lights;
    return rowsToLights(loaded.rows, mapping, { scale: UNITS.find((u) => u.id === units)!.scale, up });
  }, [loaded, mapping, units, up]);
  const standIns = lights.filter((l) => !l.known).length;
  const withCoords = lights.filter((l) => l.pos).length;
  const withPosition = lights.filter((l) => !l.pos && l.position).length;
  const kinds = Object.entries(lights.reduce<Record<string, number>>((m, l) => ((m[FIXTURES[l.type].label] = (m[FIXTURES[l.type].label] ?? 0) + 1), m), {}));

  const go = () => {
    if (loaded?.kind === 'csv') rememberMapping(loaded.head, mapping);
    placeImported(lights, replace, `Brought in ${lights.length} light${lights.length === 1 ? '' : 's'}`);
    onClose();
  };

  const hasCoords = mapping.x !== undefined && mapping.y !== undefined && mapping.z !== undefined;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--wide import" role="dialog" aria-modal="true" aria-label="Bring in lights">
        <div className="import__head">
          <h2 className="modal__title">Bring in lights</h2>
          {loaded && <span className="hint">{loaded.name}</span>}
        </div>
        {!loaded ? (
          <>
            <button
              className={`import__drop ${drag ? 'is-over' : ''}`}
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) void read(f);
              }}
            >
              <b>{busy ? 'Reading…' : 'Drop a file here, or click to choose one'}</b>
              <span>A spreadsheet of your lights (.csv) — from Lightwright, a lighting console, Excel or Google Sheets — or an MVR file (.mvr) from Vectorworks, grandMA3 or Capture.</span>
            </button>
            {error && <p className="panel-msg panel-msg--warning">{error}</p>}
            <div className="import__help">
              <p className="sl-gt">What a spreadsheet can have</p>
              <p className="sl-note">One light per row. Any of: channel, name, kind or model, position (“1st Electric”), unit number, X / depth / height, colour or gel, brightness, beam angle, purpose. You’ll match the columns next — we guess most of them.</p>
            </div>
          </>
        ) : (
          <div className="import__body">
            {loaded.kind === 'csv' && (
              <div className="import__map">
                <p className="sl-gt">Match your columns</p>
                <div className="import__fields">
                  {FIELDS.map((f) => (
                    <label key={f.key} className="import__field" title={f.help}>
                      <span>{f.label}</span>
                      <select className="field__select" value={mapping[f.key] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }) as Mapping)}>
                        <option value="">—</option>
                        {loaded.head.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {hasCoords && (
                  <div className="import__coords">
                    <label className="import__field">
                      <span>Measured in</span>
                      <select className="field__select" value={units} onChange={(e) => setUnits(e.target.value)}>
                        {UNITS.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="import__field">
                      <span>Height is</span>
                      <select className="field__select" value={up} onChange={(e) => setUp(e.target.value as 'z' | 'y')}>
                        <option value="z">The Z column (most lighting software)</option>
                        <option value="y">The Y column</option>
                      </select>
                    </label>
                    <p className="sl-note">0, 0 is the centre of the front edge of the stage; depth goes upstage.</p>
                  </div>
                )}
                <div className="import__preview">
                  <table>
                    <thead>
                      <tr>
                        {loaded.head.map((h, i) => (
                          <th key={i} className={Object.values(mapping).includes(i) ? 'is-used' : ''}>
                            {h}
                            <small>{FIELDS.find((f) => mapping[f.key as FieldKey] === i)?.label ?? 'not used'}</small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loaded.rows.slice(0, 4).map((r, i) => (
                        <tr key={i}>
                          {loaded.head.map((_, j) => (
                            <td key={j}>{r[j]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="import__summary">
              <p className="import__count">
                <b>{lights.length}</b> light{lights.length === 1 ? '' : 's'}
              </p>
              <ul className="import__kinds">
                {kinds.map(([k, n]) => (
                  <li key={k}>
                    {n} × {k}
                  </li>
                ))}
              </ul>
              {standIns > 0 && (
                <p className="panel-msg panel-msg--warning">
                  {standIns === 1 ? '1 light we didn’t recognise comes' : `${standIns} lights we didn’t recognise come`} in as a stand-in wash light, marked “Stands in for…” so you can change the kind in the table.
                </p>
              )}
              <p className="sl-note">
                {withCoords > 0 && `${withCoords} placed by their coordinates. `}
                {withPosition > 0 && `${withPosition} hung on their named position. `}
                {lights.length - withCoords - withPosition > 0 && `${lights.length - withCoords - withPosition} spread over the bars above the stage.`}
                {loaded.kind === 'mvr' && ` ${loaded.models} with full model details.`}
              </p>
              {existing > 0 && (
                <div className="segmented segmented--wide2" role="group" aria-label="Lights already here">
                  <button className={!replace ? 'is-active' : ''} onClick={() => setReplace(false)}>
                    Add to the {existing} here
                  </button>
                  <button className={replace ? 'is-active' : ''} onClick={() => setReplace(true)}>
                    Replace them
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.txt,.mvr,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void read(f);
          }}
        />
        <div className="modal__actions">
          {loaded && (
            <button className="btn btn--ghost" onClick={() => setLoaded(null)}>
              Choose another file
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          {loaded && (
            <button className="btn btn--primary" disabled={!lights.length} onClick={go}>
              Bring in {lights.length} light{lights.length === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
