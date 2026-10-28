/**
 * A prop made from photos (one of My props). The piece keeps which prop it is
 * and its size; the shape and pictures come from My props.
 */
import { num, str } from '../../helpers/params';
import { Icon } from '../common';
import type { SetObjectType } from '../types';
import { PhotoPropModel } from '../../photoProps/Model';

export const PHOTO_PROP = 'photo-prop';

export const photoPropObject: SetObjectType = {
  id: PHOTO_PROP,
  name: 'My prop',
  category: 'My props',
  library: false,
  icon: (
    <Icon>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M4 16l5-5 4 4 2-2 5 5" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'source', label: 'Prop', group: 'Prop', type: 'select', default: '', options: [], free: true, visible: () => false },
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1, min: 0.05, max: 30, step: 0.01 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 1, min: 0.05, max: 20, step: 0.01 },
    { key: 'depth', label: 'Depth', group: 'Size', type: 'number', default: 0.4, min: 0.01, max: 30, step: 0.01 },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'depth'), height: num(p, 'height') }),
  resize: { width: 'width', depth: 'depth' },
  build: (p) => <PhotoPropModel id={str(p, 'source')} width={num(p, 'width')} height={num(p, 'height')} depth={num(p, 'depth')} />,
  faces: () => [],
};
