/** Hanging panel — a rigid flat panel flown on wires at a set height. */
import { num } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';

export const hangingPanelObject: SetObjectType = {
  id: 'hanging-panel',
  name: 'Hanging panel',
  category: 'Rigging & Screens',
  icon: (
    <Icon>
      <path d="M7 2v6M17 2v6" />
      <rect x="3" y="8" width="18" height="9" />
    </Icon>
  ),
  placement: 'hanging',
  elevationParam: 'hangHeight',
  hangGap: 0.6,
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 2.4, min: 0.2, max: 20, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 1.2, min: 0.1, max: 12, step: 0.05 },
    { key: 'thickness', label: 'Thickness', group: 'Size', type: 'number', default: 0.05, min: 0.01, max: 0.5, step: 0.01 },
    { key: 'hangHeight', label: 'Hang height (bottom)', group: 'Size', type: 'number', default: 3, min: 0, max: 30, step: 0.05 },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'thickness'), height: num(p, 'height') }),
  resize: { width: 'width', depth: 'thickness' },
  build: (p) => <Cube at={[0, num(p, 'height') / 2, 0]} size={[num(p, 'width'), num(p, 'height'), num(p, 'thickness')]} color={SET.face} faces={{ pz: 'front', nz: 'back' }} />,
  faces: (p) => [
    { id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') },
    { id: 'back', name: 'Back', width: num(p, 'width'), height: num(p, 'height') },
  ],
};
