/**
 * Curved wall — part of a cylinder, concave side towards the audience (+Z).
 * Inner and outer faces are smooth cylinder sections whose UVs run left to
 * right across the curve (as seen by someone facing that face).
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Params } from '../../types';
import { num } from '../../helpers/params';
import { Icon, Mat, SET } from '../common';
import type { SetObjectType } from '../types';

const SEGMENTS = 128;
const rad = (p: Params) => (num(p, 'arcAngle') * Math.PI) / 180;

/** Arc geometry: the wall's centre line has radius r around (0, cz); returns bbox-centring offset too. */
function layout(p: Params) {
  const r = num(p, 'radius');
  const t = num(p, 'thickness');
  const a = rad(p);
  const ro = r + t / 2;
  const ri = Math.max(0.01, r - t / 2);
  // Arc around angle π (the -Z side of the circle), centred so its middle sits at z = 0.
  const minZ = r - ro;
  const maxZ = r - ri * Math.cos(a / 2);
  const halfW = (a / 2 >= Math.PI / 2 ? 1 : Math.sin(a / 2)) * ro;
  return { r, t, a, ro, ri, cz: r - (minZ + maxZ) / 2, halfW, depth: maxZ - minZ };
}

function flipU(g: THREE.BufferGeometry) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  uv.needsUpdate = true;
  return g;
}

function CurvedWall({ p }: { p: Params }) {
  const L = layout(p);
  const h = num(p, 'height');
  const start = Math.PI - L.a / 2;
  const { outer, inner, top } = useMemo(() => {
    const outer = new THREE.CylinderGeometry(L.ro, L.ro, h, SEGMENTS, 1, true, start, L.a);
    // Seen from the front, the inner face's U would run right-to-left; flip it.
    const inner = flipU(new THREE.CylinderGeometry(L.ri, L.ri, h, SEGMENTS, 1, true, start, L.a));
    const top = new THREE.RingGeometry(L.ri, L.ro, SEGMENTS, 1, start - Math.PI / 2, L.a).rotateX(-Math.PI / 2);
    return { outer, inner, top };
  }, [L.ro, L.ri, L.a, h, start]);
  return (
    <group position-z={L.cz}>
      <mesh geometry={outer} position-y={h / 2} castShadow receiveShadow>
        <Mat color={SET.body} />
      </mesh>
      <mesh geometry={inner} position-y={h / 2} castShadow receiveShadow>
        <Mat color={SET.face} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={top} position-y={h} castShadow>
        <Mat color={SET.edge} side={THREE.DoubleSide} />
      </mesh>
      {[start, start + L.a].map((th) => (
        <mesh key={th} position={[L.r * Math.sin(th), h / 2, L.r * Math.cos(th)]} rotation-y={th + Math.PI / 2}>
          <planeGeometry args={[L.t, h]} />
          <Mat color={SET.edge} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export const curvedWallObject: SetObjectType = {
  id: 'curved-wall',
  name: 'Curved wall',
  category: 'Architecture',
  icon: (
    <Icon>
      <path d="M4 7c4 4 12 4 16 0v10c-4 4-12 4-16 0z" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'radius', label: 'Radius', group: 'Size', type: 'number', default: 4, min: 0.5, max: 40, step: 0.05 },
    { key: 'arcAngle', label: 'Arc angle (°)', group: 'Size', type: 'number', unit: 'none', default: 90, min: 30, max: 180, step: 5 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 3, min: 0.3, max: 20, step: 0.05 },
    { key: 'thickness', label: 'Thickness', group: 'Size', type: 'number', default: 0.15, min: 0.02, max: 2, step: 0.01 },
  ],
  constraints: (p) => p,
  size: (p) => {
    const L = layout(p);
    return { width: 2 * L.halfW, depth: L.depth, height: num(p, 'height') };
  },
  // Dragging the side edges scales the radius (the arc angle stays the same).
  resize: (p) => ({ width: { key: 'radius', scale: 1 / (2 * Math.min(1, Math.sin(rad(p) / 2))) } }),
  build: (p) => <CurvedWall p={p} />,
  faces: (p) => {
    const L = layout(p);
    const h = num(p, 'height');
    return [
      { id: 'inner', name: 'Inner (concave)', width: L.a * L.ri, height: h },
      { id: 'outer', name: 'Outer (convex)', width: L.a * L.ro, height: h },
    ];
  },
};
