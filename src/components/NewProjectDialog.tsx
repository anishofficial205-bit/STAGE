import { useEffect, useState } from 'react';
import { getTemplate } from '../templates/registry';
import { freshProject, newProjectId, useProjectStore } from '../store/useProjectStore';
import { defaultParams } from '../helpers/params';
import { useThumbnails } from './Thumbnails';
import { useShell } from './shell';
import { Field } from './fields';
import { MoreOptions } from './MoreOptions';
import { formatLength } from '../units';
import { useCustomUI } from '../templates/custom/ui';
import { recordWithPicture } from '../projects/library';
import type { NumberParam, ParamDef, ParamValue, Params, StageTemplate } from '../types';

/** One kind of stage in the picker: a stage type, or a variant of one (e.g. a theatre with a balcony). */
interface Kind {
  key: string;
  templateId: string;
  title: string;
  blurb: string;
  group: 'theatre' | 'events' | 'scratch';
  /** Settings this kind always has (e.g. the balcony). */
  params?: Params;
}

const KINDS: Kind[] = [
  { key: 'proscenium', templateId: 'proscenium', title: 'Framed stage', blurb: 'A classic theatre: the stage sits behind an arch, the audience in front.', group: 'theatre' },
  { key: 'proscenium:balcony', templateId: 'proscenium', title: 'Theatre with a balcony', blurb: 'Two floors of seating: the stalls below and a balcony above.', group: 'theatre', params: { balcony: true } },
  { key: 'thrust', templateId: 'thrust', title: 'Thrust stage', blurb: 'The stage reaches out into the audience, seated on three sides.', group: 'theatre' },
  { key: 'in-the-round', templateId: 'in-the-round', title: 'In the round', blurb: 'The audience sits all the way round a central stage.', group: 'theatre' },
  { key: 'black-box', templateId: 'black-box', title: 'Studio', blurb: 'A flexible empty room (a black box) that you arrange yourself.', group: 'theatre' },
  { key: 'end-stage', templateId: 'end-stage', title: 'Hall stage', blurb: 'A platform at one end of a flat room: schools, halls and conferences.', group: 'events' },
  { key: 'traverse', templateId: 'traverse', title: 'Runway', blurb: 'A long strip with the audience along both sides: fashion shows and catwalks.', group: 'events' },
  { key: 'open-air', templateId: 'open-air', title: 'Outdoor stage', blurb: 'A stage with truss under the sky: festivals, weddings and concerts.', group: 'events' },
  { key: 'custom', templateId: 'custom', title: 'Your own shape', blurb: 'Draw any stage outline on an empty floor.', group: 'scratch' },
];

const GROUPS: { id: Kind['group']; label: string }[] = [
  { id: 'theatre', label: 'Theatres' },
  { id: 'events', label: 'Events and outdoor' },
  { id: 'scratch', label: 'Start from scratch' },
];

/** The ready-made sizes of a kind: its standard size, then the stage type's presets. */
function sizesOf(k: Kind): { name: string; note: string; params: Params }[] {
  const t = getTemplate(k.templateId)!;
  const base = { ...defaultParams(t), ...k.params };
  if (k.templateId === 'custom') return [{ name: 'Empty floor', note: '', params: base }];
  return [{ name: 'Standard', note: t.description, params: base }, ...(t.presets ?? []).map((p) => ({ name: p.name, note: p.description ?? '', params: { ...base, ...p.params, ...k.params } }))];
}

function sizeOf(t: StageTemplate, params: Params) {
  const d = t.dimensions;
  const w = d?.width ? Number(params[d.width]) : NaN;
  const dep = d?.depth ? Number(params[d.depth]) : NaN;
  return Number.isFinite(w) && Number.isFinite(dep) ? { w, d: dep } : null;
}

/** Seating "rows" settings that can go to zero (so seating can be switched off). */
const rowDefs = (t: StageTemplate) => t.params.filter((p): p is NumberParam => p.type === 'number' && /^rows/i.test(p.key) && (p.min ?? 0) === 0);

