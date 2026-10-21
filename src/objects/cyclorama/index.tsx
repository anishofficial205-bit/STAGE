/**
 * Cyclorama — a large backdrop that curves smoothly into the floor. The face
 * is one continuous surface: U runs across the width, V from the front floor
 * edge up to the top, so a graphic flows round the curve without seams.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Params } from '../../types';
import { num } from '../../helpers/params';
import { Icon, Mat, SET } from '../common';
import type { SetObjectType } from '../types';

const ARC_STEPS = 40;

/** Profile points (z, y) from the front floor edge, round the curve, to the top, plus their distances. */
function profile(p: Params) {
  const h = num(p, 'height');
  const rc = Math.min(num(p, 'curveRadius'), h - 0.05);
  const pts: [number, number][] = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = (i / ARC_STEPS) * (Math.PI / 2);
    pts.push([rc - rc * Math.sin(a), rc - rc * Math.cos(a)]);
  }
  pts.push([0, h]);
  const dist = [0];
  for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, dist, length: dist[dist.length - 1], rc };
}

function Cyc({ p }: { p: Params }) {
  const w = num(p, 'width');
  const h = num(p, 'height');
  const rcIn = num(p, 'curveRadius');
  const geometry = useMemo(() => {
    const { pts, dist, length, rc } = profile(p);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    pts.forEach(([z, y], i) => {
      for (const u of [0, 1]) {
        // Centre the footprint (depth rc) on the origin.
        pos.push(-w / 2 + u * w, y, z - rc / 2);
        uv.push(u, dist[i] / length);
      }
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [w, h, rcIn]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <Mat color={SET.cloth} side={THREE.DoubleSide} face="front" />
    </mesh>
  );
}

export const cycloramaObject: SetObjectType = {
  id: 'cyclorama',
  name: 'Cyclorama',
  category: 'Architecture',
  icon: (
    <Icon>
      <path d="M5 3v11a5 5 0 0 0 5 5h11" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 10, min: 1, max: 60, step: 0.1 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 6, min: 1, max: 30, step: 0.1 },
    { key: 'curveRadius', label: 'Curve radius at the bottom', group: 'Size', type: 'number', default: 1.5, min: 0.2, max: 10, step: 0.05 },
  ],
  constraints: (p) => ({ ...p, curveRadius: Math.min(num(p, 'curveRadius'), num(p, 'height') - 0.1) }),
  size: (p) => ({ width: num(p, 'width'), depth: profile(p).rc, height: num(p, 'height') }),
  resize: { width: 'width', depth: 'curveRadius' },
  build: (p) => <Cyc p={p} />,
  faces: (p) => [{ id: 'front', name: 'Front', width: num(p, 'width'), height: profile(p).length }],
};
