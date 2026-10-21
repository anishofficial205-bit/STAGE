/** Door frame — two jambs and a header, with an optional door panel that can stand open. */
import type { Params } from '../../types';
import { bool, num } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import type { SetObjectType } from '../types';

const DEPTH = 0.15;
const PANEL = 0.045;

const clear = (p: Params) => num(p, 'width') - 2 * num(p, 'frameThickness');

export const doorFrameObject: SetObjectType = {
  id: 'door-frame',
  name: 'Door frame',
  category: 'Architecture',
  icon: (
    <Icon>
      <path d="M5 21V3h14v18" />
      <path d="M8 21V6l6 2v13" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width (outside)', group: 'Size', type: 'number', default: 1.1, min: 0.4, max: 6, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 2.2, min: 0.6, max: 8, step: 0.05 },
    { key: 'frameThickness', label: 'Frame thickness', group: 'Size', type: 'number', default: 0.1, min: 0.02, max: 0.6, step: 0.01 },
    { key: 'doorPanel', label: 'Door panel', group: 'Door', type: 'boolean', default: true },
    { key: 'doorAngle', label: 'Door open (°)', group: 'Door', type: 'number', unit: 'none', default: 30, min: 0, max: 120, step: 5, visible: (p) => bool(p, 'doorPanel') },
  ],
  constraints: (p) => ({ ...p, frameThickness: Math.min(num(p, 'frameThickness'), num(p, 'width') / 2 - 0.1) }),
  size: (p) => ({ width: num(p, 'width'), depth: DEPTH, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => {
    const [w, h, ft] = [num(p, 'width'), num(p, 'height'), num(p, 'frameThickness')];
    const cw = clear(p);
    const angle = (num(p, 'doorAngle') * Math.PI) / 180;
    return (
      <>
        <Cube at={[-w / 2 + ft / 2, h / 2, 0]} size={[ft, h, DEPTH]} color={SET.edge} face="frame-front" />
        <Cube at={[w / 2 - ft / 2, h / 2, 0]} size={[ft, h, DEPTH]} color={SET.edge} face="frame-front" />
        <Cube at={[0, h - ft / 2, 0]} size={[w, ft, DEPTH]} color={SET.edge} face="frame-front" />
        {bool(p, 'doorPanel') && (
          // Hinged on the left jamb; opens away from the audience.
          <group position={[-w / 2 + ft, 0, 0]} rotation-y={angle}>
            <Cube at={[cw / 2, (h - ft) / 2, 0]} size={[cw - 0.01, h - ft - 0.01, PANEL]} color={SET.face} faces={{ pz: 'door-front', nz: 'door-back' }} />
            <Cube at={[cw - 0.09, (h - ft) * 0.47, PANEL / 2 + 0.02]} size={[0.03, 0.12, 0.04]} color={SET.metal} />
          </group>
        )}
      </>
    );
  },
  faces: (p) => {
    const [w, h, ft] = [num(p, 'width'), num(p, 'height'), num(p, 'frameThickness')];
    return [
      { id: 'frame-front', name: 'Frame front', width: w, height: h },
      { id: 'door-front', name: 'Door front', width: clear(p), height: h - ft },
      { id: 'door-back', name: 'Door back', width: clear(p), height: h - ft },
    ];
  },
};
