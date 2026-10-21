/**
 * Placed set objects in the 3D view: rendering, selection, dragging, the
 * handles (move / height / rotate / edge-resize), smart guides and the cables
 * of hanging pieces.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useActiveData, useActiveObjects, useActiveParams, useProjectStore } from '../../store/useProjectStore';
import { getTemplate } from '../../templates/registry';
import { getStageInfo } from '../../helpers/stageInfo';
import type { StageInfo, Vec3 } from '../../types';
import { isOffStage, place, rotateXZ, unrotateXZ, type Placed } from '../../objects/geometry';
import { moveSelection, resizeFromEdge, setElevation, setRotation } from '../../objects/actions';
import { useObjectUI } from '../../objects/ui';
import { getObjectType } from '../../objects/registry';
import { useBlackBoxUI } from '../../templates/blackBox/blocks';

const SELECT = '#2f6fde';
const WARN = '#f08c00';
const GUIDE = '#ff3d8b';
const toRad = (deg: number) => (deg * Math.PI) / 180;
const tmp = new THREE.Vector3();
const horizontal = (y: number) => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);

/** Pointer-capture drag: `start` returns drag state (or null to ignore), `move` receives it. Orbiting pauses meanwhile. */
function useDrag<S>(opts: { start: (e: ThreeEvent<PointerEvent>) => S | null; move: (e: ThreeEvent<PointerEvent>, s: S) => void; end?: (s: S) => void }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const state = useRef<S | null>(null);
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const s = opts.start(e);
      if (s === null) return;
      state.current = s;
      (e.target as unknown as Element).setPointerCapture(e.pointerId);
      if (controls) controls.enabled = false;
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (state.current === null) return;
      e.stopPropagation();
      opts.move(e, state.current);
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (state.current === null) return;
      const s = state.current;
      state.current = null;
      (e.target as unknown as Element).releasePointerCapture(e.pointerId);
      if (controls) controls.enabled = true;
      opts.end?.(s);
    },
  };
}

/** Wireframe box around an object's bounds. */
function BoxOutline({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.04, h + 0.04, d + 0.04)), [w, d, h]);
  return (
    <lineSegments geometry={geometry} position-y={h / 2} renderOrder={998} raycast={() => null}>
      <lineBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
    </lineSegments>
  );
}

/** Thin cables from a hanging piece up to whatever it hangs from (or up out of view). */
function Cables({ p, info }: { p: Placed; info: StageInfo }) {
  const lines = info.rigging ?? [];
  const top = p.baseY + p.size.height;
  const pts = [-0.4, 0.4].map((f) => {
    const [ox, oz] = rotateXZ(p.size.width * f, 0, p.obj.rotation);
    const at: [number, number] = [p.wx + ox, p.wz + oz];
    // Attach to a rigging line passing (almost) directly overhead.
    let y = top + 20;
    for (const [a, b] of lines) {
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const len2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[2]) * dz) / len2));
      const dist = Math.hypot(at[0] - (a[0] + dx * t), at[1] - (a[2] + dz * t));
      const ly = a[1] + (b[1] - a[1]) * t;
      if (dist < 0.35 && ly > top && ly < y) y = ly;
    }
    return { at, y };
  });
  return (
    <>
      {pts.map(({ at, y }, i) => (
        <Line key={i} points={[[at[0], top, at[1]], [at[0], y, at[1]]]} color="#3a3f47" lineWidth={1} transparent opacity={0.8} />
      ))}
    </>
  );
}

/** Keeps a handle the same size on screen regardless of zoom. */
function ScreenSized({ position, children }: { position: Vec3; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    g.getWorldPosition(tmp);
    g.scale.setScalar(Math.max(0.03, camera.position.distanceTo(tmp) * 0.013));
  });
  return (
    <group ref={ref} position={position} userData={{ handle: true }}>
      {children}
    </group>
  );
}

/** Handles are drawn on top of everything, so they should also win clicks over the objects they belong to. */
export function handlesFirst<T extends { object: THREE.Object3D }>(hits: T[]): T[] {
  const isHandle = (o: THREE.Object3D | null): boolean => !!o && (o.userData?.handle === true || isHandle(o.parent));
  return [...hits.filter((h) => isHandle(h.object)), ...hits.filter((h) => !isHandle(h.object))];
}

