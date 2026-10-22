import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useProjectStore } from '../store/useProjectStore';
import { useExportState } from '../export/state';
import type { Mode } from '../modes';

const DIM = 0.22;
type Orig = { transparent: boolean; opacity: number; depthWrite: boolean };

function eachMaterial(root: THREE.Object3D, fn: (m: THREE.Material) => void) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    if (Array.isArray(m)) m.forEach(fn);
    else fn(m);
  });
}

type Dim = { orig: Orig; to: number };

/** Make a material see-through, remembering how it was. Re-applies if React reset any of it. */
function dim(m: THREE.Material) {
  const d = m.userData.dim as Dim | undefined;
  if (d && m.transparent && !m.depthWrite && m.opacity === d.to) return;
  const orig: Orig = {
    transparent: d && m.transparent ? d.orig.transparent : m.transparent,
    opacity: d && m.opacity === d.to ? d.orig.opacity : m.opacity,
    depthWrite: d && !m.depthWrite ? d.orig.depthWrite : m.depthWrite,
  };
  m.userData.dim = { orig, to: orig.opacity * DIM } satisfies Dim;
  if (!m.transparent) m.needsUpdate = true;
  m.transparent = true;
  m.opacity = orig.opacity * DIM;
  m.depthWrite = false;
}

function undim(m: THREE.Material) {
  const d = m.userData.dim as Dim | undefined;
  if (!d) return;
  delete m.userData.dim;
  if (m.opacity === d.to) m.opacity = d.orig.opacity;
  if (m.transparent !== d.orig.transparent) m.needsUpdate = true;
  m.transparent = d.orig.transparent;
  m.depthWrite = d.orig.depthWrite;
}

/**
 * Wraps the 3D things a mode owns. Outside that mode they follow the "Show other
 * layers" setting: shown as normal, dimmed, or hidden. Exports always show everything.
 */
export function OtherLayer({ layer, children }: { layer: Mode; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const mode = useProjectStore((s) => s.mode);
  const other = useProjectStore((s) => s.otherLayers);
  const exporting = useExportState((s) => s.exporting);
  const look = mode === layer || exporting ? 'show' : other;

  // Dimmed: keep every material (including ones created since) see-through.
  useFrame(() => {
    if (look === 'dim' && ref.current) eachMaterial(ref.current, dim);
  });
  useEffect(() => {
    if (look !== 'dim' && ref.current) eachMaterial(ref.current, undim);
  }, [look]);

  return (
    <group ref={ref} visible={look !== 'hide'}>
      {children}
    </group>
  );
}
