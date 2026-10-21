import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { getTemplate } from '../templates/registry';
import { useActiveData, useActiveParams, useProjectStore } from '../store/useProjectStore';
import { FloorGrid } from '../helpers/FloorGrid';
import { CAMERA_FOV, resetView } from '../helpers/views';
import { DEFAULT_ENVIRONMENT } from '../helpers/environment';
import type { Bounds, Environment } from '../types';
import { CameraRig } from './CameraRig';

/** Soft key light whose shadow camera is sized to the current scene. */
function Lights({ bounds, env }: { bounds: Bounds; env: Environment }) {
  const size = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]) / 2 + 8;
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  const [dx, dy, dz] = env.sun.direction;
  return (
    <>
      <hemisphereLight args={[env.hemisphere.sky, env.hemisphere.ground, env.hemisphere.intensity]} />
      <ambientLight intensity={env.ambient} />
      <directionalLight
        position={[cx + size * dx, size * dy, cz + size * dz]}
        color={env.sun.color}
        intensity={env.sun.intensity}
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
        shadow-camera-far={size * 6}
      >
        <object3D attach="target" position={[cx, 0, cz]} />
      </directionalLight>
    </>
  );
}

/** Keeps a failing template from blanking the whole viewport; it retries when the scene changes. */
class SceneBoundary extends Component<{ resetKey: unknown; children: ReactNode }, { failed: boolean; key: unknown }> {
  state = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps(props: { resetKey: unknown }, state: { failed: boolean; key: unknown }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }
  componentDidCatch(error: unknown) {
    console.error('Stage scene failed to render:', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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
  const requestView = useProjectStore((s) => s.requestView);
  const params = useActiveParams();
  const data = useActiveData();
  const template = getTemplate(templateId)!;
  const bounds = useMemo(() => template.bounds(params, data), [template, params, data]);
  // A fresh object whenever the scene inputs change, so a failed scene gets another try.
  const sceneKey = useMemo(() => ({}), [templateId, params, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const env = useMemo(() => ({ ...DEFAULT_ENVIRONMENT, ...template.environment?.(params) }), [template, params]);

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
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 3000, position: [15, 12, 25] }}
      gl={{ antialias: true }}
    >
      {env.sky ? (
        <Sky distance={2000} sunPosition={env.sky.sunPosition} turbidity={env.sky.turbidity ?? 6} rayleigh={env.sky.rayleigh ?? 1.2} />
      ) : (
        <color attach="background" args={[env.background]} />
      )}
      {env.stars && <Stars radius={600} depth={80} count={4000} factor={6} fade speed={0} />}
      <fog attach="fog" args={[env.fog, 140, 500]} />
      <Lights bounds={bounds} env={env} />
      <FloorGrid env={env} />
      <SceneBoundary resetKey={sceneKey}>{template.build(params, data)}</SceneBoundary>
      <CameraRig />
      <ViewportSync />
    </Canvas>
  );
}
