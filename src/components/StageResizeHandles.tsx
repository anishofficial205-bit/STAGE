import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useActiveData, useActiveParams, useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { getStageInfo } from '../helpers/stageInfo';
import { formatLength, M_PER_FT } from '../units';
import type { NumberParam, Params, StageTemplate } from '../types';

type Box = { x0: number; x1: number; z0: number; z1: number; y: number };

/** The stage's main floor as a box (the first floor area the template reports). */
function floorBox(t: StageTemplate, params: Params, data: unknown): Box | null {
  const f = getStageInfo(t, params, data).floors[0];
  if (!f || f.outline.length < 3) return null;
  const xs = f.outline.map((p) => p[0]);
  const zs = f.outline.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y: f.height };
}

/**
 * Which edge a size parameter moves, found by nudging it: the handle sits on that
 * edge and dragging it changes the parameter by how far the edge moved (so it
 * works for every stage type, whatever its origin).
 */
function edgeFor(t: StageTemplate, params: Params, data: unknown, key: string, box: Box) {
  const nudged = floorBox(t, { ...params, [key]: (params[key] as number) + 0.5 }, data);
  if (!nudged) return null;
  const moves = [
    { side: 'x1' as const, d: nudged.x1 - box.x1 },
    { side: 'x0' as const, d: box.x0 - nudged.x0 },
    { side: 'z1' as const, d: nudged.z1 - box.z1 },
    { side: 'z0' as const, d: box.z0 - nudged.z0 },
  ].sort((a, b) => b.d - a.d);
  const best = moves[0];
  // Edge travel per unit of the parameter (0.5 for a centred width, 1 for a one-sided depth).
  return best.d > 0.01 ? { side: best.side, rate: best.d / 0.5 } : null;
}

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

function Handle({ t, which, dimKey }: { t: StageTemplate; which: 'width' | 'depth'; dimKey: string }) {
  const params = useActiveParams();
  const data = useActiveData();
  const units = useProjectStore((s) => s.units);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const [hover, setHover] = useState(false);
  const drag = useRef<{ start: number; value: number; edge: NonNullable<ReturnType<typeof edgeFor>>; key: string } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const box = useMemo(() => floorBox(t, params, data), [t, params, data]);
  const edge = useMemo(() => (box ? edgeFor(t, params, data, dimKey, box) : null), [t, params, data, dimKey, box]);
  const def = t.params.find((d) => d.key === dimKey) as NumberParam | undefined;
  if (!box || !edge || !def) return null;

  const cx = (box.x0 + box.x1) / 2;
  const cz = (box.z0 + box.z1) / 2;
  const pos: [number, number, number] = edge.side === 'x1' ? [box.x1, box.y + 0.05, cz] : edge.side === 'x0' ? [box.x0, box.y + 0.05, cz] : edge.side === 'z1' ? [cx, box.y + 0.05, box.z1] : [cx, box.y + 0.05, box.z0];
  const along = (p: THREE.Vector3) => (edge.side === 'x1' ? p.x : edge.side === 'x0' ? -p.x : edge.side === 'z1' ? p.z : -p.z);
  const step = units === 'ft' ? 0.5 * M_PER_FT : 0.1;

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    plane.constant = -box.y;
    if (!e.ray.intersectPlane(plane, hit)) return;
    drag.current = { start: along(hit), value: params[dimKey] as number, edge, key: `stage-drag:${dimKey}:${Date.now()}` };
    (e.target as unknown as Element).setPointerCapture(e.pointerId);
    if (controls) controls.enabled = false;
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || !e.ray.intersectPlane(plane, hit)) return;
    e.stopPropagation();
    const raw = d.value + (along(hit) - d.start) / d.edge.rate;
    const v = Math.min(def.max ?? Infinity, Math.max(def.min ?? 0.5, Math.round(raw / step) * step));
    setLive(v);
    useProjectStore.getState().setParam(dimKey, v);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    drag.current = null;
    setLive(null);
    (e.target as unknown as Element).releasePointerCapture(e.pointerId);
    if (controls) controls.enabled = true;
  };

  return (
    <group position={pos}>
      <mesh
        renderOrder={1000}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerOver={() => {
          setHover(true);
          document.body.style.cursor = edge.side.startsWith('x') ? 'ew-resize' : 'ns-resize';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
        userData={{ handle: true }}
      >
        <sphereGeometry args={[hover || live !== null ? 0.32 : 0.26, 20, 14]} />
        <meshBasicMaterial color={hover || live !== null ? '#ffffff' : '#e9f8a6'} depthTest={false} transparent opacity={0.95} />
      </mesh>
      {(hover || live !== null) && (
        <Html center position={[0, 0.7, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <span className="dim-label">
            <span className="dim-label__name">{which === 'width' ? 'Width' : 'Depth'}</span>
            {formatLength((live ?? (params[dimKey] as number)), units)}
          </span>
        </Html>
      )}
    </group>
  );
}

/** The stage selected in Set: round handles on its edges; drag to change its width and depth. */
export function StageResizeHandles() {
  const active = useProjectStore((s) => s.mode === 'set' && s.stageSelected);
  const templateId = useProjectStore((s) => s.templateId);
  const t = getTemplate(templateId);
  if (!active || !t?.dimensions) return null;
  return (
    <group userData={{ noOcclude: true }}>
      {t.dimensions.width && <Handle t={t} which="width" dimKey={t.dimensions.width} />}
      {t.dimensions.depth && <Handle t={t} which="depth" dimKey={t.dimensions.depth} />}
    </group>
  );
}
