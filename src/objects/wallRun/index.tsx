/**
 * Wall run — several flats joined in a line. Each joint bends by the same
 * angle, so 3 panels at 90° make a box set (back wall plus two side walls),
 * open towards the audience.
 */
import type { Params } from '../../types';
import { num } from '../../helpers/params';
import type { Pt } from '../../helpers/shapes';
import { Icon, Mat, SET } from '../common';
import type { SetObjectType } from '../types';

/** Panel joint points, oriented so the run is centred and bends away from the audience (towards -Z). */
export function wallRunPoints(p: Params): Pt[] {
  const n = num(p, 'panels');
  const pw = num(p, 'panelWidth');
  const turn = (num(p, 'angle') * Math.PI) / 180;
  const pts: Pt[] = [[0, 0]];
  let a = 0;
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[pts.length - 1];
    pts.push([x + pw * Math.cos(a), z - pw * Math.sin(a)]);
    a += turn;
  }
  // Make the chord from first to last point run along +X.
  const [fx, fz] = pts[0];
  const [lx, lz] = pts[pts.length - 1];
  const chord = Math.atan2(-(lz - fz), lx - fx);
  // Rotate every point about the origin to undo the chord's angle (no-op for a closed loop).
  let out: Pt[] = Math.hypot(lx - fx, lz - fz) > 1e-6 ? pts.map(([x, z]) => [x * Math.cos(chord) - z * Math.sin(chord), x * Math.sin(chord) + z * Math.cos(chord)] as Pt) : pts;
  // Bulge goes towards -Z (away from the audience).
  const meanZ = out.reduce((s, q) => s + q[1], 0) / out.length;
  if (meanZ > out[0][1] + 1e-6) out = out.map(([x, z]) => [x, -z] as Pt);
  // Centre the footprint on the origin.
  const xs = out.map((q) => q[0]);
  const zs = out.map((q) => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return out.map(([x, z]) => [x - cx, z - cz] as Pt);
}

export const wallRunObject: SetObjectType = {
  id: 'wall-run',
  name: 'Wall run',
  category: 'Walls & flats',
  icon: (
    <Icon>
      <path d="M3 18V8l6-3v10zM9 15V5l6 3v10zM15 18V8l6-3v10z" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'panels', label: 'Number of panels', group: 'Panels', type: 'number', unit: 'none', default: 3, min: 1, max: 12, step: 1 },
    { key: 'panelWidth', label: 'Panel width', group: 'Panels', type: 'number', default: 1.2, min: 0.3, max: 6, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Panels', type: 'number', default: 2.4, min: 0.3, max: 12, step: 0.05 },
    { key: 'angle', label: 'Angle between panels (°)', group: 'Panels', type: 'number', unit: 'none', default: 0, min: 0, max: 90, step: 5, help: '0 = straight line, 90 = square corners (3 panels make a box set).' },
    { key: 'thickness', label: 'Thickness', group: 'Panels', type: 'number', default: 0.08, min: 0.02, max: 0.5, step: 0.01 },
  ],
  constraints: (p) => p,
  size: (p) => {
    const pts = wallRunPoints(p);
    const xs = pts.map((q) => q[0]);
    const zs = pts.map((q) => q[1]);
    const t = num(p, 'thickness');
    return { width: Math.max(...xs) - Math.min(...xs) + t, depth: Math.max(...zs) - Math.min(...zs) + t, height: num(p, 'height') };
  },
  build: (p) => {
    const pts = wallRunPoints(p);
    const h = num(p, 'height');
    const t = num(p, 'thickness');
    return (
      <>
        {pts.slice(1).map(([x1, z1], i) => {
          const [x0, z0] = pts[i];
          const len = Math.hypot(x1 - x0, z1 - z0);
          return (
            <mesh key={i} position={[(x0 + x1) / 2, h / 2, (z0 + z1) / 2]} rotation-y={Math.atan2(-(z1 - z0), x1 - x0)} castShadow receiveShadow>
              {/* Slightly longer than the panel so corners close up. */}
              <boxGeometry args={[len + t * 0.9, h, t]} />
              <Mat color={i % 2 ? SET.face : '#e3e0d8'} />
            </mesh>
          );
        })}
      </>
    );
  },
  faces: (p) =>
    Array.from({ length: num(p, 'panels') }, (_, i) => [
      { id: `panel-${i + 1}-front`, name: `Panel ${i + 1} front`, width: num(p, 'panelWidth'), height: num(p, 'height') },
      { id: `panel-${i + 1}-back`, name: `Panel ${i + 1} back`, width: num(p, 'panelWidth'), height: num(p, 'height') },
    ]).flat(),
};
