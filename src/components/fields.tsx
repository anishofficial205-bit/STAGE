import { useEffect, useState } from 'react';
import { displayStep, formatNumber, fromDisplay, toDisplay, type Units } from '../units';
import type { BooleanParam, ColorParam, NumberParam, ParamDef, SelectParam } from '../types';
import { Plain } from '../glossary/Plain';

/**
 * Form controls generated from a param definition. Used by the properties
 * panel, and by templates that add their own panel controls (e.g. block editing).
 */
export interface FieldProps<D extends ParamDef, V> {
  def: D;
  value: V;
  units: Units;
  onChange: (v: V) => void;
}

export function Field(props: FieldProps<ParamDef, unknown>) {
  const { def } = props;
  const label = (
    <span className="field__label">
      <Plain text={def.label} />
      {def.help && (
        <span className="field__help" title={def.help} aria-label={def.help}>
          ?
        </span>
      )}
    </span>
  );
  if (def.type === 'number') return <NumberField {...(props as FieldProps<NumberParam, number>)} label={label} />;
  if (def.type === 'boolean') return <BooleanField {...(props as FieldProps<BooleanParam, boolean>)} label={label} />;
  if (def.type === 'color') return <ColorField {...(props as FieldProps<ColorParam, string>)} label={label} />;
  if ((def as SelectParam).text) return <TextField {...(props as FieldProps<SelectParam, string>)} label={label} />;
  return <SelectField {...(props as FieldProps<SelectParam, string>)} label={label} />;
}

/** Words to type (e.g. a neon sign's text). */
function TextField({ value, onChange, label }: FieldProps<SelectParam, string> & WithLabel) {
  return (
    <label className="field">
      {label}
      <input className="field__input" value={value ?? ''} maxLength={40} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
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

function ColorField({ def, value, onChange, label }: FieldProps<ColorParam, string> & WithLabel) {
  return (
    <div className="field">
      {label}
      <div className="color-field">
        {def.presets?.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`swatch ${p.value === value ? 'is-active' : ''}`}
            style={{ background: p.value }}
            title={p.label}
            aria-label={p.label}
            aria-pressed={p.value === value}
            onClick={() => onChange(p.value)}
          />
        ))}
        <input type="color" className="color-field__picker" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${def.label} (custom)`} title="Custom colour" />
      </div>
    </div>
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
