import { useEffect, useMemo, useState } from 'react';
import { templates, getTemplate } from '../templates/registry';
import { freshProject, newProjectId, useProjectStore } from '../store/useProjectStore';
import { defaultParams } from '../helpers/params';
import { useThumbnails } from './Thumbnails';
import { useShell } from './shell';
import { lookup } from '../glossary/terms';
import { Field } from './fields';
import { MoreOptions } from './MoreOptions';
import { formatLength } from '../units';
import { useCustomUI } from '../templates/custom/ui';
import { recordWithPicture } from '../projects/library';
import type { NumberParam, ParamDef, ParamValue, Params, StageTemplate } from '../types';

/** One card: a stage type at its default size, or one of its size presets. */
interface Card {
  key: string;
  templateId: string;
  preset?: number;
  title: string;
  /** The stage type, when the card is a preset (e.g. "Regional theatre" → Thrust). */
  type: string;
  params: Params;
  dashed?: boolean;
}

type Category = 'all' | 'theatre' | 'events' | 'custom' | 'recent';
const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All stages' },
  { id: 'theatre', label: 'Theatre' },
  { id: 'events', label: 'Events & outdoor' },
  { id: 'custom', label: 'Custom' },
  { id: 'recent', label: 'Recently used' },
];
const THEATRE = ['proscenium', 'end-stage', 'thrust', 'in-the-round', 'traverse', 'black-box'];
const EVENTS = ['open-air', 'end-stage', 'traverse'];
const EVENT_TITLES: Record<string, string> = { 'end-stage': 'End stage for events', traverse: 'Runway' };
const CAT_KEY = 'stage-builder:new-project-category';
const RECENT_KEY = 'stage-builder:recent-presets';

const plainName = (t: StageTemplate) => lookup(t.name)?.plain ?? t.name;
const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* not remembered */
  }
};

function cardsFor(t: StageTemplate, title?: string): Card[] {
  const base = defaultParams(t);
  const custom = t.id === 'custom';
  const out: Card[] = [{ key: `${t.id}`, templateId: t.id, title: custom ? 'Build your own stage' : (title ?? plainName(t)), type: t.name, params: base, dashed: custom }];
  (t.presets ?? []).forEach((p, i) => out.push({ key: `${t.id}:${i}`, templateId: t.id, preset: i, title: p.name, type: title ?? plainName(t), params: { ...base, ...p.params } }));
  return out;
}

function sizeOf(t: StageTemplate, params: Params) {
  const d = t.dimensions;
  const w = d?.width ? Number(params[d.width]) : NaN;
  const dep = d?.depth ? Number(params[d.depth]) : NaN;
  return Number.isFinite(w) && Number.isFinite(dep) ? { w, d: dep } : null;
}

/** Seating "rows" settings that can go to zero (so seating can be switched off). */
const rowDefs = (t: StageTemplate) => t.params.filter((p): p is NumberParam => p.type === 'number' && /^rows/i.test(p.key) && (p.min ?? 0) === 0);

