/**
 * Ramp — a wedge rising towards its back (-Z). Snaps against platforms like steps.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { num } from '../../helpers/params';
import { Icon, SET, groupByNormal } from '../common';
import { FaceMat } from '../faceMaterial';
import type { SetObjectType } from '../types';

function Wedge({ w, l, h }: { w: number; l: number; h: number }) {
  const geometry = useMemo(() => {
    // Profile in (z, y): low at the front (+Z), high at the back (-Z); extruded across X.
    const shape = new THREE.Shape([new THREE.Vector2(l / 2, 0), new THREE.Vector2(-l / 2, 0), new THREE.Vector2(-l / 2, h)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    // Shape x → world z, extrusion → world x.
    g.rotateY(-Math.PI / 2);
    g.translate(w / 2, 0, 0);
    // Sloped top / the two sides / everything else.
    return groupByNormal(g, (n) => (n.y > 0.3 ? 0 : Math.abs(n.x) > 0.7 ? 1 : 2), 3);
  }, [w, l, h]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <FaceMat attach="material-0" face="top" color={SET.body} />
      <FaceMat attach="material-1" face="sides" color={SET.body} />
      <FaceMat attach="material-2" color={SET.body} />
    </mesh>
  );
}

export const rampObject: SetObjectType = {
  id: 'ramp',
  name: 'Ramp',
  category: 'Steps & ramps',
  icon: (
    <Icon>
      <path d="M3 19h18V7z" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1.2, min: 0.3, max: 12, step: 0.05 },
    { key: 'length', label: 'Length', group: 'Size', type: 'number', default: 2.4, min: 0.3, max: 20, step: 0.05 },
    { key: 'rise', label: 'Rise', group: 'Size', type: 'number', default: 0.4, min: 0.02, max: 4, step: 0.05, help: 'Snapping a ramp against a platform matches its height.' },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'length'), height: num(p, 'rise') }),
  resize: { width: 'width', depth: 'length' },
  climbs: { heightParam: 'rise' },
  build: (p) => <Wedge w={num(p, 'width')} l={num(p, 'length')} h={num(p, 'rise')} />,
  faces: (p) => [
    { id: 'top', name: 'Top', width: num(p, 'width'), height: Math.hypot(num(p, 'length'), num(p, 'rise')) },
    { id: 'sides', name: 'Sides', width: num(p, 'length'), height: num(p, 'rise') },
  ],
};
