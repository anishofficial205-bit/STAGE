import { useEffect, useState } from 'react';
import { getTemplate } from '../templates/registry';
import { useActiveParams, useProjectStore } from '../store/useProjectStore';
import { displayStep, formatNumber, fromDisplay, toDisplay, type Units } from '../units';
import type { BooleanParam, NumberParam, ParamDef, ParamValue, SelectParam } from '../types';

/**
 * Generated entirely from the active template's params schema — templates never
 * need to touch this file. Params are grouped by their `group` field in order.
 */
export function PropertiesPanel() {
  const templateId = useProjectStore((s) => s.templateId);
  const units = useProjectStore((s) => s.units);
  const setParam = useProjectStore((s) => s.setParam);
  const params = useActiveParams();
  const template = getTemplate(templateId)!;

  const groups: { name: string; defs: ParamDef[] }[] = [];
  for (const def of template.params) {
    if (def.visible && !def.visible(params)) continue;
    let g = groups.find((x) => x.name === def.group);
    if (!g) groups.push((g = { name: def.group, defs: [] }));
    g.defs.push(def);
  }
  const messages = template.messages?.(params) ?? [];

  return (
    <aside className="sidebar sidebar--right">
      <h2 className="panel-title">{template.name}</h2>
      {messages.map((m, i) => (
        <p key={i} className={`panel-msg panel-msg--${m.kind}`}>
          {m.text}
        </p>
      ))}
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

interface FieldProps<D extends ParamDef, V> {
  def: D;
  value: V;
  units: Units;
  onChange: (v: V) => void;
}

function Field(props: FieldProps<ParamDef, unknown>) {
  const { def } = props;
  const label = (
    <span className="field__label">
      {def.label}
      {def.help && (
        <span className="field__help" title={def.help} aria-label={def.help}>
          ?
        </span>
      )}
    </span>
  );
  if (def.type === 'number') return <NumberField {...(props as FieldProps<NumberParam, number>)} label={label} />;
  if (def.type === 'boolean') return <BooleanField {...(props as FieldProps<BooleanParam, boolean>)} label={label} />;
  return <SelectField {...(props as FieldProps<SelectParam, string>)} label={label} />;
}

type WithLabel = { label: React.ReactNode };

function NumberField({ def, value, units, onChange, label }: FieldProps<NumberParam, number> & WithLabel) {
  const isLength = def.unit !== 'none';
  const show = (m: number) => (isLength ? formatNumber(m, units) : String(parseFloat(m.toFixed(2))));
  const toUser = (m: number) => (isLength ? toDisplay(m, units) : m);
  const fromUser = (v: number) => (isLength ? fromDisplay(v, units) : v);
  const step = isLength ? displayStep(def.step, units) : def.step;

  // The text box keeps its own draft so typing "1." doesn't get reformatted mid-keystroke.
  const [draft, setDraft] = useState(show(value));
  useEffect(() => setDraft(show(value)), [value, units]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const v = parseFloat(draft);
    if (Number.isFinite(v)) onChange(fromUser(v));
    else setDraft(show(value));
  };

  return (
    <label className="field">
      {label}
      <div className="field__row">
        <input
          type="range"
          className="field__slider"
          min={toUser(def.min)}
          max={toUser(def.max)}
          step={step}
          value={toUser(value)}
          onChange={(e) => onChange(fromUser(parseFloat(e.target.value)))}
        />
        <div className="field__number">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(fromUser(toUser(value) + (e.key === 'ArrowUp' ? step : -step)));
              }
            }}
          />
          {isLength && <span className="field__unit">{units}</span>}
        </div>
      </div>
    </label>
  );
}

function BooleanField({ def, value, onChange, label }: FieldProps<BooleanParam, boolean> & WithLabel) {
  return (
    <label className="field field--inline">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={def.label}
        className={`switch ${value ? 'is-on' : ''}`}
        onClick={() => onChange(!value)}
      >
        <span className="switch__knob" />
      </button>
    </label>
  );
}

function SelectField({ def, value, onChange, label }: FieldProps<SelectParam, string> & WithLabel) {
  return (
    <label className="field">
      {label}
      <select className="field__select" value={value} onChange={(e) => onChange(e.target.value)}>
        {def.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
