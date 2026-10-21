/**
 * Truss frame — a goalpost (two legs and a header) or a box truss (four legs
 * and a rectangle of headers). Its headers are hang points for other pieces.
 */
import type { Params, Vec3 } from '../../types';
import { num, str } from '../../helpers/params';
import { Truss } from '../../helpers/primitives';
import { COLORS } from '../../helpers/materials';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';

const S = 0.4;
const isBox = (p: Params) => str(p, 'frameType') === 'box';

/** Header lines (local) at the top of the frame. */
function headers(p: Params): [Vec3, Vec3][] {
  const [w, h, d] = [num(p, 'width'), num(p, 'height'), num(p, 'depth')];
  const y = h;
  if (!isBox(p)) return [[[-w / 2, y, 0], [w / 2, y, 0]]];
  return [
    [[-w / 2, y, -d / 2], [w / 2, y, -d / 2]],
    [[-w / 2, y, d / 2], [w / 2, y, d / 2]],
    [[-w / 2, y, -d / 2], [-w / 2, y, d / 2]],
    [[w / 2, y, -d / 2], [w / 2, y, d / 2]],
  ];
}

export const trussFrameObject: SetObjectType = {
  id: 'truss-frame',
  name: 'Truss frame',
  category: 'Rigging & Screens',
  icon: (
    <Icon>
      <path d="M4 21V5h16v16M4 5l3 3M20 5l-3 3" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    {
      key: 'frameType',
      label: 'Frame',
      group: 'Size',
      type: 'select',
      default: 'goalpost',
      options: [
        { value: 'goalpost', label: 'Goalpost' },
        { value: 'box', label: 'Box truss' },
      ],
    },
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 6, min: 1, max: 40, step: 0.5 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 5, min: 1, max: 20, step: 0.5 },
    { key: 'depth', label: 'Depth', group: 'Size', type: 'number', default: 3, min: 1, max: 30, step: 0.5, visible: isBox },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width') + S, depth: isBox(p) ? num(p, 'depth') + S : S, height: num(p, 'height') + S / 2 }),
  resize: (p) => (isBox(p) ? { width: { key: 'width', scale: 1 }, depth: 'depth' } : { width: 'width' }),
  hangLines: headers,
  build: (p) => {
    const [w, h, d] = [num(p, 'width'), num(p, 'height'), num(p, 'depth')];
    const legs: [number, number][] = isBox(p) ? [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] : [[-w / 2, 0], [w / 2, 0]];
    return (
      <>
        {legs.map(([x, z], i) => (
          <group key={i}>
            <Truss from={[x, 0, z]} to={[x, h - S / 2, z]} size={S} color={COLORS.truss} />
            <Cube at={[x, 0.01, z]} size={[0.6, 0.02, 0.6]} color={SET.dark} />
          </group>
        ))}
        {headers(p).map(([a, b], i) => (
          <Truss key={i} from={[a[0] - (a[0] === b[0] ? 0 : S / 2), a[1] - S / 2, a[2] - (a[2] === b[2] ? 0 : S / 2)]} to={[b[0] + (a[0] === b[0] ? 0 : S / 2), b[1] - S / 2, b[2] + (a[2] === b[2] ? 0 : S / 2)]} size={S} color={COLORS.truss} />
        ))}
      </>
    );
  },
  faces: () => [],
};
