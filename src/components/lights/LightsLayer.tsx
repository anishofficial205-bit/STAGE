/**
 * Stage lights in 3D: hanging positions, fixture models with a short cone
 * showing where they point, the real lights (within the budget; shadows and
 * gobos), soft pools for lights beyond the budget, haze beams, and — in
 * Lights mode — picking, dragging along the rig and focusing.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { LABEL_PRIORITY, hoverProps, labelPriority, useHovered, useShowLabel } from '../../helpers/labels';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useActiveLighting, useProjectStore } from '../../store/useProjectStore';
import { useExportState } from '../../export/state';
import { FIXTURES, type Fixture, type HangPosition, type Vec3 } from '../../lighting/types';
import { hangLines, positionLine, snapToRig, type HangLine } from '../../lighting/hang';
import { lightActions } from '../../lighting/actions';
import { useLightsUI } from '../../lighting/ui';
import { goboTexture, useGoboTextures } from '../../lighting/gobos';
import { FixtureModel, PracticalModel } from './models';
import { beamCone, hazeMaterial, poolTexture } from './haze';
import { lightBudget } from './budget';
import { Plain } from '../../glossary/Plain';

const ACCENT = '#f27a35';
/** Light output at 100% (decay 0, so brightness doesn't depend on throw distance). */
const K_SPOT = 4;
const K_POINT = 2.5;
const K_HOUSE = 1.4;
const Z = new THREE.Vector3(0, 0, 1);

const rad = (deg: number) => (deg * Math.PI) / 180;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

/** Rotation that turns +Z towards the fixture's target. */
function aim(f: Fixture) {
  const d = new THREE.Vector3(...sub(f.target, f.pos));
  if (d.lengthSq() < 1e-6) d.set(0, -1, 0);
  return new THREE.Quaternion().setFromUnitVectors(Z, d.normalize());
}

/** Is this object part of the lights' own helpers (models, cones, markers)? */
function isHelper(o: THREE.Object3D | null) {
  for (let p = o; p; p = p.parent) if (p.userData.lightHelper) return true;
  return false;
}

/** The first real surface along a ray (stage, set, walls…), ignoring the lights' own models. */
export function surfaceHit(ray: THREE.Ray, scene: THREE.Scene, camera: THREE.Camera): Vec3 | null {
  const rc = new THREE.Raycaster(ray.origin.clone(), ray.direction.clone());
  // Fat lines and sprites need the camera to be hit-tested.
  rc.camera = camera;
  let hits: THREE.Intersection[] = [];
  try {
    hits = rc.intersectObjects(scene.children, true);
  } catch {
    return null;
  }
  for (const h of hits) {
    if (!(h.object as THREE.Mesh).isMesh || isHelper(h.object)) continue;
    let visible = true;
    for (let p: THREE.Object3D | null = h.object; p; p = p.parent) if (!p.visible) visible = false;
    const m = (h.object as THREE.Mesh).material as THREE.Material;
    if (!visible || (m && !Array.isArray(m) && m.transparent && m.opacity < 0.05)) continue;
    return [h.point.x, h.point.y, h.point.z];
  }
  return null;
}

function useOrbitPause() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  return (on: boolean) => {
    if (controls) controls.enabled = !on;
  };
}

/** Drag helper: click (no movement) → onClick; movement → onMove each step, onEnd at the end. */
function useDrag(o: { onDown?: (e: ThreeEvent<PointerEvent>) => boolean; onMove: (e: ThreeEvent<PointerEvent>) => void; onClick?: (e: ThreeEvent<PointerEvent>) => void }) {
  const pause = useOrbitPause();
  const start = useRef<[number, number] | null>(null);
  const moved = useRef(false);
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      if (o.onDown && !o.onDown(e)) return;
      start.current = [e.clientX, e.clientY];
      moved.current = false;
      (e.target as unknown as Element).setPointerCapture(e.pointerId);
      pause(true);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (!start.current) return;
      e.stopPropagation();
      if (!moved.current && Math.hypot(e.clientX - start.current[0], e.clientY - start.current[1]) < 4) return;
      moved.current = true;
      o.onMove(e);
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (!start.current) return;
      e.stopPropagation();
      start.current = null;
      (e.target as unknown as Element).releasePointerCapture(e.pointerId);
      pause(false);
      if (!moved.current) o.onClick?.(e);
    },
  };
}

