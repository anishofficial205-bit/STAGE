import { useEffect, useMemo, useState } from 'react';
import { Collapsible } from '../Collapsible';
import { Field } from '../fields';
import { useActiveBlocking, useProjectStore } from '../../store/useProjectStore';
import type { ParamDef } from '../../types';
import { blockingActions, posesAt } from '../../blocking/actions';
import { useBlockingUI } from '../../blocking/ui';
import { computeEntrances } from '../../blocking/entrances';
import { SPEEDS, initials, type Path, type Performer } from '../../blocking/types';
import { ChecksSection } from './ChecksPanel';
import { Plain } from '../../glossary/Plain';
import { plainText } from '../../glossary/terms';

function Scenes() {
  const b = useActiveBlocking();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Collapsible id="bk-scenes" title={`Scenes (${b.scenes.length})`}>
      <ul className="look-list">
        {b.scenes.map((s, i) => (
          <li key={s.id} className={`look-row ${s.id === b.sceneId ? 'is-current' : ''}`}>
            {editing === s.id ? (
              <input className="field__input" autoFocus value={s.name} onChange={(e) => blockingActions.renameScene(s.id, e.target.value)} onBlur={() => setEditing(null)} onKeyDown={(e) => e.key === 'Enter' && setEditing(null)} />
            ) : (
              <button className="look-row__go" onClick={() => blockingActions.openScene(s.id)} onDoubleClick={() => setEditing(s.id)} title="Open this scene (double-click to rename)">
                {i + 1}. {s.name}
              </button>
            )}
            <span className="look-row__tools">
              <button onClick={() => blockingActions.moveScene(s.id, -1)} disabled={i === 0} title="Move up">
                ▲
              </button>
              <button onClick={() => blockingActions.moveScene(s.id, 1)} disabled={i === b.scenes.length - 1} title="Move down">
                ▼
              </button>
              <button onClick={() => setEditing(s.id)} title="Rename">✎</button>
              <button onClick={() => blockingActions.duplicateScene(s.id)} title="Duplicate: a new scene starting where this one ends">⧉</button>
              <button onClick={() => blockingActions.removeScene(s.id)} disabled={b.scenes.length <= 1} title="Delete">
                ×
              </button>
            </span>
          </li>
        ))}
      </ul>
      <button className="btn btn--small" onClick={blockingActions.addScene}>
        + Add scene
      </button>
    </Collapsible>
  );
}

/** Adding performers (they're listed, renamed, hidden and deleted in Layers). */
function Cast() {
  const count = useActiveBlocking().performers.length;
  return (
    <Collapsible id="bk-cast" title={`Cast (${count})`} tour="cast">
      <button className="btn btn--small" onClick={blockingActions.addPerformer}>
        + Add performer
      </button>
      <p className="hint">Performers are listed in Layers on the right; click one to change its colour, height and posture.</p>
    </Collapsible>
  );
}

const FORMATIONS = [
  ['line', 'Line'],
  ['arc', 'Arc'],
  ['circle', 'Circle'],
  ['v', 'V'],
  ['cluster', 'Cluster'],
] as const;

