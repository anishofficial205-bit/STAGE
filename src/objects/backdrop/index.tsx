/**
 * Backdrop / drop — a thin cloth hanging from a batten. It hangs from rigging
 * when there is some overhead; its bottom gap is its height above the floor.
 */
import { num } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';

export const backdropObject: SetObjectType = {
  id: 'backdrop',
  name: 'Backdrop',
  category: 'Walls & flats',
  icon: (
    <Icon>
      <path d="M3 4h18M5 4v15c2 1 4-1 7 0s5 1 7 0V4" />
    </Icon>
  ),
  placement: 'hanging',
  elevationParam: 'bottomGap',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 8, min: 0.5, max: 40, step: 0.1 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 5, min: 0.5, max: 20, step: 0.1 },
    { key: 'bottomGap', label: 'Bottom gap from floor', group: 'Size', type: 'number', default: 0, min: 0, max: 20, step: 0.05 },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.1, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => {
    const [w, h] = [num(p, 'width'), num(p, 'height')];
    return (
      <>
        <Cube at={[0, h / 2, 0]} size={[w, h, 0.02]} color={SET.cloth} />
        {/* Batten pipe along the top */}
        <mesh position={[0, h, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.024, 0.024, w + 0.2, 10]} />
          <meshStandardMaterial color={SET.metal} roughness={0.4} metalness={0.6} />
        </mesh>
      </>
    );
  },
  faces: (p) => [
    { id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') },
    { id: 'back', name: 'Back', width: num(p, 'width'), height: num(p, 'height') },
  ],
};