function PositionView({ p, selected, active }: { p: HangPosition; selected: boolean; active: boolean }) {
  const line = positionLine(p);
  const startRef = useRef<{ p: HangPosition; at: THREE.Vector3; key: string } | null>(null);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -(p.kind === 'boom' ? p.y : p.y)), [p.y, p.kind]);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const drag = useDrag({
    onDown: (e) => {
      useLightsUI.getState().select({ kind: 'position', ids: [p.id] }, e.shiftKey);
      if (!e.ray.intersectPlane(plane, hit)) return false;
      startRef.current = { p, at: hit.clone(), key: `pos-move:${p.id}:${Date.now()}` };
      return true;
    },
    onMove: (e) => {
      const s = startRef.current;
      if (!s || !e.ray.intersectPlane(plane, hit)) return;
      const snap = (v: number) => Math.round(v / 0.25) * 0.25;
      lightActions.patchPosition(p.id, { x: s.p.x + snap(hit.x - s.at.x), z: s.p.z + snap(hit.z - s.at.z) }, s.key);
    },
  });
  const color = selected ? ACCENT : '#55595f';
  const mid: Vec3 = [(line.a[0] + line.b[0]) / 2, (line.a[1] + line.b[1]) / 2, (line.a[2] + line.b[2]) / 2];
  const pick = active ? { ...drag, onPointerOver: () => (document.body.style.cursor = 'move'), onPointerOut: () => (document.body.style.cursor = '') } : {};
  return (
    <group userData={{ lightHelper: true, lightPosition: p.id }}>
      {p.kind === 'boom' ? (
        <>
          <mesh position={mid} {...pick}>
            <cylinderGeometry args={[0.03, 0.03, p.length, 10]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} emissive={selected ? ACCENT : '#000'} emissiveIntensity={selected ? 0.4 : 0} />
          </mesh>
          <mesh position={[p.x, p.y + 0.02, p.z]}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 20]} />
            <meshStandardMaterial color="#2c2e33" />
          </mesh>
        </>
      ) : (
        <mesh position={mid} rotation-z={Math.PI / 2} {...pick}>
          <cylinderGeometry args={[p.kind === 'foh' ? 0.12 : 0.03, p.kind === 'foh' ? 0.12 : 0.03, p.length, p.kind === 'foh' ? 4 : 10]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} wireframe={p.kind === 'foh'} emissive={selected ? ACCENT : '#000'} emissiveIntensity={selected ? 0.4 : 0} />
        </mesh>
      )}
    </group>
  );
}

