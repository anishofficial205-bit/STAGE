/**
 * Pleated fabric. A curtain panel is a grid bent into a sine wave across its
 * width so it reads as cloth. Fullness is the theatre meaning: 100% fullness is
 * twice as much cloth as the width it covers. When a panel is drawn aside the
 * same cloth is squeezed into less width, so its folds get deeper (stacking).
 *
 * UVs run across the whole flat cloth (not the bent shape), so a printed graphic
 * follows the folds the way a real printed drape does.
 */
import * as THREE from 'three';

export interface PanelShape {
  /** Left edge of the panel (local x) and the width it covers now. */
  x0: number;
  span: number;
  /** Width it covers when fully closed (sets the number of pleats). */
  closedSpan: number;
  height: number;
  /** 0 = flat, 1 = deep pleats (100% fullness). */
  fullness: number;
  /** Part of the whole curtain's cloth this panel is, for UVs (e.g. [0, 0.5] for the left half). */
  u: [number, number];
  /** Bottom edge height across the panel (t = 0..1 across), for swags and Austrian lifts. */
  bottom?: (t: number) => number;
  /** Horizontal gathering (ruching) where the cloth is pulled up: 0..1 at t. */
  ruche?: (t: number) => number;
  /** Flat, unpleated cloth (cycs, scrims) */
  smooth?: boolean;
}

/** Span of cloth per pleat when closed (m): fuller cloth folds tighter. */
const pleatSpacing = (fullness: number) => 0.46 - 0.16 * fullness;

/** Fold depth (m) for a given squeeze of the cloth. */
export function foldDepth(shape: Pick<PanelShape, 'span' | 'closedSpan' | 'fullness' | 'smooth'>) {
  if (shape.smooth) return 0;
  const waves = pleatCount(shape);
  const cloth = shape.closedSpan * (1 + shape.fullness);
  const c = Math.min(1, shape.span / cloth);
  const wave = shape.span / waves;
  return Math.min(0.32, 0.3 * wave * Math.sqrt(Math.max(0, 1 / (c * c) - 1)));
}

const pleatCount = (s: Pick<PanelShape, 'closedSpan' | 'fullness'>) => Math.max(2, Math.round(s.closedSpan / pleatSpacing(s.fullness)));

export function panelGeometry(s: PanelShape): THREE.BufferGeometry {
  const waves = s.smooth ? 1 : pleatCount(s);
  const depth = foldDepth(s);
  const nx = s.smooth ? 2 : Math.min(900, waves * 10);
  const shaped = !!(s.bottom || s.ruche);
  const ny = shaped ? 36 : 6;
  const pos = new Float32Array((nx + 1) * (ny + 1) * 3);
  const uv = new Float32Array((nx + 1) * (ny + 1) * 2);
  const idx: number[] = [];
  const rows = Math.max(4, Math.round(s.height / 0.32));
  let k = 0;
  for (let j = 0; j <= ny; j++) {
    const v = j / ny; // along the cloth, bottom (0) to top (1)
    for (let i = 0; i <= nx; i++) {
      const t = i / nx;
      const bottom = Math.min(s.height - 0.05, s.bottom?.(t) ?? 0);
      // Folds open out a little towards the hem, as hanging cloth does.
      const flare = 0.82 + 0.3 * (1 - v);
      const theta = 2 * Math.PI * waves * t;
      let z = depth * flare * (Math.sin(theta) + 0.12 * Math.sin(2 * theta));
      const r = s.ruche?.(t) ?? 0;
      if (r > 0) z += r * 0.07 * Math.sin(2 * Math.PI * rows * v) * Math.min(1, v * 6);
      pos[k * 3] = s.x0 + t * s.span;
      pos[k * 3 + 1] = bottom + v * (s.height - bottom);
      pos[k * 3 + 2] = z;
      uv[k * 2] = s.u[0] + t * (s.u[1] - s.u[0]);
      uv[k * 2 + 1] = v;
      k++;
    }
  }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + nx + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Scalloped hem: swags hang lowest between the lift cords. 0 at a cord, 1 mid-swag. */
export const scallop = (t: number, swags: number) => Math.sin(Math.PI * ((t * swags) % 1));
