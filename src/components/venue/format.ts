import type { Units } from '../../units';

const FT2_PER_M2 = 10.7639;

/** "24.5 m²" or "264 ft²". */
export const formatArea = (m2: number, units: Units) => (units === 'ft' ? `${Math.round(m2 * FT2_PER_M2)} ft²` : `${m2 < 100 ? m2.toFixed(1) : Math.round(m2)} m²`);
