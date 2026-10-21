/**
 * Shared look and helpers for set objects. Pieces are a light, unpainted
 * neutral so they read as a model (colours and graphics come later).
 */
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { ROUGHNESS } from '../helpers/materials';
import type { Pt } from '../helpers/shapes';

export const SET = {
  body: '#dcd8d0',
  face: '#e8e5de',
  edge: '#c9c4ba',
  wood: '#b89c76',
  cloth: '#d6d2cb',
  metal: '#8c939c',
  dark: '#4a4f57',
};

export function Mat({ color = SET.body, side, opacity = 1 }: { color?: string; side?: THREE.Side; opacity?: number }) {
  return <meshStandardMaterial color={color} roughness={ROUGHNESS} side={side} transparent={opacity < 1} opacity={opacity} />;
}

/** Box from its centre and size, with shadows. */
export function Cube({ at, size, color, children }: { at: [number, number, number]; size: [number, number, number]; color?: string; children?: ReactNode }) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      {children ?? <Mat color={color} />}
    </mesh>
  );
}

/**
 * Extrude a 2D outline (x across, y up, with optional holes) by `depth`,
 * centred on z = 0. Front cap faces +Z. UVs on the caps are normalised to the
 * outline's bounding box so graphics map cleanly later.
 */
export function Extruded({ outline, holes = [], depth, color, z = 0 }: { outline: Pt[]; holes?: Pt[][]; depth: number; color?: string; z?: number }) {
  const key = JSON.stringify([outline, holes, depth]);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 });
    g.translate(0, 0, -depth / 2);
    normaliseCapUVs(g, outline);
    return g;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geometry} position-z={z} castShadow receiveShadow>
      <Mat color={color} />
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
