/**
 * Truss segment — a straight lattice truss along the object's width. It can
 * stand on the floor or hang; either way other pieces can hang from its top chord.
 */
import type { Params } from '../../types';
import { num, str } from '../../helpers/params';
import { trussGeometry } from '../../helpers/primitives';
import { COLORS } from '../../helpers/materials';
import { Icon } from '../common';
import type { SetObjectType } from '../types';

const size = (p: Params) => Number(str(p, 'size'));

export function TrussRun({ length, size: s, profile = 'square', y }: { length: number; size: number; profile?: 'square' | 'triangle'; y: number }) {
  return (
    <mesh geometry={trussGeometry(length, s, profile)} position={[-length / 2, y, 0]} rotation-y={Math.PI / 2} castShadow>
      <meshStandardMaterial color={COLORS.truss} roughness={0.45} metalness={0.6} />
    </mesh>
  );
}

export const trussObject: SetObjectType = {
  id: 'truss',
  name: 'Truss segment',
  category: 'Rigging & Screens',
  icon: (
    <Icon>
      <path d="M2 9h20M2 15h20M2 9l4 6 4-6 4 6 4-6 4 6" />
    </Icon>
  ),
  placement: (p) => (str(p, 'mount') === 'hanging' ? 'hanging' : 'floor'),
  hangGap: 0.6,
  defaultElevation: 0,
  params: [
    { key: 'length', label: 'Length', group: 'Size', type: 'number', default: 3, min: 0.5, max: 30, step: 0.5 },
    {
      key: 'profile',
      label: 'Profile',
      group: 'Size',
      type: 'select',
      default: 'square',
      options: [
        { value: 'square', label: 'Square (box)' },
        { value: 'triangle', label: 'Triangle' },
      ],
    },
    {
      key: 'size',
      label: 'Truss size',
      group: 'Size',
      type: 'select',
      default: '0.4',
      options: [
        { value: '0.3', label: '0.3 m (12 in)' },
        { value: '0.4', label: '0.4 m (16 in)' },
      ],
    },
    {
      key: 'mount',
      label: 'Mounting',
      group: 'Build',
      type: 'select',
      default: 'floor',
      options: [
        { value: 'floor', label: 'On the floor' },
        { value: 'hanging', label: 'Hanging' },
      ],
    },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'length'), depth: size(p), height: size(p) }),
  resize: { width: 'length' },
  hangLines: (p) => [[[-num(p, 'length') / 2, size(p), 0], [num(p, 'length') / 2, size(p), 0]]],
  build: (p) => <TrussRun length={num(p, 'length')} size={size(p)} profile={str(p, 'profile') as 'square' | 'triangle'} y={size(p) / 2} />,
  faces: () => [],
};
