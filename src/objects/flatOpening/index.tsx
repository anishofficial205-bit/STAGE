/**
 * Flat with opening — a flat with a door, window or arch cut into it.
 * A door opening runs down to the floor; windows and arches sit at an offset
 * above it.
 */
import type { Params } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { archOutline } from '../../helpers/primitives';
import type { Pt } from '../../helpers/shapes';
import { Extruded, Icon, SET } from '../common';
import type { SetObjectType } from '../types';
import { Braces } from '../flat/brace';
import { braceReach } from '../flat';

/** Outline of the opening (from bottom-left, round the top, to bottom-right). */
function opening(p: Params): Pt[] {
  const ow = num(p, 'openingWidth');
  const oh = num(p, 'openingHeight');
  const y0 = str(p, 'openingType') === 'door' ? 0 : num(p, 'openingOffset');
  const rise = str(p, 'openingType') === 'arch' ? Math.min(ow / 2, oh * 0.6) : 0;
  return archOutline(ow / 2, y0, y0 + oh, rise);
}

export const flatOpeningObject: SetObjectType = {
  id: 'flat-opening',
  name: 'Flat with opening',
  category: 'Walls & flats',
  icon: (
    <Icon>
      <rect x="5" y="3" width="14" height="18" rx="0.5" />
      <path d="M9.5 21v-8a2.5 2.5 0 0 1 5 0v8" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1.8, min: 0.6, max: 12, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 2.4, min: 0.6, max: 12, step: 0.05 },
    { key: 'thickness', label: 'Thickness', group: 'Size', type: 'number', default: 0.08, min: 0.02, max: 0.5, step: 0.01 },
    {
      key: 'openingType',
      label: 'Opening',
      group: 'Opening',
      type: 'select',
      default: 'door',
      options: [
        { value: 'door', label: 'Door' },
        { value: 'window', label: 'Window' },
        { value: 'arch', label: 'Arch' },
      ],
    },
    { key: 'openingWidth', label: 'Opening width', group: 'Opening', type: 'number', default: 0.9, min: 0.2, max: 11, step: 0.05 },
    { key: 'openingHeight', label: 'Opening height', group: 'Opening', type: 'number', default: 2, min: 0.2, max: 11, step: 0.05 },
    { key: 'openingOffset', label: 'Offset from bottom', group: 'Opening', type: 'number', default: 0.9, min: 0.05, max: 10, step: 0.05, visible: (p) => str(p, 'openingType') !== 'door' },
    { key: 'brace', label: 'Support brace at back', group: 'Build', type: 'boolean', default: true },
  ],
  constraints: (p) => {
    const out = { ...p };
    const w = num(out, 'width');
    const h = num(out, 'height');
    // Keep at least 10 cm of flat round the opening.
    out.openingWidth = Math.min(num(out, 'openingWidth'), w - 0.2);
    out.openingOffset = Math.min(num(out, 'openingOffset'), Math.max(0.05, h - 0.3));
    const bottom = str(out, 'openingType') === 'door' ? 0 : num(out, 'openingOffset');
    out.openingHeight = Math.max(0.2, Math.min(num(out, 'openingHeight'), h - 0.1 - bottom));
    return out;
  },
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'thickness') + braceReach(p), height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => {
    const [w, h, t] = [num(p, 'width'), num(p, 'height'), num(p, 'thickness')];
    const reach = braceReach(p);
    const front = (t + reach) / 2;
    const hole = opening(p);
    const door = str(p, 'openingType') === 'door';
    // A door opening touches the bottom edge, so trace it into the outline instead of cutting a hole.
    const outline: Pt[] = door ? [[-w / 2, 0], [-w / 2, h], [w / 2, h], [w / 2, 0], ...[...hole].reverse()] : [[-w / 2, 0], [-w / 2, h], [w / 2, h], [w / 2, 0]];
    return (
      <>
        <Extruded outline={outline} holes={door ? [] : [hole]} depth={t} z={front - t / 2} color={SET.face} faces={{ front: 'front', back: 'back' }} />
        {bool(p, 'brace') && <Braces width={w} height={h} back={front - t} reach={reach - 0.05} />}
      </>
    );
  },
  faces: (p) => [
    { id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') },
    { id: 'back', name: 'Back', width: num(p, 'width'), height: num(p, 'height') },
  ],
};
