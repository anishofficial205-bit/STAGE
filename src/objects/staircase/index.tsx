/**
 * Staircase (decorative) — straight, or curving through a quarter turn, with
 * an optional railing. Rises towards its back (-Z) like the Steps piece.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Params, Vec3 } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { Beam } from '../../helpers/primitives';
import { Cube, Icon, SET, groupByNormal } from '../common';
import { FaceMat } from '../faceMaterial';
import type { SetObjectType } from '../types';

const TREAD = 0.28;
const SWEEP = Math.PI / 2; // curved stairs turn 90°
const INNER = 0.6; // inner radius of curved stairs

const curved = (p: Params) => str(p, 'kind') === 'curved';

/** Footprint of the curved flight, so it can be centred. */
function curvedBox(p: Params) {
  const ro = INNER + num(p, 'width');
  // Sector from angle 0 (+X) to 90° (towards -Z), centred at the origin before shifting.
  return { minX: 0, maxX: ro, minZ: -ro, maxZ: 0, ro };
}

function CurvedSteps({ p }: { p: Params }) {
  const n = num(p, 'steps');
  const H = num(p, 'totalHeight');
  const w = num(p, 'width');
  const ro = INNER + w;
  const geoms = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const a0 = (SWEEP * i) / n;
        const a1 = (SWEEP * (i + 1)) / n;
        const shape = new THREE.Shape();
        shape.absarc(0, 0, ro, a0, a1, false);
        shape.absarc(0, 0, INNER, a1, a0, true);
        const g = new THREE.ExtrudeGeometry(shape, { depth: (H * (i + 1)) / n, bevelEnabled: false, curveSegments: 6 });
        // Shape in XY → floor (X, -Z), extruded upwards.
        g.rotateX(-Math.PI / 2);
        return groupByNormal(g, (n) => (n.y > 0.5 ? 0 : 1), 2);
      }),
    [n, H, ro],
  );
  const rail: Vec3[] = Array.from({ length: n + 1 }, (_, i) => {
    const a = (SWEEP * Math.min(i + 0.5, n)) / n;
    return [ro * Math.cos(a) - 0.05, (H * Math.min(i + 1, n)) / n + 0.9, -(ro - 0.05) * Math.sin(a)];
  });
  const box = curvedBox(p);
  return (
    <group position={[-(box.minX + box.maxX) / 2, 0, -(box.minZ + box.maxZ) / 2]}>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g} castShadow receiveShadow>
          <FaceMat attach="material-0" face="treads" color={i % 2 ? SET.body : '#d4d0c7'} />
          <FaceMat attach="material-1" face="sides" color={i % 2 ? SET.body : '#d4d0c7'} />
        </mesh>
      ))}
      {bool(p, 'railing') && <Railing points={rail} />}
    </group>
  );
}

function Railing({ points }: { points: Vec3[] }) {
  return (
    <>
      {points.map((q, i) => (
        <Beam key={`p${i}`} from={[q[0], q[1] - 0.9, q[2]]} to={q} size={0.035} color={SET.metal} />
      ))}
      {points.slice(1).map((q, i) => (
        <Beam key={`r${i}`} from={points[i]} to={q} size={0.05} color={SET.wood} />
      ))}
    </>
  );
}

export const staircaseObject: SetObjectType = {
  id: 'staircase',
  name: 'Staircase',
  category: 'Architecture',
  icon: (
    <Icon>
      <path d="M3 20h4v-4h4v-4h4V8h4V4" />
      <path d="M5 13l10-9" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    {
      key: 'kind',
      label: 'Type',
      group: 'Size',
      type: 'select',
      default: 'straight',
      options: [
        { value: 'straight', label: 'Straight' },
        { value: 'curved', label: 'Curved (quarter turn)' },
      ],
    },
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 1.2, min: 0.5, max: 6, step: 0.05 },
    { key: 'steps', label: 'Number of steps', group: 'Size', type: 'number', unit: 'none', default: 10, min: 2, max: 40, step: 1 },
    { key: 'totalHeight', label: 'Total height', group: 'Size', type: 'number', default: 1.8, min: 0.2, max: 10, step: 0.05 },
    { key: 'railing', label: 'Railing', group: 'Build', type: 'boolean', default: true },
  ],
  constraints: (p) => p,
  size: (p) => {
    if (curved(p)) {
      const b = curvedBox(p);
      return { width: b.maxX - b.minX, depth: b.maxZ - b.minZ, height: num(p, 'totalHeight') + (bool(p, 'railing') ? 0.9 : 0) };
    }
    return { width: num(p, 'width'), depth: num(p, 'steps') * TREAD, height: num(p, 'totalHeight') + (bool(p, 'railing') ? 0.9 : 0) };
  },
  resize: (p) => (curved(p) ? {} : { width: 'width' }),
  build: (p) => {
    if (curved(p)) return <CurvedSteps p={p} />;
    const [w, n, H] = [num(p, 'width'), num(p, 'steps'), num(p, 'totalHeight')];
    const D = n * TREAD;
    const rail: Vec3[] = Array.from({ length: n + 1 }, (_, i) => [w / 2 - 0.05, (H * Math.min(i + 1, n)) / n + 0.9, D / 2 - Math.min(i + 0.5, n) * TREAD]);
    return (
      <>
        {Array.from({ length: n }, (_, i) => {
          const h = (H * (i + 1)) / n;
          return <Cube key={i} at={[0, h / 2, D / 2 - (i + 0.5) * TREAD]} size={[w, h, TREAD + 0.002]} color={i % 2 ? SET.body : '#d4d0c7'} faces={{ py: 'treads', nx: 'sides', px: 'sides', pz: 'sides' }} />;
        })}
        {bool(p, 'railing') && <Railing points={rail} />}
      </>
    );
  },
  faces: (p) => [
    { id: 'treads', name: 'Treads', width: num(p, 'width'), height: num(p, 'steps') * TREAD },
    { id: 'sides', name: 'Sides', width: num(p, 'steps') * TREAD, height: num(p, 'totalHeight') },
  ],
};
