import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SceneModeContext } from '../../components/StageScene';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Params } from '../../types';
import type { Pt } from '../../helpers/shapes';
import { bool, str } from '../../helpers/params';
import { Panel } from '../../helpers/primitives';
import { useProjectStore } from '../../store/useProjectStore';
import { useExportState } from '../../export/state';
import { formatLength } from '../../units';
import { overlappingIds, roomOf, useBlackBoxUI } from '../blackBox/blocks';
import { PlatformView, SeatingView, WALL_COLORS, useBlockKeys } from '../blackBox/Scene';
import { MATERIAL_COLORS, edgeLength, edgeMiddle, offsetOutline, outline, type CustomData, type DrawnShape } from './shapes';
import { customActions, snapPoint } from './actions';
import { useCustomUI } from './ui';

const ACCENT = '#2f6fde';
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

/** Extruded platform from a sampled outline (shape x, -z so the extrusion stands up after rotating). */
function extrude(pts: Pt[], height: number, y0 = 0) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.02, height), bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  if (y0) g.translate(0, y0, 0);
  return g;
}

const useActive = () => useProjectStore((s) => s.mode === 'stage');

function Label({ at, text, accent }: { at: [number, number, number]; text: string; accent?: boolean }) {
  const exporting = useExportState((s) => s.exporting);
  if (exporting) return null;
  return (
    <Html position={at} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <span className={`draw-label ${accent ? 'is-accent' : ''}`}>{text}</span>
    </Html>
  );
}

/** Pointer capture + orbit pause for handle drags; reports the floor point at height y. */
function useHandleDrag(y: number, onMove: (p: Pt, e: ThreeEvent<PointerEvent>) => void, onClick?: () => void, onEnd?: () => void) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const start = useRef<[number, number] | null>(null);
  const moved = useRef(false);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), [y]);
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      start.current = [e.clientX, e.clientY];
      moved.current = false;
      (e.target as unknown as Element).setPointerCapture(e.pointerId);
      if (controls) controls.enabled = false;
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (!start.current) return;
      e.stopPropagation();
      if (!moved.current && Math.hypot(e.clientX - start.current[0], e.clientY - start.current[1]) < 4) return;
      moved.current = true;
      if (e.ray.intersectPlane(plane, hit)) onMove([hit.x, hit.z], e);
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (!start.current) return;
      e.stopPropagation();
      start.current = null;
      (e.target as unknown as Element).releasePointerCapture(e.pointerId);
      if (controls) controls.enabled = true;
      if (!moved.current) onClick?.();
      else onEnd?.();
    },
    onPointerOver: () => (document.body.style.cursor = 'grab'),
    onPointerOut: () => (document.body.style.cursor = ''),
  };
}

function Knob({ at, color = '#ffffff', size = 0.13, diamond = false, ...handlers }: { at: [number, number, number]; color?: string; size?: number; diamond?: boolean } & Record<string, unknown>) {
  return (
    <mesh position={at} rotation-y={diamond ? Math.PI / 4 : 0} renderOrder={1000} {...handlers}>
      {diamond ? <boxGeometry args={[size * 1.3, size * 0.7, size * 1.3]} /> : <sphereGeometry args={[size, 16, 12]} />}
      <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
    </mesh>
  );
}

function PointHandle({ shape, i }: { shape: DrawnShape; i: number }) {
  const p = shape.points[i];
  const picked = useCustomUI((s) => s.selectedShape === shape.id && s.selectedPoint === i);
  const drag = useHandleDrag(
    shape.height,
    ([x, z], e) => customActions.movePoint(shape.id, i, snapPoint([x, z], undefined, false, e.metaKey || e.ctrlKey)),
    () => useCustomUI.getState().selectShape(shape.id, i),
  );
  return (
    <Knob
      at={[p.x, shape.height + 0.02, p.z]}
      color={picked ? ACCENT : '#ffffff'}
      {...drag}
      onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        customActions.removePoint(shape.id, i);
      }}
    />
  );
}

function EdgeHandle({ shape, i }: { shape: DrawnShape; i: number }) {
  const [x, z] = edgeMiddle(shape, i);
  const drag = useHandleDrag(
    shape.height,
    (at) => customActions.bendEdge(shape.id, i, at),
    () => customActions.splitEdge(shape.id, i),
  );
  return <Knob at={[x, shape.height + 0.02, z]} color={ACCENT} size={0.1} diamond {...drag} />;
}

