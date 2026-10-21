import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { getTemplate } from '../templates/registry';
import { useActiveParams, useProjectStore } from '../store/useProjectStore';
import { FloorGrid } from '../helpers/FloorGrid';
import { CAMERA_FOV, resetView } from '../helpers/views';
import { COLORS } from '../helpers/materials';
import type { Bounds } from '../types';
import { CameraRig } from './CameraRig';

/** Soft key light whose shadow camera is sized to the current scene. */
function Lights({ bounds }: { bounds: Bounds }) {
  const size = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]) / 2 + 8;
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d5d8dc', 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[cx + size * 0.6, size * 1.4, cz + size * 0.8]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.001}
        shadow-normalBias={0.06}
        shadow-radius={4}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-near={0.5}
        shadow-camera-far={size * 5}
      >
        <object3D attach="target" position={[cx, 0, cz]} />
      </directionalLight>
    </>
  );
}

/** Reports the canvas aspect ratio to the store and frames the stage on first load. */
function ViewportSync() {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const setAspect = useProjectStore((s) => s.setViewportAspect);
  const framed = useRef(false);
  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    setAspect(width / height);
    if (!framed.current) {
      framed.current = true;
      const s = useProjectStore.getState();
      const t = getTemplate(s.templateId)!;
      s.requestView(resetView(t.bounds(s.paramsByTemplate[s.templateId]), width / height), true);
    }
  }, [width, height, setAspect]);
  return null;
}

export function Viewport() {
  const templateId = useProjectStore((s) => s.templateId);
  const requestView = useProjectStore((s) => s.requestView);
  const params = useActiveParams();
  const template = getTemplate(templateId)!;
  const bounds = useMemo(() => template.bounds(params), [template, params]);

  // Re-frame (animated) whenever the template changes. First load is framed by ViewportSync.
  const lastTemplate = useRef(templateId);
  useEffect(() => {
    if (lastTemplate.current === templateId) return;
    lastTemplate.current = templateId;
    const s = useProjectStore.getState();
    requestView(resetView(template.bounds(s.paramsByTemplate[templateId]), s.viewportAspect));
  }, [templateId, template, requestView]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 2000, position: [15, 12, 25] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[COLORS.background]} />
      <fog attach="fog" args={[COLORS.background, 120, 400]} />
      <Lights bounds={bounds} />
      <FloorGrid />
      {template.build(params)}
      <CameraRig />
      <ViewportSync />
    </Canvas>
  );
}
