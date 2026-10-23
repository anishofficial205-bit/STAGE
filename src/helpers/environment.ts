import type { Environment } from '../types';

/** The "architectural model" look used unless a template overrides it: a dark, warm studio so the model reads clearly under the floating panels. */
export const DEFAULT_ENVIRONMENT: Environment = {
  background: '#17110e',
  fog: '#17110e',
  ground: '#241b16',
  grid: { cell: '#30251f', section: '#3d2f27' },
  hemisphere: { sky: '#ffffff', ground: '#d5d8dc', intensity: 0.9 },
  ambient: 0.25,
  sun: { color: '#ffffff', intensity: 1.6, direction: [0.6, 1.4, 0.8] },
};
