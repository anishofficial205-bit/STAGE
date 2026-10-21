/** Arch frame — a freestanding arch: a solid frame with a shaped opening. */
import type { Params } from '../../types';
import { num, str } from '../../helpers/params';
import type { Pt } from '../../helpers/shapes';
import { Extruded, Icon, SET } from '../common';
import type { SetObjectType } from '../types';
import { archOpening, openingPerimeter, type ArchTop } from '../archShapes';

const opening = (p: Params) => archOpening(str(p, 'topShape') as ArchTop, num(p, 'openingWidth'), num(p, 'openingHeight'));

export const archFrameObject: SetObjectType = {
  id: 'arch-frame',
  name: 'Arch frame',
  category: 'Architecture',
  icon: (
    <Icon>
      <path d="M4 21V3h16v18M8 21v-9a4 4 0 0 1 8 0v9" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'outerWidth', label: 'Outer width', group: 'Size', type: 'number', default: 3, min: 0.5, max: 20, step: 0.05 },
    { key: 'outerHeight', label: 'Outer height', group: 'Size', type: 'number', default: 3.5, min: 0.5, max: 20, step: 0.05 },
    { key: 'openingWidth', label: 'Opening width', group: 'Opening', type: 'number', default: 2, min: 0.2, max: 19, step: 0.05 },
    { key: 'openingHeight', label: 'Opening height', group: 'Opening', type: 'number', default: 2.8, min: 0.2, max: 19, step: 0.05 },
    { key: 'thickness', label: 'Thickness', group: 'Size', type: 'number', default: 0.3, min: 0.03, max: 3, step: 0.01 },
    {
      key: 'topShape',
      label: 'Top shape',
      group: 'Opening',
      type: 'select',
      default: 'rounded',
      options: [
        { value: 'rounded', label: 'Rounded' },
        { value: 'pointed', label: 'Pointed' },
        { value: 'flat', label: 'Flat' },
        { value: 'multifoil', label: 'Mughal multi-foil' },
      ],
    },
  ],
  constraints: (p) => ({
    ...p,
    openingWidth: Math.min(num(p, 'openingWidth'), num(p, 'outerWidth') - 0.2),
    openingHeight: Math.min(num(p, 'openingHeight'), num(p, 'outerHeight') - 0.1),
  }),
  size: (p) => ({ width: num(p, 'outerWidth'), depth: num(p, 'thickness'), height: num(p, 'outerHeight') }),
  resize: { width: 'outerWidth', depth: 'thickness' },
  build: (p) => {
    const [W, H] = [num(p, 'outerWidth'), num(p, 'outerHeight')];
    // The opening touches the floor, so it is traced into the outline rather than cut as a hole.
    const outline: Pt[] = [[-W / 2, 0], [-W / 2, H], [W / 2, H], [W / 2, 0], ...[...opening(p)].reverse()];
    return <Extruded outline={outline} depth={num(p, 'thickness')} color={SET.face} />;
  },
  faces: (p) => [
    { id: 'front', name: 'Front', width: num(p, 'outerWidth'), height: num(p, 'outerHeight') },
    { id: 'back', name: 'Back', width: num(p, 'outerWidth'), height: num(p, 'outerHeight') },
    { id: 'inner', name: 'Inner (opening edge)', width: openingPerimeter(opening(p)), height: num(p, 'thickness') },
  ],
};
