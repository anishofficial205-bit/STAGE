/** Column — round or square, with an optional base and capital. */
import type { Params } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { Cube, Icon, Mat, SET } from '../common';
import type { SetObjectType } from '../types';

const BAND = 0.14; // height of base / capital
const flare = (p: Params) => (bool(p, 'baseCapital') ? 1.4 : 1);

export const columnObject: SetObjectType = {
  id: 'column',
  name: 'Column',
  category: 'Architecture',
  icon: (
    <Icon>
      <path d="M7 4h10M8 6h8M9 6v12M15 6v12M8 18h8M7 20h10" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    {
      key: 'shape',
      label: 'Shape',
      group: 'Size',
      type: 'select',
      default: 'round',
      options: [
        { value: 'round', label: 'Round' },
        { value: 'square', label: 'Square' },
      ],
    },
    { key: 'diameter', label: 'Diameter / width', group: 'Size', type: 'number', default: 0.4, min: 0.05, max: 4, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 3, min: 0.3, max: 20, step: 0.05 },
    { key: 'baseCapital', label: 'Base and capital', group: 'Build', type: 'boolean', default: true },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'diameter') * flare(p), depth: num(p, 'diameter') * flare(p), height: num(p, 'height') }),
  resize: (p) => ({ width: { key: 'diameter', scale: 1 / flare(p) }, depth: { key: 'diameter', scale: 1 / flare(p) } }),
  build: (p) => {
    const [d, h] = [num(p, 'diameter'), num(p, 'height')];
    const round = str(p, 'shape') === 'round';
    const bands = bool(p, 'baseCapital');
    const shaftH = bands ? h - 2 * BAND : h;
    const y0 = bands ? BAND : 0;
    const band = (y: number) =>
      round ? (
        <mesh position-y={y} castShadow receiveShadow>
          <cylinderGeometry args={[d * 0.7, d * 0.7, BAND, 48]} />
          <Mat color={SET.edge} face={y > BAND ? 'top' : 'base'} />
        </mesh>
      ) : (
        <Cube at={[0, y, 0]} size={[d * 1.4, BAND, d * 1.4]} color={SET.edge} face={y > BAND ? 'top' : 'base'} />
      );
    return (
      <>
        {round ? (
          <mesh position-y={y0 + shaftH / 2} castShadow receiveShadow>
            <cylinderGeometry args={[d / 2, d / 2, shaftH, 48]} />
            <Mat color={SET.face} face="body" />
          </mesh>
        ) : (
          <Cube at={[0, y0 + shaftH / 2, 0]} size={[d, shaftH, d]} color={SET.face} face="body" />
        )}
        {bands && band(BAND / 2)}
        {bands && band(h - BAND / 2)}
      </>
    );
  },
  faces: (p) => {
    const [d, h] = [num(p, 'diameter'), num(p, 'height')];
    const round = str(p, 'shape') === 'round';
    return [
      { id: 'body', name: 'Body', width: round ? Math.PI * d : 4 * d, height: h },
      { id: 'base', name: 'Base', width: d * 1.4 * (round ? Math.PI : 4), height: BAND },
      { id: 'top', name: 'Top', width: d * flare(p), height: d * flare(p) },
    ];
  },
};