function Groups() {
  const b = useActiveBlocking();
  const selected = useBlockingUI((s) => (s.selected?.kind === 'performer' ? s.selected.ids : []));
  const [name, setName] = useState('');
  return (
    <Collapsible id="bk-groups" title={`Groups${b.groups.length ? ` (${b.groups.length})` : ''}`}>
      <div className="look-save">
        <input className="field__input" placeholder="e.g. Chorus" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn--small" disabled={selected.length < 2} onClick={() => (blockingActions.createGroup(name, selected), setName(''))} title="Group the selected performers (Shift-click to select several)">
          Group {selected.length || ''}
        </button>
      </div>
      {selected.length > 1 && (
        <>
          <p className="hint">Formation for the {selected.length} selected:</p>
          <div className="chips">
            {FORMATIONS.map(([k, label]) => (
              <button key={k} className="chip" onClick={() => blockingActions.formation(selected, k)}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {!b.groups.length && selected.length < 2 && <p className="hint">Shift-click performers to select several, then group them or arrange them in a formation.</p>}
    </Collapsible>
  );
}

function Entrances() {
  const b = useActiveBlocking();
  const s = useProjectStore();
  const tool = useBlockingUI((x) => x.tool);
  const list = useMemo(() => computeEntrances(s, b), [s, b]);
  const labels: Record<string, string> = { wings: 'wings', venue: 'venue door', stage: 'stage', house: 'house', custom: 'custom' };
  return (
    <Collapsible id="bk-entrances" title={`Entrances (${list.length})`}>
      <ul className="venue-list">
        {list.map((e) => (
          <li key={e.id}>
            <button className="btn btn--ghost" onClick={() => useBlockingUI.getState().select({ kind: 'entrance', id: e.id })}>
              <Plain text={e.name} /> <span className="hint">{plainText(labels[e.source])}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className={`btn btn--small ${tool === 'entrance' ? 'is-active' : ''}`} onClick={() => useBlockingUI.getState().setTool(tool === 'entrance' ? null : 'entrance')}>
        + Add entrance
      </button>
      <p className="hint">Found from wing gaps between masking legs, venue doors marked as stage entrances, vomitories and house aisles.</p>
    </Collapsible>
  );
}

/** Left side in Blocking mode. */
export function BlockingLeft() {
  // Keys: Space plays/pauses; Delete removes the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const ui = useBlockingUI.getState();
      if (e.key === ' ') {
        e.preventDefault();
        ui.setPlaying(!ui.playing);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selected && !ui.tool) {
        e.preventDefault();
        const sel = ui.selected;
        if (sel.kind === 'performer') blockingActions.removePerformers(sel.ids);
        else if (sel.kind === 'path') blockingActions.removePath(sel.id);
        else if (sel.kind === 'mark') blockingActions.removeMark(sel.id);
        else if (sel.kind === 'entrance') blockingActions.removeEntrance(sel.id);
      } else if (e.key === 'Escape' && !ui.tool) ui.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const performerCount = useActiveBlocking().performers.length;
  return (
    <>
      <Scenes />
      <Cast />
      {performerCount >= 2 && <Groups />}
      <Entrances />
    </>
  );
}

const num = (key: string, label: string, min: number, max: number, step: number, unit: 'none' | 'length' = 'none', help?: string): ParamDef => ({ key, label, group: '', type: 'number', unit, default: min, min, max, step, help });

function PerformerProps({ ids }: { ids: string[] }) {
  const b = useActiveBlocking();
  const units = useProjectStore((s) => s.units);
  const tool = useBlockingUI((s) => s.tool);
  const ps = b.performers.filter((p) => ids.includes(p.id));
  const s = useProjectStore();
  const entrances = useMemo(() => computeEntrances(s, b), [s, b]);
  if (!ps.length) return null;
  const p = ps[0];
  const one = ps.length === 1;
  const scene = b.scenes.find((x) => x.id === b.sceneId)!;
  const start = scene.start[p.id];
  const paths = scene.paths.filter((x) => x.performerId === p.id).sort((a, c) => a.start - c.start);
  const marks = b.marks.filter((m) => m.performerId === p.id);
  return (
    <div className="props">
      <div className="panel-head">
        {one ? <input className="obj-props__name" value={p.name} onChange={(e) => blockingActions.patchPerformers([p.id], { name: e.target.value })} aria-label="Name" /> : <h2 className="panel-title">{ps.length} performers</h2>}
        <button className="btn btn--link" onClick={() => useBlockingUI.getState().select(null)}>
          Done
        </button>
      </div>
      {one && (
        <Field def={{ key: 'color', label: 'Colour', group: '', type: 'color', default: '#e4572e' }} value={p.color} units={units} onChange={(v) => blockingActions.patchPerformers(ids, { color: v as string })} />
      )}
      <Field def={num('height', 'Height', 0.8, 2.3, 0.01, 'length')} value={p.height} units={units} onChange={(v) => blockingActions.patchPerformers(ids, { height: v as number })} />
      <Field
        def={{ key: 'posture', label: 'Posture', group: '', type: 'select', default: 'standing', options: [{ value: 'standing', label: 'Standing' }, { value: 'sitting', label: 'Sitting' }, { value: 'lying', label: 'Lying' }] }}
        value={p.posture}
        units={units}
        onChange={(v) => blockingActions.patchPerformers(ids, { posture: v as Performer['posture'] })}
      />
      {one && (
        <>
          <section className="group">
            <h3 className="group__title">At the start of this scene</h3>
            <Field def={num('facing', 'Facing (°)', -180, 180, 15, 'none', '0° faces out front; drag the arrow at their feet to turn them.')} value={Math.round((((start?.facing ?? 0) + 540) % 360) - 180)} units={units} onChange={(v) => blockingActions.setStart([p.id], () => ({ facing: v as number }), `facing:${p.id}`)} />
            <label className="field">
              <span className="field__label">Starts</span>
              <select
                className="field__select"
                value={start && !start.onStage && start.entrance ? start.entrance : ''}
                onChange={(e) => blockingActions.setStart([p.id], (cur) => (e.target.value ? { onStage: false, entrance: e.target.value } : { onStage: true, entrance: undefined, x: cur.x, z: cur.z }))}
              >
                <option value="">On stage</option>
                {entrances.map((en) => (
                  <option key={en.id} value={en.id}>
                    Off stage, at {plainText(en.name)}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="group">
            <h3 className="group__title">Moves</h3>
            <div className="btn-row">
              <button className={`btn ${tool === 'path' ? 'is-active' : ''}`} onClick={() => useBlockingUI.getState().setTool(tool === 'path' ? null : 'path')}>
                ✎ Draw path
              </button>
              <button className={`btn ${tool === 'mark' ? 'is-active' : ''}`} onClick={() => useBlockingUI.getState().setTool(tool === 'mark' ? null : 'mark')} title="Click the floor to put down spike marks">
                ✚ <Plain text="Spike marks" />
              </button>
            </div>
            {tool === 'path' && <p className="panel-msg panel-msg--info">Click points on the floor; double-click or Enter to finish. Click an entrance to exit there (or, as the first click, to enter from it).</p>}
            {tool === 'mark' && <p className="panel-msg panel-msg--info">Click the floor to put down {initials(p.name)} marks. Esc when done.</p>}
            <ul className="venue-list">
              {paths.map((x, i) => (
                <li key={x.id}>
                  <button className="btn btn--ghost" onClick={() => useBlockingUI.getState().select({ kind: 'path', id: x.id })}>
                    {i + 1}. from {x.start}s{x.exit ? ` → exits at ${entrances.find((e) => e.id === x.exit)?.name ?? 'entrance'}` : ''}
                  </button>
                </li>
              ))}
            </ul>
            {marks.length > 0 && <p className="hint">Spike marks: {marks.map((_, i) => `${initials(p.name)}${i + 1}`).join(', ')}</p>}
            <button className="btn btn--small" onClick={() => { const pose = posesAt(useBlockingUI.getState().time).get(p.id); if (pose) blockingActions.addMark(p.id, [pose.x, pose.z]); }}>
              + Floor mark where they stand
            </button>
          </section>
        </>
      )}
      <div className="btn-row">
        <button className="btn btn--danger" onClick={() => blockingActions.removePerformers(ids)}>
          Delete
        </button>
      </div>
    </div>
  );
}

function PathProps({ path }: { path: Path }) {
  const b = useActiveBlocking();
  const units = useProjectStore((s) => s.units);
  const p = b.performers.find((x) => x.id === path.performerId);
  const s = useProjectStore();
  const entrances = useMemo(() => computeEntrances(s, b), [s, b]);
  return (
    <div className="props">
      <div className="panel-head">
        <h2 className="panel-title">Path · {p?.name}</h2>
        <button className="btn btn--link" onClick={() => useBlockingUI.getState().select(p ? { kind: 'performer', ids: [p.id] } : null)}>
          Done
        </button>
      </div>
      <Field def={num('start', 'Starts at (s)', 0, 600, 0.1)} value={path.start} units={units} onChange={(v) => blockingActions.patchPath(path.id, { start: v as number })} />
      <Field
        def={{ key: 'timing', label: 'Timing', group: '', type: 'select', default: 'speed', options: [{ value: 'speed', label: 'Walking speed' }, { value: 'duration', label: 'Takes a set time' }] }}
        value={path.timing}
        units={units}
        onChange={(v) => blockingActions.patchPath(path.id, { timing: v as Path['timing'] })}
      />
      {path.timing === 'speed' ? (
        <Field def={{ key: 'speed', label: 'Speed', group: '', type: 'select', default: 'normal', options: Object.entries(SPEEDS).map(([value, x]) => ({ value, label: x.label })) }} value={path.speed} units={units} onChange={(v) => blockingActions.patchPath(path.id, { speed: v as Path['speed'] })} />
      ) : (
        <Field def={num('duration', 'Duration (s, with pauses)', 0.5, 300, 0.5)} value={path.duration} units={units} onChange={(v) => blockingActions.patchPath(path.id, { duration: v as number })} />
      )}
      <section className="group">
        <h3 className="group__title">Pauses</h3>
        {path.points.map((_, i) => (
          <Field key={i} def={num(`hold${i}`, `At point ${i + 1}: hold (s)`, 0, 60, 0.5)} value={path.stops.find((x) => x.index === i)?.hold ?? 0} units={units} onChange={(v) => blockingActions.setStop(path.id, i, v as number)} />
        ))}
        <p className="hint">Drag the white points in the view to reshape the path; double-click one to delete it.</p>
      </section>
      <label className="field">
        <span className="field__label">Ends</span>
        <select className="field__select" value={path.exit ?? ''} onChange={(e) => blockingActions.patchPath(path.id, { exit: e.target.value || undefined })}>
          <option value="">On stage</option>
          {entrances.map((en) => (
            <option key={en.id} value={en.id}>
              Exits at {plainText(en.name)}
            </option>
          ))}
        </select>
      </label>
      <div className="btn-row">
        <button className="btn btn--danger" onClick={() => blockingActions.removePath(path.id)}>
          Delete path
        </button>
      </div>
    </div>
  );
}

function SceneProps() {
  const b = useActiveBlocking();
  const scene = b.scenes.find((x) => x.id === b.sceneId)!;
  return (
    <div className="props">
      <div className="panel-head">
        <h2 className="panel-title">{scene.name}</h2>
      </div>
      {b.performers.length === 0 ? (
        <div className="empty-state">
          <p>Add the people on stage, then plan where they move.</p>
          <button className="btn btn--primary btn--big" onClick={() => blockingActions.addPerformer()}>
            + Add a performer
          </button>
        </div>
      ) : (
        <p className="sidebar__empty">Select a performer and draw their path. Press Space to play the scene.</p>
      )}
      <ChecksSection
        more={
          <label className="field">
            <span className="field__label">Notes (on the blocking sheet)</span>
            <textarea className="field__input scene-notes" rows={4} value={scene.notes} onChange={(e) => blockingActions.setNotes(e.target.value)} />
          </label>
        }
      />
    </div>
  );
}

/** Right side in Blocking mode. */
export function BlockingProperties() {
  const b = useActiveBlocking();
  const s = useProjectStore();
  const selected = useBlockingUI((x) => x.selected);
  const entrances = useMemo(() => computeEntrances(s, b), [s, b]);
  if (selected?.kind === 'performer') return <PerformerProps ids={selected.ids} />;
  if (selected?.kind === 'path') {
    const path = b.scenes.find((x) => x.id === b.sceneId)?.paths.find((p) => p.id === selected.id);
    if (path) return <PathProps path={path} />;
  }
  if (selected?.kind === 'entrance') {
    const e = entrances.find((x) => x.id === selected.id);
    if (e)
      return (
        <div className="props">
          <div className="panel-head">
            <h2 className="panel-title">Entrance</h2>
            <button className="btn btn--link" onClick={() => useBlockingUI.getState().select(null)}>
              Done
            </button>
          </div>
          <label className="field">
            <span className="field__label">Name</span>
            <input className="field__input" value={e.name} onChange={(ev) => blockingActions.renameEntrance(e.id, ev.target.value)} disabled={e.source === 'venue'} title={e.source === 'venue' ? 'Rename it on its door in Venue mode' : undefined} />
          </label>
          {e.source === 'custom' && (
            <button className="btn btn--danger" onClick={() => blockingActions.removeEntrance(e.id)}>
              Delete entrance
            </button>
          )}
        </div>
      );
  }
  if (selected?.kind === 'mark') {
    const m = b.marks.find((x) => x.id === selected.id);
    const p = m && b.performers.find((x) => x.id === m.performerId);
    if (m && p)
      return (
        <div className="props">
          <div className="panel-head">
            <h2 className="panel-title">
              <Plain text="Spike mark" /> · {p.name}
            </h2>
          </div>
          <button className="btn btn--danger" onClick={() => blockingActions.removeMark(m.id)}>
            Delete mark
          </button>
        </div>
      );
  }
  return <SceneProps />;
}
