/**
 * Block — the test shape for the object system: a plain box.
 */
import type { Params } from '../../types';
import { num } from '../../helpers/params';
import { COLORS, ROUGHNESS } from '../../helpers/materials';
import type { SetObjectType } from '../types';

export const blockObject: SetObjectType = {
  id: 'block',
  name: 'Block',
  category: 'Basic',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </svg>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1, min: 0.1, max: 20, step: 0.05 },
    { key: 'depth', label: 'Depth', group: 'Size', type: 'number', default: 1, min: 0.1, max: 20, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 1, min: 0.05, max: 20, step: 0.05 },
  ],
  constraints: (p) => p,
  size: (p: Params) => ({ width: num(p, 'width'), depth: num(p, 'depth'), height: num(p, 'height') }),
  resize: { width: 'width', depth: 'depth', height: 'height' },
  build: (p) => (
    <mesh position-y={num(p, 'height') / 2} castShadow receiveShadow>
      <boxGeometry args={[num(p, 'width'), num(p, 'height'), num(p, 'depth')]} />
      <meshStandardMaterial color={COLORS.stageEdge} roughness={ROUGHNESS} />
    </mesh>
  ),
  faces: (p) => {
    const [w, d, h] = [num(p, 'width'), num(p, 'depth'), num(p, 'height')];
    return [
      { id: 'front', name: 'Front', width: w, height: h },
      { id: 'back', name: 'Back', width: w, height: h },
      { id: 'left', name: 'Left', width: d, height: h },
      { id: 'right', name: 'Right', width: d, height: h },
      { id: 'top', name: 'Top', width: w, height: d },
    ];
  },
};