/** The kind a project's stage belongs to (a framed stage with a balcony is the balcony kind). */
const kindOf = (templateId: string, params: Params) => KINDS.find((k) => k.templateId === templateId && (templateId !== 'proscenium' || !!params.balcony === !!k.params?.balcony)) ?? KINDS[0];

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
  const [kind, setKind] = useState<Kind>(KINDS[0]);
  const [sizeIdx, setSizeIdx] = useState<number | null>(0);
  const [name, setName] = useState('Untitled stage');
  const [params, setParams] = useState<Params>({});

  const pickKind = (k: Kind, size = 0) => {
    setKind(k);
    setSizeIdx(size);
    setParams(sizesOf(k)[size].params);
  };

  useEffect(() => {
    if (!open) return;
    setName('Untitled stage');
    const st = useProjectStore.getState();
    const pick = useShell.getState().newProjectPick;
    const fromPick = pick ? KINDS.find((k) => k.key === pick) ?? KINDS.find((k) => k.templateId === pick.split(':')[0]) : null;
    if (fromPick) return pickKind(fromPick);
    if (changing) {
      const p = st.paramsByTemplate[st.templateId] ?? {};
      const k = kindOf(st.templateId, p);
      setKind(k);
      setSizeIdx(null);
      setParams({ ...defaultParams(getTemplate(st.templateId)!), ...p });
      return;
    }
    pickKind(KINDS[0]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;
  const t = getTemplate(kind.templateId)!;
  const sizes = sizesOf(kind);
  const create = (k: Kind = kind, p: Params = params) => {
    setOpen(false);
    if (changing) {
      const store = useProjectStore.getState();
      store.changeStage(k.templateId, p);
      store.selectStage(true);
      return;
    }
    createProject(k.templateId, p, name);
    useShell.getState().setHome(false);
  };

  const dimKeys = [t.dimensions?.width, t.dimensions?.depth, t.dimensions?.height].filter(Boolean) as string[];
  const main = dimKeys.map((k) => t.params.find((d) => d.key === k)).filter((d): d is ParamDef => !!d);
  const rows = rowDefs(t);
  const seatingOn = rows.some((r) => Number(params[r.key]) > 0);
  const hasBalcony = t.params.some((d) => d.key === 'balcony');
  const rest = t.params.filter((d) => !dimKeys.includes(d.key) && !rows.includes(d as NumberParam) && d.key !== 'balcony' && d.key !== 'balconyRows' && (!d.visible || d.visible(params)) && /Seating|Audience|Size|Stage|Arch|Thrust|Platform|Runway/i.test(d.group));
  const size = sizeOf(t, params);
  /** A change by hand: the size is now the user's own. */
  const setParam = (k: string, v: ParamValue) => {
    setParams((p) => ({ ...p, [k]: v }));
    if (dimKeys.includes(k)) setSizeIdx(null);
  };
  const balconyRows = t.params.find((d) => d.key === 'balconyRows') as NumberParam | undefined;

  return (
    <div className="modal-backdrop np__backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="np np2" role="dialog" aria-modal="true" aria-label={changing ? 'Change the stage' : 'New project'}>
        <div className="np2__pick">
          <div className="np2__head">
            <h2 className="np2__title">{changing ? 'Change the stage' : 'What kind of stage?'}</h2>
            <p className="np2__lead">{changing ? 'Pick a new stage. Your set, lights and performers stay.' : 'Pick the closest one. You can change its size next, and anything else later.'}</p>
          </div>
          {GROUPS.map((g) => (
            <section key={g.id} className="np2__group">
              <h3 className="np2__group-title">{g.label}</h3>
              <div className="np2__grid">
                {KINDS.filter((k) => k.group === g.id).map((k) => (
                  <button key={k.key} className={`np2__card ${kind.key === k.key ? 'is-active' : ''} ${k.templateId === 'custom' ? 'is-dashed' : ''}`} onClick={() => pickKind(k)} onDoubleClick={() => create(k, sizesOf(k)[0].params)} data-tip-anchor="preset-card">
                    <span className="np2__pic">{images[k.key] ? <img src={images[k.key]} alt="" /> : k.templateId === 'custom' ? <span className="np__nopic">✎</span> : <span className="card__loading" />}</span>
                    <span className="np2__name">{k.title}</span>
                    <span className="np2__blurb">{k.blurb}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="np2__details" aria-label="Details">
          <div className="np2__preview">{images[kind.key] ? <img src={images[kind.key]} alt="" /> : <span className="card__loading" />}</div>
          <div className="np2__heading">
            <b>{kind.title}</b>
            <span className="hint">{size ? `${formatLength(size.w, units)} × ${formatLength(size.d, units)} stage` : kind.blurb}</span>
          </div>
          {changing ? (
            <p className="panel-msg panel-msg--warning">Set pieces, lights and performers stay where they are. Some may end up off the new stage.</p>
          ) : (
            <label className="field">
              <span className="field__label">Project name</span>
              <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} />
            </label>
          )}
          {sizes.length > 1 && (
            <div className="np2__sizes" role="radiogroup" aria-label="Size">
              <span className="field__label">Size</span>
              {sizes.map((z, i) => {
                const zs = sizeOf(t, z.params);
                return (
                  <button
                    key={z.name}
                    role="radio"
                    aria-checked={sizeIdx === i}
                    className={`np2__size ${sizeIdx === i ? 'is-active' : ''}`}
                    onClick={() => {
                      setSizeIdx(i);
                      // Keep the balcony switch as it is when changing size.
                      setParams(hasBalcony ? { ...z.params, balcony: params.balcony ?? z.params.balcony, balconyRows: params.balconyRows ?? z.params.balconyRows } : z.params);
                    }}
                    title={z.note}
                  >
                    <b>{z.name}</b>
                    {zs && (
                      <small>
                        {formatLength(zs.w, units)} × {formatLength(zs.d, units)}
                      </small>
                    )}
                  </button>
                );
              })}
              {sizeIdx === null && <p className="hint np2__own">Your own size</p>}
            </div>
          )}
          {hasBalcony && (
            <>
              <label className="field field--inline">
                <span className="field__label">Seating on two floors (balcony)</span>
                <button type="button" role="switch" aria-checked={!!params.balcony} className={`switch ${params.balcony ? 'is-on' : ''}`} onClick={() => setParams((p) => ({ ...p, balcony: !p.balcony }))}>
                  <span className="switch__knob" />
                </button>
              </label>
              {params.balcony && balconyRows && <Field def={{ ...balconyRows, label: 'Balcony rows' }} value={params.balconyRows ?? balconyRows.default} units={units} onChange={(v) => setParams((p) => ({ ...p, balconyRows: v as ParamValue }))} />}
            </>
          )}
          {rows.length > 0 && (
            <>
              <label className="field field--inline">
                <span className="field__label">{hasBalcony ? 'Seating downstairs' : 'Seating'}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={seatingOn}
                  className={`switch ${seatingOn ? 'is-on' : ''}`}
                  onClick={() => setParams((p) => ({ ...p, ...Object.fromEntries(rows.map((r) => [r.key, seatingOn ? 0 : (sizes[sizeIdx ?? 0]?.params[r.key] as number) || r.default || 10])) }))}
                >
                  <span className="switch__knob" />
                </button>
              </label>
              {seatingOn && rows.map((r) => <Field key={r.key} def={r} value={params[r.key]} units={units} onChange={(v) => setParam(r.key, v as ParamValue)} />)}
            </>
          )}
          {(main.length > 0 || rest.length > 0) && (
            <MoreOptions id="new-project" title="Exact size and more">
              {main.map((d) => (
                <Field key={d.key} def={d} value={params[d.key]} units={units} onChange={(v) => setParam(d.key, v as ParamValue)} />
              ))}
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
              {changing ? 'Change the stage' : 'Create'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
