/**
 * Shared look and helpers for set objects. Pieces are a light, unpainted
 * neutral so they read as a model (colours and graphics come later).
 */
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Pt } from '../helpers/shapes';
import { FaceMat } from './faceMaterial';

export const SET = {
  body: '#dcd8d0',
  face: '#e8e5de',
  edge: '#c9c4ba',
  wood: '#b89c76',
  cloth: '#d6d2cb',
  metal: '#8c939c',
  dark: '#4a4f57',
};

/**
 * Dev-only UV check: with `window.__uvTest = true` (set before load), every
 * object surface shows a gradient + grid, so you can see how a graphic will
 * wrap across flat and curved faces.
 */
let uvTestTexture: THREE.Texture | null = null;
function uvTest(): THREE.Texture | null {
  if (!import.meta.env.DEV || !(window as unknown as { __uvTest?: boolean }).__uvTest) return null;
  if (uvTestTexture) return uvTestTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#e63946');
  grad.addColorStop(0.5, '#f4d35e');
  grad.addColorStop(1, '#1d6fde');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 3;
  for (let i = 0; i <= 8; i++) {
    g.beginPath();
    g.moveTo(i * 64, 0);
    g.lineTo(i * 64, 512);
    g.moveTo(0, i * 64);
    g.lineTo(512, i * 64);
    g.stroke();
  }
  g.fillStyle = '#000';
  g.font = 'bold 90px sans-serif';
  g.fillText('F', 40, 120); // shows orientation: should read correctly, top-left
  uvTestTexture = new THREE.CanvasTexture(c);
  uvTestTexture.colorSpace = THREE.SRGBColorSpace;
  return uvTestTexture;
}

/**
 * Material for an object part: a named face, or (without `face`) a part that
 * follows the object's "all faces" style. With the dev UV test on, shows the test texture.
 */
export function Mat({ color = SET.body, side, opacity = 1, face }: { color?: string; side?: THREE.Side; opacity?: number; face?: string }) {
  const map = uvTest();
  return <FaceMat face={face} color={map ? '#ffffff' : color} map={map} side={side} opacity={opacity} />;
}

/** Faces of a box, in three.js material order: +X, -X, +Y, -Y, +Z (front), -Z (back). */
export interface BoxFaces {
  px?: string;
  nx?: string;
  py?: string;
  ny?: string;
  pz?: string;
  nz?: string;
}
const SLOTS: (keyof BoxFaces)[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

/**
 * Box from its centre and size, with shadows. `face` names every side;
 * `faces` names individual sides (others fall back to `face`, then to "all faces").
 */
export function Cube({ at, size, color, face, faces, children }: { at: [number, number, number]; size: [number, number, number]; color?: string; face?: string; faces?: BoxFaces; children?: ReactNode }) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      {children ?? (faces ? SLOTS.map((k, i) => <MatSlot key={k} attach={`material-${i}`} color={color} face={faces[k] ?? face} />) : <Mat color={color} face={face} />)}
    </mesh>
  );
}

function MatSlot({ attach, color = SET.body, face }: { attach: string; color?: string; face?: string }) {
  const map = uvTest();
  return <FaceMat attach={attach} face={face} color={map ? '#ffffff' : color} map={map} />;
}

/**
 * Split a geometry's triangles into material groups by the direction they
 * face. `classify` gets each triangle's normal and returns a group index.
 * Front/back caps also get planar UVs (0–1 over `box`), mirrored on the back
 * so artwork reads correctly from behind.
 */
export function groupByNormal(
  g: THREE.BufferGeometry,
  classify: (n: THREE.Vector3) => number,
  groups: number,
  planar?: { box: [number, number, number, number]; front: number; back: number },
) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute | undefined;
  const index = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i);
  const buckets: number[][] = Array.from({ length: groups }, () => []);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < index.length; t += 3) {
    a.fromBufferAttribute(pos, index[t]);
    b.fromBufferAttribute(pos, index[t + 1]);
    c.fromBufferAttribute(pos, index[t + 2]);
    const n = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const k = Math.min(groups - 1, Math.max(0, classify(n)));
    buckets[k].push(index[t], index[t + 1], index[t + 2]);
    if (planar && uv && (k === planar.front || k === planar.back)) {
      const [x0, y0, x1, y1] = planar.box;
      for (const v of [index[t], index[t + 1], index[t + 2]]) {
        const u = (pos.getX(v) - x0) / (x1 - x0 || 1);
        uv.setXY(v, k === planar.back ? 1 - u : u, (pos.getY(v) - y0) / (y1 - y0 || 1));
      }
    }
  }
  g.setIndex(buckets.flat());
  g.clearGroups();
  let start = 0;
  buckets.forEach((bk, i) => {
    g.addGroup(start, bk.length, i);
    start += bk.length;
  });
  if (uv) uv.needsUpdate = true;
  return g;
}

/**
 * Extrude a 2D outline (x across, y up, with optional holes) by `depth`,
 * centred on z = 0. The front (+Z), back and side faces become separate
 * materials, named by `faces`; front/back get clean 0–1 UVs over the outline.
 */
export function Extruded({
  outline,
  holes = [],
  depth,
  color,
  z = 0,
  faces = {},
}: {
  outline: Pt[];
  holes?: Pt[][];
  depth: number;
  color?: string;
  z?: number;
  faces?: { front?: string; back?: string; sides?: string };
}) {
  const key = JSON.stringify([outline, holes, depth]);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 });
    g.translate(0, 0, -depth / 2);
    const xs = outline.map((p) => p[0]);
    const ys = outline.map((p) => p[1]);
    return groupByNormal(g, (n) => (n.z > 0.5 ? 0 : n.z < -0.5 ? 1 : 2), 3, { box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], front: 0, back: 1 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geometry} position-z={z} castShadow receiveShadow>
      <MatSlot attach="material-0" color={color} face={faces.front} />
      <MatSlot attach="material-1" color={color} face={faces.back} />
      <MatSlot attach="material-2" color={color} face={faces.sides} />
    </mesh>
  );
}

/** ExtrudeGeometry caps (group 0) get UVs in world units; rescale them to 0–1 over the outline. */
export function normaliseCapUVs(g: THREE.ExtrudeGeometry, outline: Pt[]) {
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const caps = g.groups[0];
  if (!caps) return;
  for (let i = caps.start; i < caps.start + caps.count; i++) {
    const idx = g.index ? g.index.getX(i) : i;
    uv.setXY(idx, (pos.getX(idx) - x0) / (x1 - x0 || 1), (pos.getY(idx) - y0) / (y1 - y0 || 1));
  }
  uv.needsUpdate = true;
}

/** Library icon wrapper: 24 × 24 line drawing. */
export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      {children}
    </svg>
  );
}