const handleMat = (color = SELECT) => <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />;

/** Square handle on one edge: drag to resize width (x) or depth (z) while the opposite edge stays put. */
function EdgeHandle({ p, axis, sign, y }: { p: Placed; axis: 'x' | 'z'; sign: 1 | -1; y: number }) {
  const { obj, size } = p;
  const drag = useDrag({
    start: () => ({ obj, size: axis === 'x' ? size.width : size.depth }),
    move: (e, s) => {
      if (!e.ray.intersectPlane(horizontal(p.baseY + y), tmp)) return;
      const [lx, lz] = unrotateXZ(tmp.x - p.wx, tmp.z - p.wz, obj.rotation);
      let next = sign * (axis === 'x' ? lx : lz) + s.size / 2;
      if (!e.shiftKey) next = Math.round(next / 0.05) * 0.05;
      resizeFromEdge({ obj: s.obj, size: s.size, axis, sign }, next);
    },
  });
  const offset = (axis === 'x' ? size.width : size.depth) / 2 + 0.02;
  return (
    <ScreenSized position={axis === 'x' ? [sign * offset, y, 0] : [0, y, sign * offset]}>
      <mesh renderOrder={1000} {...drag} onPointerOver={() => (document.body.style.cursor = axis === 'x' ? 'ew-resize' : 'ns-resize')} onPointerOut={() => (document.body.style.cursor = '')}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        {handleMat('#ffffff')}
      </mesh>
      <mesh renderOrder={999} scale={1.35}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        {handleMat()}
      </mesh>
    </ScreenSized>
  );
}

/** True while the camera looks (almost) straight down — the height handle can't be dragged usefully then. */
function useTopDown() {
  const [topDown, setTopDown] = useState(false);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const v = camera.getWorldDirection(dir).y < -0.92;
    if (v !== topDown) setTopDown(v);
  });
  return topDown;
}

function Handles({ p }: { p: Placed }) {
  const { obj, type, size } = p;
  const camera = useThree((s) => s.camera);
  const topDown = useTopDown();
  const hy = Math.min(size.height / 2, 1.2);
  const rad = toRad(obj.rotation);

  const handlesX = type.resize?.width ? ([1, -1] as const) : [];
  const handlesZ = type.resize?.depth ? ([1, -1] as const) : [];

  const height = useDrag({
    start: (e) => {
      const n = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(p.wx, 0, p.wz)).setY(0).normalize();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(p.wx, p.baseY, p.wz));
      if (!e.ray.intersectPlane(plane, tmp)) return null;
      return { plane, y0: tmp.y, e0: p.elevation };
    },
    move: (e, s) => {
      if (!e.ray.intersectPlane(s.plane, tmp)) return;
      let elev = s.e0 + (tmp.y - s.y0);
      if (!e.shiftKey) elev = Math.round(elev / 0.05) * 0.05;
      setElevation(obj.id, elev);
    },
  });

  const rotate = useDrag({
    start: () => ({}),
    move: (e) => {
      if (!e.ray.intersectPlane(horizontal(p.baseY), tmp)) return;
      let deg = (Math.atan2(tmp.x - p.wx, tmp.z - p.wz) * 180) / Math.PI;
      // 15° steps; hold Shift for free rotation.
      if (!e.shiftKey) deg = Math.round(deg / 15) * 15;
      setRotation(obj.id, deg);
    },
  });

  const hover = (cursor: string) => ({
    onPointerOver: () => (document.body.style.cursor = cursor),
    onPointerOut: () => (document.body.style.cursor = ''),
  });

  return (
    <group position={[p.wx, p.baseY, p.wz]} rotation-y={rad}>
      {handlesX.map((sign) => (
        <EdgeHandle key={`x${sign}`} p={p} axis="x" sign={sign} y={hy} />
      ))}
      {handlesZ.map((sign) => (
        <EdgeHandle key={`z${sign}`} p={p} axis="z" sign={sign} y={hy} />
      ))}
      {/* Height: a double arrow above the object */}
      {!topDown && (
      <ScreenSized position={[0, size.height + 0.25, 0]}>
        <group {...height} {...hover('ns-resize')}>
          <mesh position-y={1.6} renderOrder={1000}>
            <coneGeometry args={[0.55, 1, 16]} />
            {handleMat()}
          </mesh>
          <mesh position-y={0.55} renderOrder={1000}>
            <cylinderGeometry args={[0.16, 0.16, 1.3, 8]} />
            {handleMat()}
          </mesh>
          <mesh position-y={-0.45} rotation-x={Math.PI} renderOrder={1000}>
            <coneGeometry args={[0.55, 1, 16]} />
            {handleMat()}
          </mesh>
        </group>
      </ScreenSized>
      )}
      {/* Rotate: a ring knob in front of the object */}
      <ScreenSized position={[0, 0.03, size.depth / 2 + 0.45]}>
        <group {...rotate} {...hover('grab')}>
          <mesh rotation-x={-Math.PI / 2} renderOrder={1000}>
            <torusGeometry args={[0.7, 0.18, 8, 32]} />
            {handleMat()}
          </mesh>
          <mesh renderOrder={1000}>
            <sphereGeometry args={[0.35, 12, 12]} />
            {handleMat('#ffffff')}
          </mesh>
        </group>
      </ScreenSized>
    </group>
  );
}

