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
    <aside className="sidebar sidebar--right">
      <h2 className="panel-title">{template.name}</h2>
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
