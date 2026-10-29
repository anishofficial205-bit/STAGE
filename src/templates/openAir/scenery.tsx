/**
 * Open-air scenery: scattered crowd figures, trees and a city skyline, all
 * instanced so hundreds of them stay cheap. Positions come from a seeded
 * random generator so they don't jump around when other params change.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useSeatsShown } from '../../helpers/seatsView';

/** Small deterministic PRNG (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Placement {
  x: number;
  z: number;
  rot?: number;
  scale?: [number, number, number];
  color?: string;
}

/** Renders one geometry many times. Per-instance colour is optional. */
export function Scatter({ geometry, material, items }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Placement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      m.position.set(it.x, 0, it.z);
      m.rotation.set(0, it.rot ?? 0, 0);
      m.scale.set(...(it.scale ?? [1, 1, 1]));
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
      if (it.color) mesh.setColorAt(i, c.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} castShadow receiveShadow userData={{ noOcclude: true }} />;
}

// --- Crowd --------------------------------------------------------------------

const figureGeometry = (() => {
  const body = new THREE.CylinderGeometry(0.16, 0.21, 1.35, 7).translate(0, 0.675, 0);
  const head = new THREE.SphereGeometry(0.12, 8, 6).translate(0, 1.5, 0);
  return mergeGeometries([body, head])!;
})();
const figureMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9 });
const CLOTHES = ['#5b6472', '#7a6f64', '#4f5d6b', '#8a8f96', '#6d5f72', '#5e6b5a', '#9a7b62', '#3f4650'];

/** Standing people scattered over a rectangle, avoiding `holes` (e.g. the FOH desk). */
export function Crowd({ x0, x1, z0, z1, count, holes = [] }: { x0: number; x1: number; z0: number; z1: number; count: number; holes?: [number, number, number, number][] }) {
  const shown = useSeatsShown();
  const items = useMemo(() => {
    const rnd = seeded(7);
    const out: Placement[] = [];
    for (let tries = 0; out.length < count && tries < count * 5; tries++) {
      const x = x0 + rnd() * (x1 - x0);
      // Denser near the stage, like a real crowd.
      const z = z0 + Math.pow(rnd(), 1.6) * (z1 - z0);
      if (holes.some(([hx0, hz0, hx1, hz1]) => x > hx0 && x < hx1 && z > hz0 && z < hz1)) continue;
      const s = 0.88 + rnd() * 0.24;
      out.push({ x, z, rot: rnd() * Math.PI * 2, scale: [1, s, 1], color: CLOTHES[Math.floor(rnd() * CLOTHES.length)] });
    }
    return out;
  }, [x0, x1, z0, z1, count, JSON.stringify(holes)]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  return <Scatter geometry={figureGeometry} material={figureMaterial} items={items} />;
}

// --- Horizon ------------------------------------------------------------------

const trunkGeometry = new THREE.CylinderGeometry(0.25, 0.35, 3, 6).translate(0, 1.5, 0);
const crownGeometry = new THREE.ConeGeometry(2.4, 7, 7).translate(0, 6, 0);
const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#6b5544', roughness: 1 });
const crownMaterial = new THREE.MeshStandardMaterial({ color: '#58764a', roughness: 1, flatShading: true });

/** A ring of low-poly trees beyond the ground area. */
export function Trees({ inner, outer, night }: { inner: number; outer: number; night: boolean }) {
  const items = useMemo(() => {
    const rnd = seeded(21);
    return Array.from({ length: 160 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = inner + rnd() * (outer - inner);
      const s = 0.8 + rnd() * 0.9;
      return { x: r * Math.sin(a), z: r * Math.cos(a), rot: rnd() * 6, scale: [s, s * (0.85 + rnd() * 0.4), s] as [number, number, number] };
    });
  }, [inner, outer]);
  crownMaterial.color.set(night ? '#1f2a22' : '#58764a');
  return (
    <>
      <Scatter geometry={trunkGeometry} material={trunkMaterial} items={items} />
      <Scatter geometry={crownGeometry} material={crownMaterial} items={items} />
    </>
  );
}

const buildingGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const buildingMaterial = new THREE.MeshStandardMaterial({ color: '#a3abb6', roughness: 0.8 });

/** A skyline of simple blocks, mostly behind the stage. */
export function Skyline({ inner, night }: { inner: number; night: boolean }) {
  const items = useMemo(() => {
    const rnd = seeded(42);
    return Array.from({ length: 110 }, () => {
      // Behind the stage (-Z) and round the sides, never in front of the audience.
      const a = Math.PI + (rnd() - 0.5) * Math.PI * 1.1;
      const r = inner + 60 + rnd() * 100;
      const w = 8 + rnd() * 14;
      return { x: r * Math.sin(a), z: r * Math.cos(a), rot: a, scale: [w, 10 + Math.pow(rnd(), 2) * 45, 8 + rnd() * 10] as [number, number, number] };
    });
  }, [inner]);
  buildingMaterial.color.set(night ? '#1b2130' : '#a3abb6');
  buildingMaterial.emissive.set(night ? '#2b3a5c' : '#000000');
  buildingMaterial.emissiveIntensity = night ? 0.35 : 0;
  return <Scatter geometry={buildingGeometry} material={buildingMaterial} items={items} />;
}