function FixtureView({ f, real, shadow, approx, selected, active, haze, presentation, lines }: { f: Fixture; real: boolean; shadow: boolean; approx: boolean; selected: boolean; active: boolean; haze: { on: boolean; density: number }; presentation: boolean; lines: () => HangLine[] }) {
  const spec = FIXTURES[f.type];
  const exporting = useExportState((s) => s.exporting);
  const target = useMemo(() => new THREE.Object3D(), []);
  const q = useMemo(() => aim(f), [f]);
  const throwLen = Math.max(0.5, len(sub(f.target, f.pos)));
  const color = useMemo(() => new THREE.Color(f.color), [f.color]);
  useGoboTextures((s) => (f.gobo ? s.textures[f.gobo] : null)); // re-render when an uploaded gobo has loaded
  const gobo = f.gobo && shadow ? goboTexture(f.gobo) : null;
  const level = f.on ? f.intensity / 100 : 0;
  const dragState = useRef<{ key: string; lines: HangLine[] } | null>(null);
  const drag = useDrag({
    onDown: (e) => {
      useLightsUI.getState().select({ kind: 'fixture', ids: [f.id] }, e.shiftKey);
      if (e.shiftKey || f.locked) return false;
      dragState.current = { key: `fx-move:${f.id}:${Date.now()}`, lines: lines() };
      return true;
    },
    onMove: (e) => {
      const d = dragState.current;
      if (!d) return;
      const r = snapToRig(e.ray, d.lines, spec.mount === 'floor');
      if (r) lightActions.move(f.id, r.pos, r.mount, d.key);
    },
  });
  const hover = hoverProps(`light:${f.id}`);
  const pick = active
    ? {
        ...drag,
        onPointerOver: () => {
          document.body.style.cursor = 'grab';
          hover.onPointerOver();
        },
        onPointerOut: () => {
          document.body.style.cursor = '';
          hover.onPointerOut();
        },
      }
    : hover;
  const showTag = useShowLabel('light', { selected, hoverKey: `light:${f.id}` });
  const hot = useHovered(`light:${f.id}`);
  const half = Math.min(rad(spec.point ? 60 : f.beam) / 2, rad(89));
  const cone = useMemo(() => new THREE.EdgesGeometry(beamCone(0.7, Math.min(0.45, 0.7 * Math.tan(half)), 10)), [half]);
  const beam = useMemo(() => (haze.on && !spec.point && f.type !== 'house' ? beamCone(throwLen * 1.04, throwLen * 1.04 * Math.tan(half)) : null), [haze.on, spec.point, f.type, throwLen, half]);
  const hazeMat = useMemo(() => hazeMaterial(), []);
  useEffect(() => () => [cone, beam].forEach((g) => g?.dispose()), [cone, beam]);
  hazeMat.uniforms.uColor.value.copy(color);
  hazeMat.uniforms.uStrength.value = 0.6 * (haze.density / 100) * level * (f.type === 'cyc' ? 0.4 : 1);
  hazeMat.uniforms.uLength.value = throwLen * 1.04;
  const pool = approx && !spec.point ? throwLen * Math.tan(half) : 0;
  return (
    <>
      <primitive object={target} position={f.target} />
      {real && !spec.point && (
        <spotLight
          position={f.pos}
          target={target}
          color={color}
          intensity={level * (f.type === 'house' ? K_HOUSE : K_SPOT)}
          angle={half}
          penumbra={f.soft}
          decay={0}
          distance={0}
          castShadow={shadow}
          shadow-mapSize={presentation ? [2048, 2048] : [1024, 1024]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
          shadow-camera-near={0.3}
          shadow-camera-far={80}
          map={gobo}
        />
      )}
      {real && spec.point && <pointLight position={[f.pos[0], f.pos[1] + 1.42, f.pos[2]]} color={color} intensity={level * K_POINT} distance={8} decay={1} />}
      {pool > 0 && (
        <mesh position={[f.target[0], f.target[1] + 0.012, f.target[2]]} rotation-x={-Math.PI / 2} userData={{ lightHelper: true }} renderOrder={2}>
          <planeGeometry args={[pool * 2, pool * 2]} />
          <meshBasicMaterial map={poolTexture()} color={color} transparent opacity={0.55 * level} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      <group position={f.pos} userData={{ lightHelper: true, fixture: f.id }}>
        {spec.point ? (
          <group {...pick}>
            <PracticalModel color={f.color} on={level > 0} />
          </group>
        ) : (
          <group quaternion={q}>
            <group {...pick}>
              <FixtureModel type={f.type} color={f.color} on={level > 0} />
              {/* Grab area a little bigger than the model. */}
              <mesh>
                <sphereGeometry args={[f.type === 'house' ? 1.4 : f.type === 'cyc' ? 0.55 : 0.28, 8, 6]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </group>
            {!exporting && (
              <lineSegments geometry={cone}>
                <lineBasicMaterial color={level > 0 ? f.color : '#8a9099'} transparent opacity={selected ? 0.9 : 0.45} />
              </lineSegments>
            )}
            {beam && level > 0 && <mesh geometry={beam} material={hazeMat} renderOrder={5} />}
          </group>
        )}
        {selected && !exporting && (
          <mesh>
            <sphereGeometry args={[spec.point ? 0.3 : 0.36, 16, 12]} />
            <meshBasicMaterial color={ACCENT} wireframe transparent opacity={0.6} depthTest={false} />
          </mesh>
        )}
        {showTag && !exporting && (
          <Html position={[0, spec.point ? 1.8 : 0.42, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
            <span className={`channel-tag ${selected ? 'is-selected' : ''} ${level > 0 ? '' : 'is-off'}`} data-lp={labelPriority('light', selected, hot)}>
              {f.channel} · <Plain text={f.name} />
            </span>
          </Html>
        )}
      </group>
    </>
  );
}

/** For each selected light: a line to where it points and a marker you can drag to re-aim it. */
function TargetMarker({ f }: { f: Fixture }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const key = useRef('');
  const drag = useDrag({
    onDown: () => {
      key.current = `fx-aim:${f.id}:${Date.now()}`;
      return true;
    },
    onMove: (e) => {
      const p = surfaceHit(e.ray, scene, camera);
      if (p) lightActions.focus([f.id], p, key.current);
    },
  });
  return (
    <group userData={{ lightHelper: true }}>
      <Line points={[f.pos, f.target]} color={ACCENT} lineWidth={1} dashed dashSize={0.25} gapSize={0.15} depthTest={false} renderOrder={998} />
      <mesh position={f.target} renderOrder={999} {...drag} onPointerOver={() => (document.body.style.cursor = 'crosshair')} onPointerOut={() => (document.body.style.cursor = '')}>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshBasicMaterial color={ACCENT} depthTest={false} transparent opacity={0.9} />
      </mesh>
      <Html position={f.target} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none', transform: 'translateY(-22px)' }}>
        <span className="channel-tag" data-lp={LABEL_PRIORITY.light + 10}>
          Aim · <Plain text={f.name} />
        </span>
      </Html>
    </group>
  );
}

/** "Click to focus": the next click on a surface aims the selected lights there. */
function FocusClick() {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    let down: [number, number] | null = null;
    const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      const start = down;
      down = null;
      if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 4) return;
      const r = el.getBoundingClientRect();
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const p = surfaceHit(rc.ray, scene, camera);
      const ui = useLightsUI.getState();
      if (p && ui.selected?.kind === 'fixture') lightActions.focus(ui.selected.ids, p);
      // After the click event, so this click doesn't also count as "clicked empty space" and deselect.
      setTimeout(() => ui.setFocusMode(false), 0);
    };
    // Pointer up on the window: the orbit controls capture the pointer, so it may not reach the canvas.
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    el.style.cursor = 'crosshair';
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      el.style.cursor = '';
    };
  }, [gl, camera, scene]);
  return null;
}

/** Fixtures with any look fade applied on top. */
export function useEffectiveLighting() {
  const lighting = useActiveLighting();
  const live = useLightsUI((s) => s.live);
  return useMemo(() => {
    if (!live) return lighting;
    return { ...lighting, haze: live.haze, fixtures: lighting.fixtures.map((f) => (live.states[f.id] ? { ...f, ...live.states[f.id] } : f)) };
  }, [lighting, live]);
}

export function LightsLayer() {
  const all = useEffectiveLighting();
  // Lights hidden in the layers list are not drawn and give no light.
  const lighting = useMemo(() => (all.fixtures.some((f) => f.hidden) ? { ...all, fixtures: all.fixtures.filter((f) => !f.hidden) } : all), [all]);
  const active = useProjectStore((s) => s.mode === 'lights');
  const quality = useProjectStore((s) => s.lightQuality);
  const exporting = useExportState((s) => s.exporting);
  const selected = useLightsUI((s) => (active ? s.selected : null));
  const focusMode = useLightsUI((s) => s.focusMode);
  const presentation = quality === 'presentation' || exporting;
  const { real, approx, shadows } = useMemo(() => lightBudget(lighting.fixtures, presentation ? 'presentation' : 'draft'), [lighting.fixtures, presentation]);
  const isSel = (kind: 'fixture' | 'position', id: string) => selected?.kind === kind && selected.ids.includes(id);
  // Lines are gathered when a drag starts (they depend on the stage and the set).
  const raw = useActiveLighting();
  const lines = () => hangLines(raw);
  // Shadows only refresh on change: lights changing are a change.
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
  }, [gl, lighting]);
  useFrame(() => {
    if (useLightsUI.getState().live) gl.shadowMap.needsUpdate = true;
  });
  return (
    <group>
      {lighting.positions.map((p) => (
        <PositionView key={p.id} p={p} selected={isSel('position', p.id)} active={active} />
      ))}
      {lighting.fixtures.map((f) => (
        <FixtureView key={f.id} f={f} real={real.has(f.id)} shadow={shadows.has(f.id)} approx={approx.has(f.id)} selected={isSel('fixture', f.id)} active={active} haze={lighting.haze} presentation={presentation} lines={lines} />
      ))}
      {active && !exporting && selected?.kind === 'fixture' && lighting.fixtures.filter((f) => selected.ids.includes(f.id) && !FIXTURES[f.type].point).map((f) => <TargetMarker key={f.id} f={f} />)}
      {active && focusMode && <FocusClick />}
    </group>
  );
}

export type { HangLine };
