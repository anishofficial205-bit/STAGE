// Everything is stored in metres; conversion only happens at display time.
export type Units = 'm' | 'ft';

export const M_PER_FT = 0.3048;

export const toDisplay = (metres: number, units: Units) =>
  units === 'ft' ? metres / M_PER_FT : metres;

export const fromDisplay = (value: number, units: Units) =>
  units === 'ft' ? value * M_PER_FT : value;

/** Number only, in the current unit: feet with one decimal, metres up to two. */
export function formatNumber(metres: number, units: Units): string {
  if (units === 'ft') return (metres / M_PER_FT).toFixed(1);
  return String(parseFloat(metres.toFixed(2)));
}

export function formatLength(metres: number, units: Units): string {
  return `${formatNumber(metres, units)} ${units}`;
}

/** Slider step in display units, so feet sliders move in tidy increments. */
export function displayStep(stepMetres: number, units: Units): number {
  if (units === 'm') return stepMetres;
  return Math.max(0.1, Math.round((stepMetres / M_PER_FT) * 10) / 10);
}
