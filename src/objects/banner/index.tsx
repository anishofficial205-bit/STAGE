/** Banner — thin fabric hung from a pole pocket, printed on one or both sides. */
import { bool, num } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';

export const bannerObject: SetObjectType = {
  id: 'banner',
  name: 'Banner',
  category: 'Rigging & Screens',
  icon: (
    <Icon>
      <path d="M6 3h12M7 3v16l5-3 5 3V3" />
    </Icon>
  ),
  placement: 'hanging',
  hangGap: 0.1,
  defaultElevation: 3,
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1, min: 0.2, max: 30, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 3, min: 0.2, max: 20, step: 0.05 },
    { key: 'doubleSided', label: 'Double-sided', group: 'Build', type: 'boolean', default: false },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.06, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => {
    const [w, h] = [num(p, 'width'), num(p, 'height')];
    return (
      <>
        <Cube at={[0, h / 2, 0]} size={[w, h, 0.008]} color={SET.cloth} />
        {[0.02, h - 0.02].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.02, 0.02, w + 0.04, 8]} />
            <meshStandardMaterial color={SET.metal} roughness={0.4} metalness={0.5} />
          </mesh>
        ))}
      </>
    );
  },
  faces: (p) => [
    { id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') },
    ...(bool(p, 'doubleSided') ? [{ id: 'back', name: 'Back', width: num(p, 'width'), height: num(p, 'height') }] : []),
  ],
};
