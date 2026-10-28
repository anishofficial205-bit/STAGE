import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { addLightAimedAt, useLightPlacing, SIMPLE_LIGHTS } from '../../lighting/moods';
import { FIXTURES, type Vec3 } from '../../lighting/types';
import { MERGE_WITH_PREVIOUS, useProjectStore } from '../../store/useProjectStore';
import { surfaceHit } from './LightsLayer';
import { lightActions } from '../../lighting/actions';
import { presetActions } from '../../lighting/presets';

const ndc = new THREE.Vector2();
const rc = new THREE.Raycaster();

/** After choosing a light type: "Click where you want light on stage", then hang and aim it there. */
export function LightClickPlacer() {
  const type = useLightPlacing((s) => s.type);
  const preset = useLightPlacing((s) => s.preset);
  const mode = useProjectStore((s) => s.mode);
  const { camera, gl, scene } = useThree();
  const [at, setAt] = useState<Vec3 | null>(null);

  useEffect(() => {
    if (mode !== 'lights') useLightPlacing.getState().cancel();
  }, [mode]);

  useEffect(() => {
    if (!type) return;
    const el = gl.domElement;
    const pick = (e: MouseEvent): Vec3 | null => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(ndc, camera);
      return surfaceHit(rc.ray, scene as THREE.Scene, camera);
    };
    let down: [number, number] | null = null;
    let placed = false;
    const onMove = (e: PointerEvent) => setAt(pick(e));
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) down = [e.clientX, e.clientY];
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return (down = null);
      down = null;
      const p = pick(e);
      if (!p) return;
      e.stopImmediatePropagation();
      placed = true;
      useLightPlacing.getState().cancel();
      const id = addLightAimedAt(type, p);
      if (preset) lightActions.patch([id], presetActions.lightPatch(preset), MERGE_WITH_PREVIOUS);
    };
    const onClick = (e: MouseEvent) => {
      if (!placed) return;
      placed = false;
      e.stopImmediatePropagation();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useLightPlacing.getState().cancel();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown, true);
    el.addEventListener('pointerup', onUp, true);
    el.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);
    el.style.cursor = 'crosshair';
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('pointerup', onUp, true);
      window.setTimeout(() => el.removeEventListener('click', onClick, true), 0);
      window.removeEventListener('keydown', onKey);
      el.style.cursor = '';
      setAt(null);
    };
  }, [type, preset, camera, gl, scene]);

  if (!type || !at) return null;
  const name = preset?.name ?? SIMPLE_LIGHTS.find((s) => s.type === type)?.name ?? FIXTURES[type].label;
  return (
    <group position={at} userData={{ lightHelper: true }}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} raycast={() => null}>
        <ringGeometry args={[0.5, 0.62, 40]} />
        <meshBasicMaterial color="#e9f8a6" transparent opacity={0.9} depthTest={false} />
      </mesh>
      <Html center position={[0, 0.8, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <span className="dim-label">
          <span className="dim-label__name">{name}</span>Click where you want light on stage · Esc to cancel
        </span>
      </Html>
    </group>
  );
}
