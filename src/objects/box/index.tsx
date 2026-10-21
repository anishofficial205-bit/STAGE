/** Box — a plain block for quick massing (the old test "Block"). */
import { num } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';

export const boxObject: SetObjectType = {
  id: 'box',
  name: 'Box',
  category: 'Basic',
  icon: (
    <Icon>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1, min: 0.05, max: 30, step: 0.05 },
    { key: 'depth', label: 'Depth', group: 'Size', type: 'number', default: 1, min: 0.05, max: 30, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 1, min: 0.05, max: 20, step: 0.05 },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'depth'), height: num(p, 'height') }),
  resize: { width: 'width', depth: 'depth' },
  build: (p) => <Cube at={[0, num(p, 'height') / 2, 0]} size={[num(p, 'width'), num(p, 'height'), num(p, 'depth')]} color={SET.body} />,
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
