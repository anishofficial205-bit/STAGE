/**
 * Floor decal — a graphic laid on the floor at a chosen size and position
 * (logos, dance-floor marks, centre medallions) rather than covering the
 * whole floor. Its top reads upright from the audience (+Z).
 */
import { num } from '../../helpers/params';
import { Icon } from '../common';
import { FaceMat } from '../faceMaterial';
import type { SetObjectType } from '../types';

import { FLOOR_DECAL } from '../ui';

export const floorDecalObject: SetObjectType = {
  id: FLOOR_DECAL,
  name: 'Floor decal',
  category: 'Basic',
  icon: (
    <Icon>
      <path d="M2 16l10-5 10 5-10 5z" />
      <path d="M9 15.5l3-1.5 3 1.5-3 1.5z" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 2, min: 0.1, max: 40, step: 0.05 },
    { key: 'depth', label: 'Depth', group: 'Size', type: 'number', default: 2, min: 0.1, max: 40, step: 0.05 },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'depth'), height: 0.01 }),
  resize: { width: 'width', depth: 'depth' },
  build: (p) => (
    // Sits just above any floor colour or graphic on the stage surface beneath it.
    <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow>
      <planeGeometry args={[num(p, 'width'), num(p, 'depth')]} />
      <FaceMat face="graphic" color="#f1eee7" opacity={0.9} />
    </mesh>
  ),
  faces: (p) => [{ id: 'graphic', name: 'Graphic', width: num(p, 'width'), height: num(p, 'depth') }],
};
