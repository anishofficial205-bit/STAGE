/**
 * Window frame — a frame with panes of glass, set at sill height. Placed
 * against a wall it snaps flat to it.
 */
import type { Params } from '../../types';
import { num } from '../../helpers/params';
import { Cube, Icon, Mat, SET } from '../common';
import type { SetObjectType } from '../types';

const MEMBER = 0.06;
const DEPTH = 0.1;

/** Pane grid: up to 3 across per row, then a second row. */
function grid(p: Params) {
  const n = num(p, 'panes');
  const cols = n <= 3 ? n : Math.ceil(n / 2);
  const rows = n <= 3 ? 1 : 2;
  return { cols, rows };
}

export const windowFrameObject: SetObjectType = {
  id: 'window-frame',
  name: 'Window frame',
  category: 'Architecture',
  icon: (
    <Icon>
      <rect x="5" y="4" width="14" height="14" />
      <path d="M12 4v14M5 11h14M4 18h16" />
    </Icon>
  ),
  placement: 'wall',
  elevationParam: 'sillHeight',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1.2, min: 0.3, max: 8, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 1.2, min: 0.3, max: 8, step: 0.05 },
    { key: 'sillHeight', label: 'Sill height', group: 'Size', type: 'number', default: 0.9, min: 0, max: 10, step: 0.05 },
    { key: 'panes', label: 'Number of panes', group: 'Panes', type: 'number', unit: 'none', default: 4, min: 1, max: 12, step: 1 },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: DEPTH, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => {
    const [w, h] = [num(p, 'width'), num(p, 'height')];
    const { cols, rows } = grid(p);
    const bars = [];
    for (let i = 0; i <= cols; i++) bars.push(<Cube key={`v${i}`} at={[-w / 2 + (w * i) / cols, h / 2, 0]} size={[MEMBER, h, DEPTH]} color={SET.edge} face="frame-front" />);
    for (let j = 0; j <= rows; j++) bars.push(<Cube key={`h${j}`} at={[0, (h * j) / rows, 0]} size={[w + MEMBER, MEMBER, DEPTH]} color={SET.edge} face="frame-front" />);
    return (
      <>
        {bars}
        <mesh position-y={h / 2}>
          <boxGeometry args={[w, h, 0.01]} />
          <Mat color="#cfe3f2" opacity={0.28} />
        </mesh>
        {/* Sill */}
        <Cube at={[0, -0.03, 0.04]} size={[w + 0.12, 0.05, DEPTH + 0.08]} color={SET.edge} />
      </>
    );
  },
  faces: (p) => [{ id: 'frame-front', name: 'Frame front', width: num(p, 'width'), height: num(p, 'height') }],
};