function ObjectView({ p, selected, offStage, info }: { p: Placed; selected: boolean; offStage: boolean; info: StageInfo }) {
  const { obj, type, size } = p;
  const built = useMemo(() => type.build(obj.params), [type, obj.params]);
  const drag = useDrag({
    start: (e) => {
      const store = useProjectStore.getState();
      useBlackBoxUI.getState().select(null);
      if (e.shiftKey) {
        store.select([obj.id], true);
        return null;
      }
      if (!store.selectedIds.includes(obj.id)) store.select([obj.id]);
      if (!e.ray.intersectPlane(horizontal(p.baseY), tmp)) return null;
      const ids = useProjectStore.getState().selectedIds;
      const list = store.objectsByTemplate[store.templateId] ?? [];
      const starts = Object.fromEntries(list.filter((o) => ids.includes(o.id) && !o.locked).map((o) => [o.id, { x: o.x, z: o.z }]));
      if (!starts[obj.id]) return null;
      return { off: [p.wx - tmp.x, p.wz - tmp.z] as const, starts };
    },
    move: (e, s) => {
      if (!e.ray.intersectPlane(horizontal(p.baseY), tmp)) return;
      // Hold Alt (Option) to place freely without snapping.
      moveSelection(obj.id, [tmp.x + s.off[0], tmp.z + s.off[1]], s.starts, { snap: !e.altKey });
    },
    end: () => useObjectUI.getState().setGuides([]),
  });
  const interactive = obj.locked ? {} : { ...drag, onPointerOver: () => (document.body.style.cursor = 'move'), onPointerOut: () => (document.body.style.cursor = '') };
  return (
    <>
      <group position={[p.wx, p.baseY, p.wz]} rotation-y={toRad(obj.rotation)} {...interactive}>
        {built}
        {(selected || offStage) && <BoxOutline w={size.width} d={size.depth} h={size.height} color={selected ? (offStage ? WARN : SELECT) : WARN} />}
      </group>
      {type.placement === 'hanging' && <Cables p={p} info={info} />}
    </>
  );
}

export function SetObjectsLayer() {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useActiveParams();
  const data = useActiveData();
  const objects = useActiveObjects();
  const selectedIds = useProjectStore((s) => s.selectedIds);
  const guides = useObjectUI((s) => s.guides);
  const info = useMemo(() => getStageInfo(getTemplate(templateId)!, params, data), [templateId, params, data]);
  const placed = useMemo(() => objects.map((o) => place(o, info)).filter((p): p is Placed => !!p), [objects, info]);
  const single = selectedIds.length === 1 ? placed.find((p) => p.obj.id === selectedIds[0]) : undefined;

  return (
    <group>
      {placed
        .filter((p) => !p.obj.hidden)
        .map((p) => (
          <ObjectView key={p.obj.id} p={p} info={info} selected={selectedIds.includes(p.obj.id)} offStage={isOffStage(p, info)} />
        ))}
      {single && !single.obj.locked && !single.obj.hidden && getObjectType(single.obj.type) && <Handles key={single.obj.id} p={single} />}
      {guides.map(([a, b], i) => (
        <Line key={i} points={[a, b]} color={GUIDE} lineWidth={1.2} depthTest={false} renderOrder={997} />
      ))}
    </group>
  );
}