function ShapeView({ shape, preview }: { shape: DrawnShape; preview: boolean }) {
  const units = useProjectStore((s) => s.units);
  const active = useActive() && !preview;
  const tool = useCustomUI((s) => s.tool);
  const selected = useCustomUI((s) => s.selectedShape === shape.id);
  const exporting = useExportState((s) => s.exporting);
  const pts = useMemo(() => outline(shape), [shape]);
  const stepped = shape.edge === 'stepped' && shape.height >= 0.3;
  const geometry = useMemo(() => extrude(pts, shape.height), [pts, shape.height]);
  const step = useMemo(() => (stepped ? extrude(offsetOutline(pts, 0.35), shape.height / 2) : null), [pts, shape.height, stepped]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => step?.dispose(), [step]);
  const colors = MATERIAL_COLORS[shape.material] ?? MATERIAL_COLORS.black;
  const pick =
    active && !tool
      ? {
          onClick: (e: ThreeEvent<MouseEvent>) => {
            if (e.delta > 4) return;
            e.stopPropagation();
            useBlackBoxUI.getState().select(null);
            useCustomUI.getState().selectShape(shape.id);
          },
          onPointerOver: () => (document.body.style.cursor = 'pointer'),
          onPointerOut: () => (document.body.style.cursor = ''),
        }
      : {};
  const mats = (
    <>
      <meshStandardMaterial attach="material-0" color={colors.top} roughness={0.85} />
      <meshStandardMaterial attach="material-1" color={colors.side} roughness={0.9} />
    </>
  );
  const ring = useMemo(() => [...pts, pts[0]].map(([x, z]) => [x, shape.height + 0.012, z] as [number, number, number]), [pts, shape.height]);
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow {...pick}>
        {mats}
      </mesh>
      {step && (
        <mesh geometry={step} castShadow receiveShadow {...pick}>
          {mats}
        </mesh>
      )}
      {selected && active && !exporting && (
        <>
          <Line points={ring} color={ACCENT} lineWidth={2} depthTest={false} renderOrder={999} />
          {shape.points.map((_, i) => (
            <PointHandle key={`p${i}`} shape={shape} i={i} />
          ))}
          {shape.points.map((_, i) => (
            <EdgeHandle key={`e${i}`} shape={shape} i={i} />
          ))}
          {shape.points.map((a, i) => {
            const b = shape.points[(i + 1) % shape.points.length];
            const [mx, mz] = edgeMiddle(shape, i);
            return <Label key={`l${i}`} at={[mx, shape.height + 0.35, mz]} text={formatLength(edgeLength(a, b), units)} />;
          })}
        </>
      )}
    </group>
  );
}

/** While "Seating along an edge" is on: every edge is a clickable strip. */
function EdgePicker({ shapes }: { shapes: DrawnShape[] }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <>
      {shapes.flatMap((s) =>
        s.points.map((a, i) => {
          const b = s.points[(i + 1) % s.points.length];
          const [mx, mz] = edgeMiddle(s, i);
          const key = `${s.id}:${i}`;
          const len = edgeLength(a, b);
          const ang = Math.atan2(b.z - a.z, b.x - a.x);
          return (
            <mesh
              key={key}
              position={[mx, s.height + 0.03, mz]}
              rotation-y={-ang}
              renderOrder={998}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(key);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHover(null);
                document.body.style.cursor = '';
              }}
              onClick={(e) => {
                if (e.delta > 4) return;
                e.stopPropagation();
                customActions.seatAlongEdge(s.id, i);
              }}
            >
              <boxGeometry args={[len, 0.06, 0.35]} />
              <meshBasicMaterial color={hover === key ? ACCENT : '#ffb020'} depthTest={false} transparent opacity={hover === key ? 0.9 : 0.6} />
            </mesh>
          );
        }),
      )}
    </>
  );
}

/** "Draw stage": click points on the floor; double-click, Enter or the first point closes the shape. */
function DrawTool({ shapes, size }: { shapes: DrawnShape[]; size: number }) {
  const units = useProjectStore((s) => s.units);
  const draft = useCustomUI((s) => s.draft);
  const hover = useCustomUI((s) => s.hover);
  const vertices = useMemo(() => shapes.flatMap((s) => s.points.map((p) => [p.x, p.z] as Pt)), [shapes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useCustomUI.getState();
      if (e.key === 'Escape') ui.setTool(null);
      else if (e.key === 'Enter') customActions.finishDraft();
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        ui.setDraft(ui.draft.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.cursor = 'crosshair';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.cursor = '';
    };
  }, []);

  const pointAt = (e: ThreeEvent<PointerEvent | MouseEvent>): Pt | null => {
    if (!e.ray.intersectPlane(ground, hit)) return null;
    const d = useCustomUI.getState().draft;
    const raw: Pt = [hit.x, hit.z];
    // Existing corners (and the first point, to close) win over the grid.
    const near = [...(d.length ? [d[0]] : []), ...vertices].find((v) => Math.hypot(v[0] - raw[0], v[1] - raw[1]) < 0.25);
    return near ?? snapPoint(raw, d[d.length - 1], e.shiftKey, e.metaKey || e.ctrlKey);
  };

  const closesAt = (p: Pt) => draft.length >= 3 && Math.hypot(p[0] - draft[0][0], p[1] - draft[0][1]) < 0.01;
  const preview = hover && draft.length ? [...draft, hover] : draft;
  const y = 0.03;
  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.01}
        onPointerMove={(e) => {
          const p = pointAt(e);
          if (p) useCustomUI.getState().setHover(p);
        }}
        onClick={(e) => {
          if (e.delta > 4) return;
          e.stopPropagation();
          const p = pointAt(e);
          if (!p) return;
          const ui = useCustomUI.getState();
          if (closesAt(p)) {
            customActions.finishDraft();
            return;
          }
          const last = ui.draft[ui.draft.length - 1];
          if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.01) return; // second click of a double-click
          ui.setDraft([...ui.draft, p]);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          customActions.finishDraft();
        }}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {preview.length > 1 && <Line points={preview.map(([x, z]) => [x, y, z] as [number, number, number])} color={ACCENT} lineWidth={2.5} depthTest={false} renderOrder={999} />}
      {hover && draft.length >= 2 && <Line points={[[hover[0], y, hover[1]], [draft[0][0], y, draft[0][1]]]} color={ACCENT} lineWidth={1} dashed dashSize={0.2} gapSize={0.15} depthTest={false} renderOrder={999} />}
      {draft.map(([x, z], i) => (
        <Knob key={i} at={[x, y, z]} size={i === 0 ? 0.16 : 0.1} color={i === 0 && hover && closesAt(hover) ? ACCENT : '#ffffff'} />
      ))}
      {hover && <Knob at={[hover[0], y, hover[1]]} size={0.08} color={ACCENT} />}
      {preview.slice(1).map((p, i) => {
        const a = preview[i];
        return <Label key={i} at={[(a[0] + p[0]) / 2, 0.25, (a[1] + p[1]) / 2]} text={formatLength(Math.hypot(p[0] - a[0], p[1] - a[1]), units)} accent={i === preview.length - 2} />;
      })}
    </>
  );
}

