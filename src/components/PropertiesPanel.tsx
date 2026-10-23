import { getTemplate } from '../templates/registry';
import { useActiveData, useActiveObjects, useActiveParams, useProjectStore } from '../store/useProjectStore';
import { Collapsible } from './Collapsible';
import { LayersPanel } from './objects/LayersPanel';
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
import { Plain } from '../glossary/Plain';

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
          <Plain text={template.name} />
        </h2>
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
    </>
  );
}

/** Set mode with nothing selected: starter sets and the stage's own surfaces. */
function SetProperties() {
  return (
    <>
      <div className="panel-head">
        <h2 className="panel-title">Set</h2>
      </div>
      <p className="sidebar__empty">Click a piece to edit it, or add pieces from the library on the left.</p>
      <SurfacesSection />
    </>
  );
}

/**
 * Right-hand side, by mode. Stage: the template's dimensions. Set: the layers list,
 * then properties of the selection (or starter sets and stage surfaces when nothing is selected).
 */
export function PropertiesPanel() {
  const mode = useProjectStore((s) => s.mode);
  const hasSelection = useProjectStore((s) => s.selectedIds.length > 0);
  const count = useActiveObjects().length;
  if (mode === 'stage')
    return (
      <aside className="sidebar sidebar--right" data-tour="panel">
        <div className="props">
          <TemplateProperties />
        </div>
      </aside>
    );
  if (mode === 'venue')
    return (
      <aside className="sidebar sidebar--right" data-tour="panel">
        <VenueProperties />
      </aside>
    );
  if (mode === 'lights')
    return (
      <aside className="sidebar sidebar--right" data-tour="panel">
        <LightsProperties />
      </aside>
    );
  if (mode === 'blocking')
    return (
      <aside className="sidebar sidebar--right" data-tour="panel">
        <BlockingProperties />
      </aside>
    );
  if (mode !== 'set') return <aside className="sidebar sidebar--right" data-tour="panel" />;
  return (
    <aside className="sidebar sidebar--right" data-tour="panel">
      <Collapsible id="layers" title={`Layers${count ? ` (${count})` : ''}`}>
        <LayersPanel />
      </Collapsible>
      <SightlineWarnings />
      <div className="props">{hasSelection ? <ObjectProperties /> : <SetProperties />}</div>
    </aside>
  );
}
