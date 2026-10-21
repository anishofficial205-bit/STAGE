import { getTemplate } from '../templates/registry';
import { useActiveData, useActiveParams, useProjectStore } from '../store/useProjectStore';
import type { ParamDef, ParamValue } from '../types';
import { Field } from './fields';

/**
 * Generated entirely from the active template's params schema — templates never
 * need to touch this file. Params are grouped by their `group` field in order.
 */
export function PropertiesPanel() {
  const templateId = useProjectStore((s) => s.templateId);
  const units = useProjectStore((s) => s.units);
  const setParam = useProjectStore((s) => s.setParam);
  const applyPreset = useProjectStore((s) => s.applyPreset);
  const resetToDefaults = useProjectStore((s) => s.resetToDefaults);
  const params = useActiveParams();
  const data = useActiveData();
  const template = getTemplate(templateId)!;

  const groups: { name: string; defs: ParamDef[] }[] = [];
  for (const def of template.params) {
    if (def.visible && !def.visible(params)) continue;
    let g = groups.find((x) => x.name === def.group);
    if (!g) groups.push((g = { name: def.group, defs: [] }));
    g.defs.push(def);
  }
  const messages = template.messages?.(params, data) ?? [];
  const Extra = template.Panel;

  return (
    <aside className="sidebar sidebar--right" data-tour="panel">
      <div className="panel-head">
        <h2 className="panel-title">{template.name}</h2>
        <button className="btn btn--link" onClick={resetToDefaults} title="Put every setting of this stage back to its default">
          Reset to defaults
        </button>
      </div>
      {template.presets && template.presets.length > 0 && (
        <section className="presets">
          <h3 className="group__title">Size presets</h3>
          <div className="chips">
            {template.presets.map((preset, i) => {
              const active = Object.entries(preset.params).every(([k, v]) => params[k] === v);
              return (
                <button key={preset.name} className={`chip ${active ? 'is-active' : ''}`} onClick={() => applyPreset(i)} title={preset.description}>
                  {preset.name}
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
      {groups.map((g) => (
        <section key={g.name} className="group">
          <h3 className="group__title">{g.name}</h3>
          {g.defs.map((def) => (
            <Field key={def.key} def={def} value={params[def.key]} units={units} onChange={(v) => setParam(def.key, v as ParamValue)} />
          ))}
        </section>
      ))}
    </aside>
  );
}