export function CustomScene({ p, data }: { p: Params; data: CustomData }) {
  const room = roomOf(p);
  const { halfW, halfL, height } = room;
  const colors = WALL_COLORS[str(p, 'wallColour')] ?? WALL_COLORS['dark-grey'];
  const tool = useCustomUI((s) => s.tool);
  const active = useActive();
  const exporting = useExportState((s) => s.exporting);
  const selectedBlock = useBlackBoxUI((s) => s.selectedId);
  const overlap = useMemo(() => overlappingIds(data.blocks), [data.blocks]);
  // Thumbnails render this scene too; only the real view gets tools and keys.
  const preview = useContext(SceneModeContext).thumbnail;
  useBlockKeys(!preview);

  // Leaving the Stage mode (or this template) drops the tool and the picked shape.
  useEffect(() => {
    if (!active && !preview) {
      useCustomUI.getState().setTool(null);
      useCustomUI.getState().selectShape(null);
    }
  }, [active, preview]);
  useEffect(() => () => void (!preview && useCustomUI.getState().setTool(null)), [preview]);

  // Keys for the picked shape: Delete removes the picked corner (or the whole shape), Esc deselects.
  useEffect(() => {
    if (preview) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      const ui = useCustomUI.getState();
      if (ui.tool || !ui.selectedShape) return;
      if (e.key === 'Escape') ui.selectShape(null);
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (ui.selectedPoint !== null) customActions.removePoint(ui.selectedShape, ui.selectedPoint);
        else customActions.remove(ui.selectedShape);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const grid = useMemo(() => {
    const g = new THREE.GridHelper(Math.max(halfW, halfL) * 2, Math.round(Math.max(halfW, halfL) * 2), '#9aa1aa', '#c3c8ce');
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = 0.6;
    return g;
  }, [halfW, halfL]);

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.002}
        receiveShadow
        onClick={(e) => {
          if (e.delta < 4 && !useCustomUI.getState().tool) {
            useBlackBoxUI.getState().select(null);
            useCustomUI.getState().selectShape(null);
          }
        }}
      >
        <planeGeometry args={[halfW * 2, halfL * 2]} />
        <meshStandardMaterial color={bool(p, 'walls') ? colors.floor : '#d7d9dc'} roughness={0.95} />
      </mesh>
      {!exporting && <primitive object={grid} position-y={0.006} />}
      {bool(p, 'walls') && (
        <>
          <Panel position={[0, height / 2, -halfL]} width={halfW * 2} height={height} color={colors.wall} oneSided />
          <Panel position={[0, height / 2, halfL]} rotationY={Math.PI} width={halfW * 2} height={height} color={colors.wall} oneSided />
          <Panel position={[-halfW, height / 2, 0]} rotationY={Math.PI / 2} width={halfL * 2} height={height} color={colors.wall} oneSided />
          <Panel position={[halfW, height / 2, 0]} rotationY={-Math.PI / 2} width={halfL * 2} height={height} color={colors.wall} oneSided />
        </>
      )}
      {data.shapes.map((s) => (
        <ShapeView key={s.id} shape={s} preview={preview} />
      ))}
      {data.blocks.map((b) =>
        b.kind === 'platform' ? (
          <PlatformView key={b.id} block={b} selected={b.id === selectedBlock} overlap={overlap.has(b.id)} />
        ) : (
          <SeatingView key={b.id} block={b} selected={b.id === selectedBlock} overlap={overlap.has(b.id)} />
        ),
      )}
      {active && !preview && tool === 'draw' && <DrawTool shapes={data.shapes} size={Math.max(halfW, halfL) * 2 + 20} />}
      {active && !preview && tool === 'seat-edge' && <EdgePicker shapes={data.shapes} />}
    </group>
  );
}

