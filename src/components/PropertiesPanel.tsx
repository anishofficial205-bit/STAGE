import { getTemplate } from '../templates/registry';
import { useActiveData, useActiveObjects, useActiveParams, useProjectStore } from '../store/useProjectStore';
import { Outliner } from './layers/Outliner';
import { DOMAIN_MODE, editIn, modeLabel, useForeign, type Pick } from './layers/selection';
import { can, isHidden, isLocked, remove, toggleHidden, toggleLocked } from './layers/ops';
import { getObjectType } from '../objects/registry';
import { FIXTURES } from '../lighting/types';
import { ObjectProperties } from './objects/ObjectProperties';
import { SurfacesSection } from './objects/FacesSection';
import { SightlineWarnings } from './sightlines/SightlineWarnings';
import { VenueProperties } from './venue/VenuePanels';
import { LightsProperties } from './lights/LightsPanels';
import { BlockingProperties } from './blocking/BlockingPanels';
import type { ParamDef, ParamValue } from '../types';
import { Field } from './fields';
import { MoreOptions } from './MoreOptions';
import { formatLength } from '../units';
import type { Units } from '../units';

const formatSize = (w: number, d: number, units: Units) => `${formatLength(w, units)} × ${formatLength(d, units)}`;

/** A tiny plan of the stage at a preset's proportions. */
function PresetPlan({ w, d }: { w: number; d: number }) {
  const ok = Number.isFinite(w) && Number.isFinite(d) && w > 0 && d > 0;
  const k = ok ? Math.min(64 / w, 26 / d) : 1;
  const W = ok ? w * k : 50;
  const D = ok ? d * k : 24;
  return (
    <svg className="preset-card__plan" viewBox="0 0 80 56" aria-hidden>
      <rect x={40 - W / 2} y={6} width={W} height={D} rx={1.5} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${40 - W / 2 - 4 + i * 2} ${D + 12 + i * 5} Q 40 ${D + 16 + i * 5} ${40 + W / 2 + 4 - i * 2} ${D + 12 + i * 5}`} />
      ))}
    </svg>
  );
}
import { lookup, plainText } from '../glossary/terms';
import { usePlacing } from '../objects/placing';
import { useShell } from './shell';
import { ExampleProjects, MyTemplates } from './ToolsPanel';

/**
 * Generated entirely from the active template's params schema — templates never
 * need to touch this file. Params are grouped by their `group` field in order.
 */
function TemplateProperties() {
  const templateId = useProjectStore((s) => s.templateId);
  const units = useProjectStore((s) => s.units);
  const setParam = useProjectStore((s) => s.setParam);
  const applyPreset = useProjectStore((s) => s.applyPreset);
  const resetToDefaults = useProjectStore((s) => s.resetToDefaults);
  const params = useActiveParams();
  const data = useActiveData();
  const template = getTemplate(templateId)!;
  const selectStage = useProjectStore((s) => s.selectStage);

  // Width, depth and height first; everything else under More options.
  const mainKeys = template.dimensions ? [template.dimensions.width, template.dimensions.depth, template.dimensions.height].filter(Boolean) : [];
  const main = mainKeys.map((k) => template.params.find((d) => d.key === k)).filter((d): d is ParamDef => !!d && (!d.visible || d.visible(params)));
  const groups: { name: string; defs: ParamDef[] }[] = [];
  for (const def of template.params) {
    if (def.visible && !def.visible(params)) continue;
    if (mainKeys.includes(def.key)) continue;
    let g = groups.find((x) => x.name === def.group);
    if (!g) groups.push((g = { name: def.group, defs: [] }));
    g.defs.push(def);
  }
  const messages = template.messages?.(params, data) ?? [];
  const Extra = template.Panel;

  return (
    <>
      <div className="panel-head">
        <h2 className="panel-title">
          Stage — {template.name}
        </h2>
        <button className="btn btn--small" onClick={() => selectStage(false)} title="Stop editing the stage">
          Done
        </button>
      </div>
      {lookup(template.name) && lookup(template.name)!.plain !== template.name && <p className="hint">{lookup(template.name)!.plain}</p>}
      <div className="stage-props__actions">
        <button className="btn btn--small" onClick={() => useShell.getState().setNewProject(true, true)}>
          Change stage type…
        </button>
        <button className="btn btn--link" onClick={resetToDefaults} title="Put every setting of this stage back to its default">
          Reset to defaults
        </button>
      </div>
      {template.presets && template.presets.length > 0 && (
        <section className="presets">
          <h3 className="group__title">Start from a size</h3>
          <div className="preset-cards">
            {template.presets.map((preset, i) => {
              const active = Object.entries(preset.params).every(([k, v]) => params[k] === v);
              const dims = template.dimensions;
              const w = dims?.width ? Number(preset.params[dims.width] ?? params[dims.width]) : NaN;
              const d = dims?.depth ? Number(preset.params[dims.depth] ?? params[dims.depth]) : NaN;
              return (
                <button key={preset.name} className={`preset-card ${active ? 'is-active' : ''}`} onClick={() => applyPreset(i)} title={preset.description}>
                  <PresetPlan w={w} d={d} />
                  <span className="preset-card__name">{preset.name}</span>
                  {Number.isFinite(w) && Number.isFinite(d) && <span className="preset-card__dims">{formatSize(w, d, units)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {messages.map((m, i) => (
        <p key={i} className={`panel-msg panel-msg--${m.kind}`}>
          {m.text}
        </p>
      ))}
      {Extra && <Extra />}
      {main.length > 0 && (
        <section className="group">
          <h3 className="group__title">Stage size</h3>
          {main.map((def) => (
            <Field key={def.key} def={def} value={params[def.key]} units={units} onChange={(v) => setParam(def.key, v as ParamValue)} />
          ))}
          <p className="hint">Tip: drag the round handles on the stage edges to resize it.</p>
        </section>
      )}
      <MoreOptions id={`stage:${template.id}`}>
        {groups.map((g) => (
          <section key={g.name} className="group">
            <h3 className="group__title">{g.name}</h3>
            {g.defs.map((def) => (
              <Field key={def.key} def={def} value={params[def.key]} units={units} onChange={(v) => setParam(def.key, v as ParamValue)} />
            ))}
          </section>
        ))}
      </MoreOptions>
      <MyTemplates />
      <ExampleProjects />
    </>
  );
}

/** Set mode with nothing selected: starter sets and the stage's own surfaces. */
function SetProperties() {
  const empty = useActiveObjects().length === 0;
  return (
    <>
      <div className="panel-head">
        <h2 className="panel-title">Set</h2>
      </div>
      {empty ? (
        <div className="empty-state">
          <p>Add your first piece of scenery, then click on the stage to place it.</p>
          <button className="btn btn--primary btn--big" onClick={() => usePlacing.getState().start('flat')}>
            + Add a wall panel
          </button>
        </div>
      ) : (
        <p className="sidebar__empty">Click a piece to edit it, or add pieces from the library on the left.</p>
      )}
      <SurfacesSection />
    </>
  );
}

/** The selection's properties, by mode (each mode's own panels): the left panel's Edit tab. */
export function ModeProperties() {
  const mode = useProjectStore((s) => s.mode);
  const hasSelection = useProjectStore((s) => s.selectedIds.length > 0);
  const stageSelected = useProjectStore((s) => s.stageSelected);
  const foreign = useForeign((s) => s.sel);
  if (foreign) return <ForeignProperties sel={foreign} />;
  if (mode === 'set' && stageSelected)
    return (
      <div className="props stage-props">
        <TemplateProperties />
      </div>
    );
  if (mode === 'venue') return <VenueProperties />;
  if (mode === 'lights') return <LightsProperties />;
  if (mode === 'blocking') return <BlockingProperties />;
  return (
    <>
      <SightlineWarnings />
      <div className="props">{hasSelection ? <ObjectProperties /> : <SetProperties />}</div>
    </>
  );
}

/** The right-hand panel, always there (Focus mode aside): the one Layers list. */
export function LayersSide() {
  return (
    <aside className="layers-side" aria-label="Layers" data-tour="layers">
      <Outliner />
    </aside>
  );
}

/** Something from another mode, picked in Layers: a short view with "Edit in [mode]". */
function ForeignProperties({ sel }: { sel: Pick }) {
  const s = useProjectStore();
  const target = DOMAIN_MODE[sel.domain];
  const items = sel.ids.map((id) => ({ domain: sel.domain, kind: sel.kind, id }));
  const first = items[0];
  const name = describe(s, sel);
  const caps = can(first);
  return (
    <div className="props foreign-props">
      <div className="panel-head">
        <h2 className="panel-title">{name.title}</h2>
      </div>
      <p className="hint">
        {name.type} · from {modeLabel(target)}
      </p>
      <div className="foreign-props__actions">
        <button className="btn btn--primary" onClick={() => editIn(sel)}>
          Edit in {modeLabel(target)}
        </button>
        {sel.domain === 'stage' ? (
          <button className="btn" onClick={() => useShell.getState().setNewProject(true, true)}>
            Change stage type…
          </button>
        ) : (
          <>
            {items.length === 1 && caps.hide && (
              <button className="btn" onClick={() => toggleHidden(first)}>
                {isHidden(first) ? 'Show' : 'Hide'}
              </button>
            )}
            {items.length === 1 && caps.lock && (
              <button className="btn" onClick={() => toggleLocked(first)}>
                {isLocked(first) ? 'Unlock' : 'Lock'}
              </button>
            )}
            <button
              className="btn btn--danger"
              onClick={() => {
                remove(items);
                useForeign.getState().set(null);
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Name and type of a picked item, in plain words. */
function describe(s: ReturnType<typeof useProjectStore.getState>, sel: Pick): { title: string; type: string } {
  const n = sel.ids.length;
  if (sel.domain === 'stage') return { title: `Stage — ${getTemplate(s.templateId)?.name ?? ''}`, type: 'Stage' };
  if (sel.domain === 'set') {
    const list = s.objectsByTemplate[s.templateId] ?? [];
    const o = list.find((x) => x.id === sel.ids[0]);
    return n > 1 ? { title: `${n} set pieces`, type: 'Set pieces' } : { title: o?.name ?? 'Set piece', type: plainText(getObjectType(o?.type ?? '')?.name ?? 'Set piece') };
  }
  if (sel.domain === 'lights') {
    const l = s.lightingByTemplate[s.templateId];
    if (sel.kind === 'position') return { title: plainText(l?.positions.find((p) => p.id === sel.ids[0])?.name ?? 'Light bar'), type: 'Hanging position' };
    const f = l?.fixtures.find((x) => x.id === sel.ids[0]);
    return n > 1 ? { title: `${n} lights`, type: 'Lights' } : { title: f?.name ?? 'Light', type: f ? FIXTURES[f.type].label : 'Light' };
  }
  if (sel.domain === 'performers') {
    const p = s.blockingByTemplate[s.templateId]?.performers.find((x) => x.id === sel.ids[0]);
    return n > 1 ? { title: `${n} performers`, type: 'Performers' } : { title: p?.name ?? 'Performer', type: 'Performer' };
  }
  const v = s.venue;
  const kind = sel.kind;
  const id = sel.ids[0];
  if (kind === 'room') {
    const r = v.rooms.find((x) => x.id === id);
    return { title: r?.name ?? 'Room', type: 'Room' };
  }
  if (kind === 'route') return { title: v.routes.find((x) => x.id === id)?.name ?? 'Route', type: 'Route' };
  if (kind === 'door') return { title: v.doors.find((x) => x.id === id)?.entrance ?? 'Door', type: 'Door' };
  if (kind === 'furniture') return { title: 'Furniture', type: 'Furniture' };
  return { title: kind, type: kind };
}
