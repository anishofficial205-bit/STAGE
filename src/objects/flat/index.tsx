/**
 * Flat — a thin standing scenery panel, optionally braced at the back.
 * The footprint (including braces) is centred on the origin; the front face
 * looks towards +Z.
 */
import type { Params } from '../../types';
import { bool, num } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';
import { Braces } from './brace';

export const braceReach = (p: Params) => (bool(p, 'brace') ? num(p, 'height') * 0.35 + 0.1 : 0);

export const flatObject: SetObjectType = {
  id: 'flat',
  name: 'Flat',
  category: 'Walls & flats',
  icon: (
    <Icon>
      <rect x="6" y="3" width="12" height="18" rx="0.5" />
      <path d="M9 21l3-6" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1.2, min: 0.2, max: 12, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 2.4, min: 0.3, max: 12, step: 0.05 },
    { key: 'thickness', label: 'Thickness', group: 'Size', type: 'number', default: 0.08, min: 0.02, max: 0.5, step: 0.01 },
    { key: 'brace', label: 'Support brace at back', group: 'Build', type: 'boolean', default: true },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'thickness') + braceReach(p), height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => {
    const [w, h, t] = [num(p, 'width'), num(p, 'height'), num(p, 'thickness')];
    const reach = braceReach(p);
    const front = (t + reach) / 2; // z of the front face
    return (
      <>
        <Cube at={[0, h / 2, front - t / 2]} size={[w, h, t]} color={SET.face} />
        {reach > 0 && <Braces width={w} height={h} back={front - t} reach={reach - 0.05} />}
      </>
    );
  },
  faces: (p) => [
    { id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') },
    { id: 'back', name: 'Back', width: num(p, 'width'), height: num(p, 'height') },
  ],
};
