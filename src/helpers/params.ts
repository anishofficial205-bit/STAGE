import type { NumberParam, ParamDef, Params } from '../types';

/** Anything described by a params schema: stage templates and set objects. */
interface Schema {
  params: ParamDef[];
  constraints: (params: Params) => Params;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Typed getters so template code stays readable: num(p, 'width'). */
export const num = (p: Params, key: string) => Number(p[key]);
export const bool = (p: Params, key: string) => Boolean(p[key]);
export const str = (p: Params, key: string) => String(p[key]);

const isInteger = (d: NumberParam) => d.unit === 'none' && Number.isInteger(d.step);

export function defaultParams(template: Schema): Params {
  return Object.fromEntries(template.params.map((d) => [d.key, d.default]));
}

/**
 * Fill missing values with defaults, coerce types and clamp numbers to their
 * min/max. Then run the template's own constraints. Used on every edit and on
 * load/import, so stored data from older versions is always made valid.
 */
export function applyConstraints(template: Schema, input: Params): Params {
  const out: Params = {};
  for (const d of template.params) {
    const raw = input[d.key];
    if (d.type === 'number') {
      let v = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
      if (!Number.isFinite(v)) v = d.default;
      v = clamp(v, d.min, d.max);
      out[d.key] = isInteger(d) ? Math.round(v) : v;
    } else if (d.type === 'boolean') {
      out[d.key] = typeof raw === 'boolean' ? raw : d.default;
    } else if (d.type === 'color') {
      out[d.key] = typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : d.default;
    } else {
      out[d.key] = d.options.some((o) => o.value === raw) ? (raw as string) : d.default;
    }
  }
  return template.constraints(out);
}
