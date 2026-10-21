/**
 * Platform — a stage deck (standard 1.2 × 2.4 m), on legs or with solid sides.
 * Steps and ramps snap against its edges.
 */
import type { Params } from '../../types';
import { num, str } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';

export const platformHeight = (p: Params) => (str(p, 'heightPreset') === 'custom' ? num(p, 'customHeight') : Number(str(p, 'heightPreset')));

const DECK = 0.05;
const SIDES = { py: 'top', pz: 'front', nz: 'back', nx: 'left', px: 'right' };
const LEG = 0.08;

export const platformObject: SetObjectType = {
  id: 'platform',
  name: 'Platform',
  category: 'Platforms',
  icon: (
    <Icon>
      <path d="M3 9l9-4 9 4-9 4z" />
      <path d="M3 9v4l9 4 9-4V9M12 13v4" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 2.4, min: 0.3, max: 20, step: 0.05 },
    { key: 'depth', label: 'Depth', group: 'Size', type: 'number', default: 1.2, min: 0.3, max: 20, step: 0.05 },
    {
      key: 'heightPreset',
      label: 'Height',
      group: 'Size',
      type: 'select',
      default: '0.4',
      options: [
        { value: '0.2', label: '0.2 m (8 in)' },
        { value: '0.4', label: '0.4 m (16 in)' },
        { value: '0.6', label: '0.6 m (24 in)' },
        { value: '0.8', label: '0.8 m (32 in)' },
        { value: 'custom', label: 'Custom' },
      ],
    },
    { key: 'customHeight', label: 'Custom height', group: 'Size', type: 'number', default: 0.5, min: 0.05, max: 5, step: 0.05, visible: (p) => str(p, 'heightPreset') === 'custom' },
    {
      key: 'construction',
      label: 'Construction',
      group: 'Build',
      type: 'select',
      default: 'solid',
      options: [
        { value: 'solid', label: 'Solid sides' },
        { value: 'legs', label: 'On legs' },
      ],
    },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'depth'), height: platformHeight(p) }),
  resize: { width: 'width', depth: 'depth' },
  platformTop: platformHeight,
  build: (p) => {
    const [w, d, h] = [num(p, 'width'), num(p, 'depth'), platformHeight(p)];
    if (str(p, 'construction') !== 'legs') return <Cube at={[0, h / 2, 0]} size={[w, h, d]} color={SET.body} faces={SIDES} />;
    // Legs at the corners, plus intermediate legs every ≤ 1.2 m along each side.
    const nx = Math.max(1, Math.ceil(w / 1.2));
    const nz = Math.max(1, Math.ceil(d / 1.2));
    const legs: [number, number][] = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) if (i === 0 || i === nx || j === 0 || j === nz) legs.push([-w / 2 + LEG / 2 + ((w - LEG) * i) / nx, -d / 2 + LEG / 2 + ((d - LEG) * j) / nz]);
    return (
      <>
        <Cube at={[0, h - DECK / 2, 0]} size={[w, DECK, d]} color={SET.body} faces={SIDES} />
        {legs.map(([x, z], i) => (
          <Cube key={i} at={[x, (h - DECK) / 2, z]} size={[LEG, h - DECK, LEG]} color={SET.edge} />
        ))}
      </>
    );
  },
  faces: (p) => {
    const [w, d, h] = [num(p, 'width'), num(p, 'depth'), platformHeight(p)];
    return [
      { id: 'top', name: 'Top', width: w, height: d },
      { id: 'front', name: 'Front', width: w, height: h },
      { id: 'back', name: 'Back', width: w, height: h },
      { id: 'left', name: 'Left', width: d, height: h },
      { id: 'right', name: 'Right', width: d, height: h },
    ];
  },
};
