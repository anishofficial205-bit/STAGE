import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { getTemplate } from '../templates/registry';
import { useActiveData, useActiveParams, useProjectStore } from '../store/useProjectStore';
import { CAMERA_FOV, resetView } from '../helpers/views';
import { CameraRig } from './CameraRig';
import { ShadowsOnChange, StageScene } from './StageScene';

/** Reports the canvas aspect ratio to the store and frames the stage on first load. */
function ViewportSync() {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const setAspect = useProjectStore((s) => s.setViewportAspect);
  const framed = useRef(false);
  // Dev-only hooks for automated checks (camera + store); stripped from production builds.
  const three = useThree();
  if (import.meta.env.DEV) Object.assign(window, { __three: three, __store: useProjectStore });
  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    setAspect(width / height);
    if (!framed.current) {
      framed.current = true;
      const s = useProjectStore.getState();
      const t = getTemplate(s.templateId)!;
      s.requestView(resetView(t.bounds(s.paramsByTemplate[s.templateId], s.dataByTemplate[s.templateId]), width / height), true);
    }
  }, [width, height, setAspect]);
  return null;
}

export function Viewport() {
  const templateId = useProjectStore((s) => s.templateId);
  const units = useProjectStore((s) => s.units);
  const requestView = useProjectStore((s) => s.requestView);
  const params = useActiveParams();
  const data = useActiveData();
  const template = getTemplate(templateId)!;

  // Re-frame (animated) whenever the template changes. First load is framed by ViewportSync.
  const lastTemplate = useRef(templateId);
  useEffect(() => {
    if (lastTemplate.current === templateId) return;
    lastTemplate.current = templateId;
    const s = useProjectStore.getState();
    requestView(resetView(template.bounds(s.paramsByTemplate[templateId], s.dataByTemplate[templateId]), s.viewportAspect));
  }, [templateId, template, requestView]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      // While orbiting, resolution may drop to half to stay smooth; it recovers when you stop.
      performance={{ min: 0.5 }}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 3000, position: [15, 12, 25] }}
      gl={{ antialias: true }}
    >
      <StageScene template={template} params={params} data={data} />
      <ShadowsOnChange deps={[template, params, data, units]} />
      <AdaptiveDpr pixelated />
      <CameraRig />
      <ViewportSync />
    </Canvas>
  );
}
