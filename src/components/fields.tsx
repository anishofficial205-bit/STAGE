import { useEffect, useState } from 'react';
import { displayStep, formatNumber, fromDisplay, toDisplay, type Units } from '../units';
import type { BooleanParam, NumberParam, ParamDef, SelectParam } from '../types';

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
