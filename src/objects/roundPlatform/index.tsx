/**
 * Rounded platform — a circular or half-round deck. A half-round platform has
 * its flat edge at the back (-Z) and the curve towards the audience.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Params } from '../../types';
import { num, str } from '../../helpers/params';
import { Icon, Mat, SET } from '../common';
import type { SetObjectType } from '../types';

const half = (p: Params) => str(p, 'shape') === 'semicircle';

function HalfRound({ r, h }: { r: number; h: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, r, 0, Math.PI, false);
    shape.lineTo(r, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 48 });
    // Shape lies in XY with the curve towards +Y; lay it on the floor with the curve towards +Z.
    g.rotateX(Math.PI / 2);
    g.translate(0, h, -r / 2);
    return g;
  }, [r, h]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <Mat color={SET.body} />
    </mesh>
  );
}

export const roundPlatformObject: SetObjectType = {
  id: 'round-platform',
  name: 'Rounded platform',
  category: 'Platforms',
  icon: (
    <Icon>
      <ellipse cx="12" cy="9" rx="8" ry="3.5" />
      <path d="M4 9v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V9" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    {
      key: 'shape',
      label: 'Shape',
      group: 'Size',
      type: 'select',
      default: 'circle',
      options: [
        { value: 'circle', label: 'Circle' },
        { value: 'semicircle', label: 'Half circle' },
      ],
    },
    { key: 'diameter', label: 'Diameter', group: 'Size', type: 'number', default: 2.4, min: 0.4, max: 20, step: 0.05 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 0.4, min: 0.05, max: 5, step: 0.05 },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'diameter'), depth: half(p) ? num(p, 'diameter') / 2 : num(p, 'diameter'), height: num(p, 'height') }),
  resize: (p) => ({ width: 'diameter', depth: half(p) ? { key: 'diameter', scale: 2 } : 'diameter' }),
  platformTop: (p) => num(p, 'height'),
  build: (p) => {
    const [dia, h] = [num(p, 'diameter'), num(p, 'height')];
    if (half(p)) return <HalfRound r={dia / 2} h={h} />;
    return (
      <mesh position-y={h / 2} castShadow receiveShadow>
        <cylinderGeometry args={[dia / 2, dia / 2, h, 64]} />
        <Mat color={SET.body} />
      </mesh>
    );
  },
  faces: (p) => {
    const [dia, h] = [num(p, 'diameter'), num(p, 'height')];
    return [
      { id: 'top', name: 'Top', width: dia, height: half(p) ? dia / 2 : dia },
      { id: 'side', name: 'Side', width: half(p) ? (Math.PI * dia) / 2 : Math.PI * dia, height: h },
    ];
  },
};
