/**
 * Steps — a flight that rises towards its back (-Z). The top tread is level
 * with the total height, so steps snapped against a platform lead straight
 * onto it (snapping also matches the platform's height).
 */
import { num } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';

export const stepsObject: SetObjectType = {
  id: 'steps',
  name: 'Steps',
  category: 'Steps & ramps',
  icon: (
    <Icon>
      <path d="M3 20h5v-5h5v-5h5V5h3" />
      <path d="M3 20h18V5" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1.2, min: 0.3, max: 12, step: 0.05 },
    { key: 'steps', label: 'Number of steps', group: 'Size', type: 'number', unit: 'none', default: 3, min: 1, max: 30, step: 1 },
    { key: 'totalHeight', label: 'Total height', group: 'Size', type: 'number', default: 0.6, min: 0.05, max: 6, step: 0.05, help: 'Snapping steps against a platform matches its height.' },
    { key: 'stepDepth', label: 'Step depth', group: 'Size', type: 'number', default: 0.3, min: 0.15, max: 1, step: 0.01 },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'steps') * num(p, 'stepDepth'), height: num(p, 'totalHeight') }),
  resize: (p) => ({ width: 'width', depth: { key: 'stepDepth', scale: 1 / num(p, 'steps') } }),
  climbs: { heightParam: 'totalHeight' },
  build: (p) => {
    const [w, n, H, sd] = [num(p, 'width'), num(p, 'steps'), num(p, 'totalHeight'), num(p, 'stepDepth')];
    const D = n * sd;
    return (
      <>
        {Array.from({ length: n }, (_, i) => {
          const h = (H * (i + 1)) / n;
          return <Cube key={i} at={[0, h / 2, D / 2 - (i + 0.5) * sd]} size={[w, h, sd + 0.002]} color={i % 2 ? SET.body : '#d4d0c7'} faces={{ py: 'treads', pz: 'risers', nx: 'sides', px: 'sides' }} />;
        })}
      </>
    );
  },
  faces: (p) => {
    const [w, n, H, sd] = [num(p, 'width'), num(p, 'steps'), num(p, 'totalHeight'), num(p, 'stepDepth')];
    return [
      { id: 'treads', name: 'Treads (tops)', width: w, height: n * sd },
      { id: 'risers', name: 'Risers (fronts)', width: w, height: H },
      { id: 'sides', name: 'Sides', width: n * sd, height: H },
    ];
  },
};
