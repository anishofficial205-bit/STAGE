/** Projection screen — a matte white surface, standing on legs or hung, in a common aspect ratio. */
import type { Params } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';

const STAND = 0.9; // bottom of a standing screen above the floor
const BORDER = 0.08;
const hanging = (p: Params) => str(p, 'mount') === 'hanging';

function screenHeight(p: Params) {
  const w = num(p, 'width');
  const a = str(p, 'aspect');
  return a === '16:9' ? (w * 9) / 16 : a === '4:3' ? (w * 3) / 4 : num(p, 'customHeight');
}

export const projectionScreenObject: SetObjectType = {
  id: 'projection-screen',
  name: 'Projection screen',
  category: 'Rigging & Screens',
  icon: (
    <Icon>
      <rect x="3" y="3" width="18" height="11" />
      <path d="M12 14v7M8 21l4-3 4 3" />
    </Icon>
  ),
  placement: (p) => (hanging(p) ? 'hanging' : 'floor'),
  hangGap: 0.3,
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 4, min: 0.5, max: 30, step: 0.1 },
    {
      key: 'aspect',
      label: 'Aspect ratio',
      group: 'Size',
      type: 'select',
      default: '16:9',
      options: [
        { value: '16:9', label: '16:9 (widescreen)' },
        { value: '4:3', label: '4:3' },
        { value: 'custom', label: 'Custom' },
      ],
    },
    { key: 'customHeight', label: 'Height', group: 'Size', type: 'number', default: 2.5, min: 0.3, max: 20, step: 0.1, visible: (p) => str(p, 'aspect') === 'custom' },
    { key: 'frame', label: 'Frame', group: 'Build', type: 'boolean', default: true },
    {
      key: 'mount',
      label: 'Mounting',
      group: 'Build',
      type: 'select',
      default: 'standing',
      options: [
        { value: 'standing', label: 'Standing on legs' },
        { value: 'hanging', label: 'Hanging' },
      ],
    },
  ],
  constraints: (p) => p,
  size: (p) => {
    const b = bool(p, 'frame') ? 2 * BORDER : 0;
    return { width: num(p, 'width') + b, depth: hanging(p) ? 0.1 : 0.8, height: screenHeight(p) + b + (hanging(p) ? 0 : STAND) };
  },
  resize: { width: 'width' },
  build: (p) => {
    const w = num(p, 'width');
    const h = screenHeight(p);
    const b = bool(p, 'frame') ? BORDER : 0;
    const y0 = (hanging(p) ? 0 : STAND) + b;
    return (
      <>
        {b > 0 && <Cube at={[0, y0 + h / 2, -0.01]} size={[w + 2 * b, h + 2 * b, 0.04]} color="#202327" />}
        <Cube at={[0, y0 + h / 2, 0.015]} size={[w, h, 0.01]} color="#f4f4f1" />
        {!hanging(p) &&
          [-1, 1].map((s) => (
            <group key={s}>
              <Cube at={[s * (w / 2 + b + 0.03), (y0 + h) / 2, -0.03]} size={[0.04, y0 + h, 0.04]} color={SET.metal} />
              <Cube at={[s * (w / 2 + b + 0.03), 0.02, -0.03]} size={[0.06, 0.04, 0.8]} color={SET.metal} />
            </group>
          ))}
      </>
    );
  },
  faces: (p) => [{ id: 'screen', name: 'Screen', width: num(p, 'width'), height: screenHeight(p) }],
};
