import type { Environment } from '../types';
import { COLORS } from './materials';

/** The neutral "architectural model" look used unless a template overrides it. */
export const DEFAULT_ENVIRONMENT: Environment = {
  background: COLORS.background,
  fog: COLORS.background,
  ground: COLORS.ground,
  grid: { cell: '#c9ccd1', section: '#b3b8bf' },
  hemisphere: { sky: '#ffffff', ground: '#d5d8dc', intensity: 0.9 },
  ambient: 0.25,
  sun: { color: '#ffffff', intensity: 1.6, direction: [0.6, 1.4, 0.8] },
};
