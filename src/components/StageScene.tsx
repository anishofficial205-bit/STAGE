import { Component, createContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { FloorGrid } from '../helpers/FloorGrid';
import { DEFAULT_ENVIRONMENT } from '../helpers/environment';
import type { Bounds, Environment, Params, StageTemplate } from '../types';
import { useExportState } from '../export/state';

/** Lets shared helpers know they're drawing a picker thumbnail (e.g. to hide labels). */
export const SceneModeContext = createContext({ thumbnail: false });

/** Soft key light whose shadow camera is sized to the current scene. */
function Lights({ bounds, env: base }: { bounds: Bounds; env: Environment }) {
  // Presentation lighting: warmer key light and more fill, so shadows are softer.
  const presentation = useExportState((s) => s.presentation);
  const env: Environment = presentation
    ? { ...base, sun: { ...base.sun, color: '#ffe9cf', intensity: base.sun.intensity * 0.8 }, hemisphere: { ...base.hemisphere, sky: '#fff3e2', intensity: base.hemisphere.intensity * 1.35 }, ambient: base.ambient * 1.4 }
    : base;
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
        shadow-radius={presentation ? 10 : 4}
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
export class SceneBoundary extends Component<{ resetKey: unknown; children: ReactNode }, { failed: boolean; key: unknown }> {
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

export const sceneEnvironment = (template: StageTemplate, params: Params): Environment => ({
  ...DEFAULT_ENVIRONMENT,
  ...template.environment?.(params),
});

/** Sky, lights, ground and the template's stage: everything except the camera. */
export function StageScene({ template, params, data }: { template: StageTemplate; params: Params; data: unknown }) {
  const bounds = useMemo(() => template.bounds(params, data), [template, params, data]);
  const env = useMemo(() => sceneEnvironment(template, params), [template, params]);
  // A fresh object whenever the scene inputs change, so a failed scene gets another try.
  const sceneKey = useMemo(() => ({}), [template, params, data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
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
    </>
  );
}

/**
 * The stage is static while you look around, so shadows are only re-rendered
 * when something in the scene changes — not on every frame. This keeps large
 * seat counts smooth while orbiting.
 */
export function ShadowsOnChange({ deps }: { deps: unknown[] }) {
  const gl = useThree((s) => s.gl);
  const pending = useRef(3);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useEffect(() => {
    // Refresh for a few frames, in case parts of the scene settle a frame late.
    pending.current = 3;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    if (pending.current > 0) {
      gl.shadowMap.needsUpdate = true;
      pending.current--;
    }
  });
  return null;
}
