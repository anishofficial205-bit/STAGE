import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useProjectStore } from '../store/useProjectStore';

const DURATION = 0.6; // seconds
const MIN_CAMERA_Y = 0.3;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Animation {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
}

/**
 * Orbit controls (with damping, never below the floor) plus smooth camera
 * moves whenever the store receives a view request.
 */
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const request = useProjectStore((s) => s.viewRequest);
  const anim = useRef<Animation | null>(null);

  useEffect(() => {
    const c = controls.current;
    if (!request || !c) return;
    const toPos = new THREE.Vector3(...request.view.position);
    const toTarget = new THREE.Vector3(...request.view.target);
    if (request.instant) {
      anim.current = null;
      camera.position.copy(toPos);
      c.target.copy(toTarget);
      c.update();
      return;
    }
    anim.current = { fromPos: camera.position.clone(), toPos, fromTarget: c.target.clone(), toTarget, t: 0 };
  }, [request, camera]);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / DURATION);
    const e = ease(a.t);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    c.target.lerpVectors(a.fromTarget, a.toTarget, e);
    c.update();
    if (a.t >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={1}
      maxDistance={400}
      maxPolarAngle={Math.PI / 2 - 0.02}
      // Any manual drag cancels a running view animation.
      onStart={() => (anim.current = null)}
      onChange={() => {
        // Keep panning from dragging the camera or its target under the floor.
        const c = controls.current;
        if (!c) return;
        if (c.target.y < 0) c.target.y = 0;
        if (camera.position.y < MIN_CAMERA_Y) camera.position.y = MIN_CAMERA_Y;
      }}
    />
  );
}
