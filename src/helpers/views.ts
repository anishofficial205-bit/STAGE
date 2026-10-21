import type { Bounds, PresetView, Vec3 } from '../types';

export const CAMERA_FOV = 45;
export const EYE_HEIGHT = 1.15; // seated eye height above the seat floor

const centre = (b: Bounds): Vec3 => [
  (b.min[0] + b.max[0]) / 2,
  (b.min[1] + b.max[1]) / 2,
  (b.min[2] + b.max[2]) / 2,
];

/** Straight down over the whole scene. */
export function topView(b: Bounds, aspect = 1.6): PresetView {
  const [cx, , cz] = centre(b);
  const dx = b.max[0] - b.min[0];
  const dz = b.max[2] - b.min[2];
  const half = (Math.max(dz, dx / aspect) * 1.12) / 2;
  const h = half / Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180) + b.max[1];
  // Tiny Z offset keeps orbit controls stable when looking straight down.
  return { id: 'top', label: 'Top view', position: [cx, h, cz + 0.01], target: [cx, 0, cz] };
}

/** A three-quarter view from the front-right that frames everything. */
export function resetView(b: Bounds, aspect = 1.6): PresetView {
  const c = centre(b);
  const dx = b.max[0] - b.min[0];
  const dy = b.max[1] - b.min[1];
  const dz = b.max[2] - b.min[2];
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;
  // In a narrow viewport the horizontal field of view is what limits the fit.
  const halfFov = (CAMERA_FOV / 2) * (Math.PI / 180);
  const fitHalf = aspect < 1 ? Math.atan(Math.tan(halfFov) * aspect) : halfFov;
  const dist = (radius / Math.sin(fitHalf)) * 0.85;
  const dir = normalize([0.55, 0.6, 1]);
  const target: Vec3 = [c[0], Math.min(c[1], 1.5), c[2]];
  return {
    id: 'reset',
    label: 'Reset view',
    position: [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist],
    target,
  };
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