/** A tiny live plan of the stage at the chosen size. */
function Plan({ w, d }: { w: number; d: number }) {
  const k = Math.min(150 / w, 70 / d);
  return (
    <svg className="np__plan" viewBox="0 0 180 110" aria-hidden>
      <rect x={90 - (w * k) / 2} y={12} width={w * k} height={d * k} rx={2} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${90 - (w * k) / 2 - 6 + i * 3} ${d * k + 22 + i * 7} Q 90 ${d * k + 28 + i * 7} ${90 + (w * k) / 2 + 6 - i * 3} ${d * k + 22 + i * 7}`} />
      ))}
    </svg>
  );
}

/**
 * Create a project with a stage. `mode: 'change'` reuses the dialog to change the
 * stage of the open project (no name field).
 */
export function createProject(templateId: string, params: Params, name: string) {
  const store = useProjectStore.getState();
  const base = freshProject();
  store.loadFile({
    ...base,
    app: 'stage-builder',
    version: 2,
    projectId: newProjectId(),
    projectName: name.trim() || 'Untitled stage',
    units: store.units,
    templateId,
    paramsByTemplate: { ...base.paramsByTemplate, [templateId]: { ...base.paramsByTemplate[templateId], ...params } },
    mode: 'set',
  });
  useProjectStore.getState().save();
  // Build your own: the empty floor with the drawing tool ready.
  if (templateId === 'custom') {
    useProjectStore.getState().selectStage(true);
    useCustomUI.getState().setTool('draw');
  }
  window.setTimeout(() => void recordWithPicture(), 2500);
}

export function NewProjectDialog() {
  const open = useShell((s) => s.newProject);
  const changing = useShell((s) => s.changingStage);
  const setOpen = useShell((s) => s.setNewProject);
  const images = useThumbnails((s) => s.images);
  const units = useProjectStore((s) => s.units);
  const [cat, setCat] = useState<Category>(() => read(CAT_KEY, 'all'));
  const [sel, setSel] = useState<Card | null>(null);
  const [name, setName] = useState('Untitled stage');
  const [params, setParams] = useState<Params>({});

  const all = useMemo(() => templates.flatMap((t) => cardsFor(t)), []);
  const cards = useMemo(() => {
    if (cat === 'theatre') return THEATRE.flatMap((id) => cardsFor(getTemplate(id)!));
    if (cat === 'events') return EVENTS.flatMap((id) => cardsFor(getTemplate(id)!, EVENT_TITLES[id]));
    if (cat === 'custom') return cardsFor(getTemplate('custom')!);
    if (cat === 'recent') {
      const keys = read<string[]>(RECENT_KEY, []);
      return keys.map((k) => all.find((c) => c.key === k)).filter((c): c is Card => !!c);
    }
    // All stages: Build your own goes last.
    return [...all.filter((c) => c.templateId !== 'custom'), ...all.filter((c) => c.templateId === 'custom')];
  }, [cat, all]);

  useEffect(() => {
    if (!open) return;
    setName('Untitled stage');
    const cur = useProjectStore.getState().templateId;
    const pick = useShell.getState().newProjectPick;
    if (pick && cat !== 'all') setCat('all');
    const first = (pick && all.find((c) => c.key === pick)) || (changing && all.find((c) => c.key === cur)) || cards[0] || all[0];
    setSel(first);
    setParams(first.params);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open || !sel) return null;
  const t = getTemplate(sel.templateId)!;
  const pick = (c: Card) => {
    setSel(c);
    setParams(c.params);
  };
  const create = (c: Card = sel, p: Params = params) => {
    write(RECENT_KEY, [c.key, ...read<string[]>(RECENT_KEY, []).filter((k) => k !== c.key)].slice(0, 8));
    setOpen(false);
    if (changing) {
      const store = useProjectStore.getState();
      store.changeStage(c.templateId, p);
      store.selectStage(true);
      return;
    }
    createProject(c.templateId, p, name);
    useShell.getState().setHome(false);
  };
  const chooseCat = (c: Category) => {
    setCat(c);
    write(CAT_KEY, c);
  };

  const dimKeys = [t.dimensions?.width, t.dimensions?.depth, t.dimensions?.height].filter(Boolean) as string[];
  const main = dimKeys.map((k) => t.params.find((d) => d.key === k)).filter((d): d is ParamDef => !!d);
  const rows = rowDefs(t);
  const seatingOn = rows.some((r) => Number(params[r.key]) > 0);
  const rest = t.params.filter((d) => !dimKeys.includes(d.key) && !rows.includes(d as NumberParam) && (!d.visible || d.visible(params)) && /Seating|Audience|Size|Stage|Arch|Thrust|Platform|Runway/i.test(d.group));
  const size = sizeOf(t, params);
  const setParam = (k: string, v: ParamValue) => setParams((p) => ({ ...p, [k]: v }));

  return (
    <div className="modal-backdrop np__backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="np" role="dialog" aria-modal="true" aria-label={changing ? 'Change stage type' : 'New project'}>
        <nav className="np__cats" aria-label="Categories">
          <h2 className="np__title">{changing ? 'Change stage' : 'New project'}</h2>
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`np__cat ${cat === c.id ? 'is-active' : ''}`} onClick={() => chooseCat(c.id)} aria-pressed={cat === c.id}>
              {c.label}
            </button>
          ))}
        </nav>

        <div className="np__cards">
          {cards.length === 0 ? (
            <p className="start__empty">Stages you create projects from will show here.</p>
          ) : (
            cards.map((c) => {
              const ct = getTemplate(c.templateId)!;
              const sz = sizeOf(ct, c.params);
              const term = lookup(ct.name);
              return (
                <button key={`${cat}:${c.key}`} className={`np__card ${sel.key === c.key ? 'is-active' : ''} ${c.dashed ? 'is-dashed' : ''}`} onClick={() => pick(c)} onDoubleClick={() => create(c, c.params)} data-tip-anchor="preset-card">
                  <span className="np__pic">{images[c.templateId] ? <img src={images[c.templateId]} alt="" /> : c.dashed ? <span className="np__nopic">✎</span> : <span className="card__loading" />}</span>
                  <span className="np__name">{c.title}</span>
                  <span className="np__sub">
                    {c.preset !== undefined ? c.type : term && term.plain !== term.tech ? term.tech : ''}
                    {sz ? `${c.preset !== undefined || (term && term.plain !== term.tech) ? ' · ' : ''}${formatLength(sz.w, units)} × ${formatLength(sz.d, units)}` : c.dashed ? 'Draw any shape' : ''}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <aside className="np__details" aria-label="Details">
          <div className="np__preview">
            {images[sel.templateId] ? <img src={images[sel.templateId]} alt="" /> : <span className="card__loading" />}
            {size && <Plan w={size.w} d={size.d} />}
          </div>
          <div className="np__heading">
            <b>{sel.title}</b>
            <span className="hint">{size ? `${formatLength(size.w, units)} × ${formatLength(size.d, units)}` : t.description}</span>
          </div>
          {changing ? (
            <p className="panel-msg panel-msg--warning">Set pieces, lights and performers stay where they are. Some may end up off the new stage.</p>
          ) : (
            <label className="field">
              <span className="field__label">Project name</span>
              <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} />
            </label>
          )}
          {main.map((d) => (
            <Field key={d.key} def={d} value={params[d.key]} units={units} onChange={(v) => setParam(d.key, v as ParamValue)} />
          ))}
          {rows.length > 0 && (
            <>
              <label className="field field--inline">
                <span className="field__label">Seating</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={seatingOn}
                  className={`switch ${seatingOn ? 'is-on' : ''}`}
                  onClick={() => setParams((p) => ({ ...p, ...Object.fromEntries(rows.map((r) => [r.key, seatingOn ? 0 : (sel.params[r.key] as number) || r.default || 10])) }))}
                >
                  <span className="switch__knob" />
                </button>
              </label>
              {seatingOn && rows.map((r) => <Field key={r.key} def={r} value={params[r.key]} units={units} onChange={(v) => setParam(r.key, v as ParamValue)} />)}
            </>
          )}
          {rest.length > 0 && (
            <MoreOptions id="new-project">
              {rest.map((d) => (
                <Field key={d.key} def={d} value={params[d.key]} units={units} onChange={(v) => setParam(d.key, v as ParamValue)} />
              ))}
            </MoreOptions>
          )}
          <div className="np__actions">
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn--primary btn--big" onClick={() => create()}>
              {changing ? 'Change stage' : 'Create'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
