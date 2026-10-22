import { useContext, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { FaceMat, ObjectFaces } from '../faceMaterial';
import type { FaceStyle } from '../materials';
import { panelGeometry, type PanelShape } from './pleats';
import { useCurtainAnim } from './anim';

export const VELOUR = (color: string): FaceStyle => ({ material: 'velour', color, roughness: 0.82 });

/** The curtain's open amount (0–1): the live value while animating, else the saved param. */
export function useOpen(saved: number) {
  const ctx = useContext(ObjectFaces);
  const live = useCurtainAnim((s) => (ctx ? s.live[ctx.objectId] : undefined));
  return (live ?? saved) / 100;
}

export interface PlacedPanel extends PanelShape {
  /** Extra offset of the whole panel (sliding off, flying out). */
  offset?: [number, number, number];
}

/**
 * Cloth panels (pleated unless smooth) with a front and a back face. Untouched faces use `fallback`
 * (e.g. velour in the curtain's colour); styling a face (or adding a graphic) overrides it.
 * `plain` cloth (cycs, scrims) is a flat colour rather than a woven texture.
 */
export function Fabric({ panels, fallback, back = fallback, opacity, plain }: { panels: PlacedPanel[]; fallback: FaceStyle; back?: FaceStyle; opacity?: number; plain?: boolean }) {
  const geometries = useMemo(() => panels.map(panelGeometry), [panels]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  // Shadows only refresh on change; a moving curtain is a change.
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
  }, [gl, geometries]);
  return (
    <>
      {geometries.map((g, i) => (
        <group key={i} position={panels[i].offset ?? [0, 0, 0]}>
          <mesh geometry={g} castShadow={opacity === undefined} receiveShadow>
            <FaceMat face="front" color={fallback.color} side={THREE.FrontSide} defaultStyle={plain ? undefined : fallback} roughness={fallback.roughness} opacity={opacity} />
          </mesh>
          <mesh geometry={g} castShadow={opacity === undefined} receiveShadow>
            <FaceMat face="back" color={back.color} side={THREE.BackSide} defaultStyle={plain ? undefined : back} roughness={back.roughness} opacity={opacity} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** A thin dark track or batten along the top. */
export function Track({ width, y }: { width: number; y: number }) {
  return (
    <mesh position={[0, y + 0.03, 0]} castShadow>
      <boxGeometry args={[width + 0.3, 0.06, 0.08]} />
      <meshStandardMaterial color="#26282c" roughness={0.6} metalness={0.4} />
    </mesh>
  );
}

export const FABRIC_COLORS = [
  { value: '#8b1a1a', label: 'Theatre red' },
  { value: '#5c1420', label: 'Maroon' },
  { value: '#1f3a8a', label: 'Royal blue' },
  { value: '#141416', label: 'Black' },
  { value: '#b8892b', label: 'Gold' },
];
