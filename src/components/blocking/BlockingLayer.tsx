/**
 * Blocking in 3D: performers where they are at the current moment of the
 * scene, entrances, spike marks and the scene's paths — plus, in Blocking
 * mode, picking and dragging, drawing and editing paths, playback and the
 * follow-performer camera.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { LABEL_PRIORITY, hoverProps, labelPriority, useHovered, useShowLabel } from '../../helpers/labels';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useActiveBlocking, useProjectStore } from '../../store/useProjectStore';
import { useExportState } from '../../export/state';
import { floorHeightAt } from '../../helpers/stageInfo';
import { currentStage, placedAll } from '../../objects/actions';
import { computeEntrances, type Entrance } from '../../blocking/entrances';
import { poseAt, sceneDuration, sceneTracks, type Pose, type Track } from '../../blocking/motion';
import { actingCentre, blockingActions, posesAt } from '../../blocking/actions';
import { useBlockingUI } from '../../blocking/ui';
import { initials, type Performer, type Pt } from '../../blocking/types';
import { Figure } from './Figure';

const ACCENT = '#f27a35';
const WARN = '#e03131';
const rad = (d: number) => (d * Math.PI) / 180;
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

/** Floor height under a point: the stage floors and any platforms of the set. */
export function useFloorAt() {
  const objects = useProjectStore((s) => s.objectsByTemplate[s.templateId]);
  const params = useProjectStore((s) => s.paramsByTemplate[s.templateId]);
  return useMemo(() => {
    const { info } = currentStage();
    const tops = placedAll()
      .filter((p) => p.type.platformTop)
      .map((p) => ({ p, top: p.baseY + p.type.platformTop!(p.obj.params) }));
    return (x: number, z: number) => {
      let h = floorHeightAt(info, x, z);
      for (const { p, top } of tops) {
        const [lx, lz] = [x - p.wx, z - p.wz];
        const r = rad(-p.obj.rotation);
        const ux = lx * Math.cos(r) + lz * Math.sin(r);
        const uz = -lx * Math.sin(r) + lz * Math.cos(r);
        if (Math.abs(ux) <= p.size.width / 2 && Math.abs(uz) <= p.size.depth / 2 && top > h) h = top;
      }
      return h;
    };
  }, [objects, params]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Everything the layer needs about the current scene, recomputed when blocking or the stage changes. */
export function useSceneModel() {
  const b = useActiveBlocking();
  const s = useProjectStore();
  const entrances = useMemo(() => computeEntrances(s, b), [b, s.templateId, s.paramsByTemplate, s.dataByTemplate, s.objectsByTemplate, s.venue]); // eslint-disable-line react-hooks/exhaustive-deps
  const map = useMemo(() => new Map(entrances.map((e) => [e.id, e] as [string, Entrance])), [entrances]);
  const scene = b.scenes.find((x) => x.id === b.sceneId) ?? b.scenes[0];
  const tracks = useMemo(() => sceneTracks(scene, b.performers, map, actingCentre()), [scene, b.performers, map]);
  const duration = useMemo(() => sceneDuration(tracks), [tracks]);
  return { b, scene, entrances, map, tracks, duration };
}

function useOrbitPause() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  return (on: boolean) => {
    if (controls) controls.enabled = !on;
  };
}

/** Pointer capture drag: click → onClick, movement → onMove. */
function useDrag(o: { onDown?: (e: ThreeEvent<PointerEvent>) => boolean; onMove: (e: ThreeEvent<PointerEvent>) => void; onClick?: (e: ThreeEvent<PointerEvent>) => void }) {
  const pause = useOrbitPause();
  const start = useRef<[number, number] | null>(null);
  const moved = useRef(false);
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0 || useBlockingUI.getState().tool) return;
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

function PerformerView({ p, pose, y, selected, active, flagged }: { p: Performer; pose: Pose; y: number; selected: boolean; active: boolean; flagged: boolean }) {
  const exporting = useExportState((s) => s.exporting);
  const drag0 = useRef<{ at: THREE.Vector3; key: string; orig: Record<string, Pt> } | null>(null);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), [y]);
  const drag = useDrag({
    onDown: (e) => {
      const ui = useBlockingUI.getState();
      if (e.shiftKey) {
        ui.select({ kind: 'performer', ids: [p.id] }, true);
        return false;
      }
      const sel = ui.selected?.kind === 'performer' && ui.selected.ids.includes(p.id) ? ui.selected.ids : [p.id];
      ui.select({ kind: 'performer', ids: sel });
      if (!e.ray.intersectPlane(plane, hit)) return false;
      // Dragging sets where they start the scene (shown at the start).
      ui.setTime(0);
      ui.setPlaying(false);
      const start = posesAt(0);
      drag0.current = { at: hit.clone(), key: `perf-move:${Date.now()}`, orig: Object.fromEntries(sel.map((id) => [id, [start.get(id)?.x ?? pose.x, start.get(id)?.z ?? pose.z] as Pt])) };
      return true;
    },
    onMove: (e) => {
      const d = drag0.current;
      if (!d || !e.ray.intersectPlane(plane, hit)) return;
      const snap = (v: number) => (e.metaKey || e.ctrlKey ? v : Math.round(v / 0.25) * 0.25);
      const dx = snap(hit.x - d.at.x);
      const dz = snap(hit.z - d.at.z);
      blockingActions.setStart(Object.keys(d.orig), (_s, id) => ({ x: d.orig[id][0] + dx, z: d.orig[id][1] + dz, onStage: true, entrance: undefined }), d.key);
    },
  });
  const hover = hoverProps(`perf:${p.id}`);
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
  const showName = useShowLabel('performer', { selected, hoverKey: `perf:${p.id}` });
  const hot = useHovered(`perf:${p.id}`);
  const off = !pose.onStage;
  const scale = p.height / 1.7;
  return (
    <group position={[pose.x, y, pose.z]} userData={{ blockingHelper: true, performer: p.id }}>
      <group rotation-y={rad(pose.facing)} scale={scale} {...pick}>
        <Figure color={p.color} posture={p.posture} opacity={off ? 0.4 : 1} />
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 1.8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.015}>
        <ringGeometry args={[0.34, 0.44, 32]} />
        <meshBasicMaterial color={flagged ? WARN : selected ? ACCENT : p.color} transparent opacity={off ? 0.5 : 0.95} />
      </mesh>
      {selected && active && !exporting && <FacingArrow p={p} facing={pose.facing} />}
      {!exporting && (showName || flagged) && (
        <Html position={[0, p.height * (p.posture === 'lying' ? 0.25 : p.posture === 'sitting' ? 0.8 : 1) + 0.28, 0]} center zIndexRange={[14, 0]} style={{ pointerEvents: 'none' }}>
          <span className={`perf-tag ${off ? 'is-off' : ''} ${flagged ? 'is-flagged' : ''}`} style={{ ['--perf' as string]: p.color }} data-lp={labelPriority('performer', selected || flagged, hot)}>
            {p.name}
          </span>
        </Html>
      )}
    </group>
  );
}

/** Drag the arrow round to turn the performer. */
function FacingArrow({ p, facing }: { p: Performer; facing: number }) {
  const key = useRef('');
  const drag = useDrag({
    onDown: () => {
      key.current = `facing:${p.id}:${Date.now()}`;
      return true;
    },
    onMove: (e) => {
      const g = (e.eventObject.parent?.parent ?? e.eventObject) as THREE.Object3D;
      const centre = g.getWorldPosition(new THREE.Vector3());
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -centre.y);
      if (!e.ray.intersectPlane(plane, hit)) return;
      let f = (Math.atan2(hit.x - centre.x, hit.z - centre.z) * 180) / Math.PI;
      if (!e.shiftKey) f = Math.round(f / 15) * 15;
      useBlockingUI.getState().setTime(0);
      blockingActions.setStart([p.id], () => ({ facing: f }), key.current);
    },
  });
  return (
    <group rotation-y={rad(facing)}>
      <mesh position={[0, 0.03, 0.75]} rotation-x={-Math.PI / 2} {...drag} onPointerOver={() => (document.body.style.cursor = 'ew-resize')} onPointerOut={() => (document.body.style.cursor = '')}>
        <circleGeometry args={[0.16, 3]} />
        <meshBasicMaterial color={ACCENT} />
      </mesh>
      <Line points={[[0, 0.03, 0.44], [0, 0.03, 0.62]]} color={ACCENT} lineWidth={3} />
    </group>
  );
}

function EntranceView({ e, selected, active }: { e: Entrance; selected: boolean; active: boolean }) {
  const exporting = useExportState((s) => s.exporting);
  const y = 0.03;
  const color = selected ? ACCENT : e.source === 'custom' ? '#7048e8' : '#e8590c';
  const hover = hoverProps(`ent:${e.id}`);
  const showName = useShowLabel('entrance', { selected, hoverKey: `ent:${e.id}` });
  const hot = useHovered(`ent:${e.id}`);
  const pick = active
    ? {
        ...hover,
        onClick: (ev: ThreeEvent<MouseEvent>) => {
          if (ev.delta > 4 || useBlockingUI.getState().tool) return;
          ev.stopPropagation();
          useBlockingUI.getState().select({ kind: 'entrance', id: e.id });
        },
      }
    : hover;
  return (
    <group position={[e.x, y, e.z]} rotation-y={rad(e.facing)} userData={{ blockingHelper: true }}>
      <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} position={[0, 0.02, 0.15]} {...pick}>
        <circleGeometry args={[0.32, 3]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {!exporting && showName && (
        <Html position={[0, 0.25, -0.2]} center zIndexRange={[13, 0]} style={{ pointerEvents: 'none' }}>
          <span className={`entrance-tag ${selected ? 'is-selected' : ''}`} style={{ ['--dot' as string]: color }} data-lp={labelPriority('entrance', selected, hot)}>
            {e.name}
          </span>
        </Html>
      )}
    </group>
  );
}

/** A path drawn on the floor with arrowheads and its order number. */
function PathView({ tr, color, order, floorAt, selected, active }: { tr: Track; color: string; order: number; floorAt: (x: number, z: number) => number; selected: boolean; active: boolean }) {
  const exporting = useExportState((s) => s.exporting);
  const pts = useMemo(() => tr.samples.map(([x, z]) => [x, floorAt(x, z) + 0.035, z] as [number, number, number]), [tr, floorAt]);
  const heads = useMemo(() => {
    const out: { at: [number, number, number]; a: number }[] = [];
    const step = Math.max(1.2, tr.length / 6);
    for (let s = step; s < tr.length + 0.01; s += step) {
      let k = tr.dist.findIndex((d) => d >= Math.min(s, tr.length - 0.01));
      if (k < 1) k = 1;
      const [a, b] = [tr.samples[k - 1], tr.samples[k]];
      out.push({ at: [b[0], floorAt(b[0], b[1]) + 0.04, b[1]], a: Math.atan2(b[0] - a[0], b[1] - a[1]) });
    }
    return out;
  }, [tr, floorAt]);
  const performerPicked = useBlockingUI((s) => s.selected?.kind === 'performer' && s.selected.ids.includes(tr.path.performerId));
  const showNum = useShowLabel('path', { selected: selected || performerPicked });
  if (pts.length < 2) return null;
  const pick = active
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4 || useBlockingUI.getState().tool) return;
          e.stopPropagation();
          useBlockingUI.getState().select({ kind: 'path', id: tr.path.id });
        },
      }
    : {};
  return (
    <group userData={{ blockingHelper: true, path: tr.path.id }}>
      <Line points={pts} color={selected ? ACCENT : color} lineWidth={selected ? 5 : 3.5} transparent opacity={0.95} />
      {/* Wider invisible strip to click. */}
      <Line points={pts} color={color} lineWidth={18} transparent opacity={0} {...pick} />
      {heads.map((h, i) => (
        <group key={i} position={h.at} rotation-y={h.a}>
          <mesh rotation-x={Math.PI / 2} scale={[1, 1, 0.25]} {...pick}>
            <coneGeometry args={[0.16, 0.36, 3]} />
            <meshBasicMaterial color={selected ? ACCENT : color} />
          </mesh>
        </group>
      ))}
      {!exporting && showNum && (
        <Html position={[pts[0][0], pts[0][1] + 0.15, pts[0][2]]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
          <span className="path-num" style={{ background: color }} data-lp={LABEL_PRIORITY.path}>
            {order}
          </span>
        </Html>
      )}
    </group>
  );
}

function PathHandles({ tr, floorAt }: { tr: Track; floorAt: (x: number, z: number) => number }) {
  const key = useRef('');
  return (
    <>
      {tr.path.points.map((p, i) => (
        <PointHandle key={i} at={p} y={floorAt(p[0], p[1])} hold={tr.path.stops.find((s) => s.index === i)?.hold} onStart={() => (key.current = `ppt:${tr.path.id}:${i}:${Date.now()}`)} onMove={(q) => blockingActions.movePathPoint(tr.path.id, i, q, key.current)} onDelete={() => blockingActions.removePathPoint(tr.path.id, i)} />
      ))}
    </>
  );
}

function PointHandle({ at, y, hold, onStart, onMove, onDelete }: { at: Pt; y: number; hold?: number; onStart: () => void; onMove: (p: Pt) => void; onDelete: () => void }) {
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), [y]);
  const drag = useDrag({
    onDown: () => {
      onStart();
      return true;
    },
    onMove: (e) => {
      if (!e.ray.intersectPlane(plane, hit)) return;
      const s = (v: number) => (e.metaKey || e.ctrlKey ? v : Math.round(v / 0.25) * 0.25);
      onMove([s(hit.x), s(hit.z)]);
    },
  });
  return (
    <group position={[at[0], y + 0.06, at[1]]} userData={{ blockingHelper: true }}>
      <mesh
        renderOrder={1000}
        {...drag}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onPointerOver={() => (document.body.style.cursor = 'grab')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[0.12, 14, 10]} />
        <meshBasicMaterial color={hold ? '#f59f00' : '#ffffff'} depthTest={false} />
      </mesh>
      {hold ? (
        <Html position={[0, 0.3, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
          <span className="hold-tag" data-lp={LABEL_PRIORITY.path}>⏸ {hold}s</span>
        </Html>
      ) : null}
    </group>
  );
}

function MarkView({ x, z, y, color, label, selected, onSelect }: { x: number; z: number; y: number; color: string; label: string; selected: boolean; onSelect?: () => void }) {
  const exporting = useExportState((s) => s.exporting);
  const showLabel = useShowLabel('entrance', { selected });
  return (
    <group position={[x, y + 0.012, z]} userData={{ blockingHelper: true }}>
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2} rotation-z={r} onClick={onSelect && ((e) => (e.stopPropagation(), onSelect()))}>
          <planeGeometry args={[0.32, 0.06]} />
          <meshBasicMaterial color={selected ? ACCENT : color} />
        </mesh>
      ))}
      {!exporting && showLabel && (
        <Html position={[0.22, 0.05, 0.22]} center zIndexRange={[11, 0]} style={{ pointerEvents: 'none' }}>
          <span className="mark-tag" style={{ color }} data-lp={LABEL_PRIORITY.path - 5}>
            {label}
          </span>
        </Html>
      )}
    </group>
  );
}

/** Click tools: draw a path, place an entrance, put down a spike mark. */
function ToolCatcher({ entrances, from, y }: { entrances: Entrance[]; from: Pt | null; y: number }) {
  const tool = useBlockingUI((s) => s.tool);
  const draft = useBlockingUI((s) => s.draft);
  const hover = useBlockingUI((s) => s.hover);
  const selected = useBlockingUI((s) => s.selected);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), [y]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useBlockingUI.getState();
      if (e.key === 'Escape') ui.setTool(null);
      if (e.key === 'Enter' && ui.tool === 'path') finishPath();
      if ((e.key === 'Backspace' || e.key === 'Delete') && ui.tool === 'path') {
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pointAt = (e: ThreeEvent<PointerEvent | MouseEvent>): { p: Pt; entrance?: Entrance } | null => {
    if (!e.ray.intersectPlane(plane, hit) && !e.ray.intersectPlane(ground, hit)) return null;
    const near = entrances.find((en) => Math.hypot(en.x - hit.x, en.z - hit.z) < 0.6);
    if (near && tool === 'path') return { p: [near.x, near.z], entrance: near };
    const s = (v: number) => (e.metaKey || e.ctrlKey ? v : Math.round(v / 0.25) * 0.25);
    return { p: [s(hit.x), s(hit.z)] };
  };
  const performerId = selected?.kind === 'performer' && selected.ids.length === 1 ? selected.ids[0] : null;
  function finishPath(exit?: Entrance) {
    const ui = useBlockingUI.getState();
    if (performerId && (ui.draft.length || exit)) blockingActions.addPath(performerId, ui.draft, exit?.id, pathStart(performerId));
    ui.setTool(null);
  }
  const preview = from && tool === 'path' ? [from, ...draft, ...(hover ? [hover] : [])] : [];
  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={y + 0.02}
        onPointerMove={(e) => {
          const r = pointAt(e);
          if (r) useBlockingUI.getState().setHover(r.p);
        }}
        onClick={(e) => {
          if (e.delta > 4) return;
          e.stopPropagation();
          const r = pointAt(e);
          if (!r) return;
          const ui = useBlockingUI.getState();
          if (tool === 'entrance') {
            blockingActions.addEntrance(r.p);
            ui.setTool(null);
          } else if (tool === 'mark' && performerId) {
            blockingActions.addMark(performerId, r.p);
          } else if (tool === 'path') {
            if (e.nativeEvent.detail >= 2) return finishPath();
            if (r.entrance) {
              // At the very start: the performer comes on from here. Later on: they go off here.
              if (!ui.draft.length && performerId && isFirstMove(performerId)) {
                blockingActions.setStart([performerId], () => ({ onStage: false, entrance: r.entrance!.id }));
                return;
              }
              return finishPath(r.entrance);
            }
            ui.setDraft([...ui.draft, r.p]);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (tool === 'path') finishPath();
        }}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {preview.length > 1 && <Line points={preview.map(([x, z]) => [x, y + 0.05, z] as [number, number, number])} color={ACCENT} lineWidth={2.5} dashed dashSize={0.25} gapSize={0.12} depthTest={false} renderOrder={999} />}
      {tool === 'path' && entrances.map((en) => <mesh key={en.id} position={[en.x, y + 0.05, en.z]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.5, 0.6, 24]} /><meshBasicMaterial color={ACCENT} transparent opacity={0.6} /></mesh>)}
    </>
  );
}

/** When a performer's new path starts: now, or when their last move ends if that's later. */
function pathStart(id: string) {
  const s = useProjectStore.getState();
  const b = s.blockingByTemplate[s.templateId];
  const scene = b?.scenes.find((x) => x.id === b.sceneId);
  const now = useBlockingUI.getState().time;
  if (!b || !scene) return now;
  const tracks = sceneTracks(scene, b.performers, new Map(computeEntrances(s, b).map((e) => [e.id, e])));
  const mine = tracks.get(id)?.tracks ?? [];
  const end = mine.reduce((t, tr) => Math.max(t, tr.path.start + tr.duration), 0);
  return Math.max(now, end);
}
function isFirstMove(id: string) {
  const s = useProjectStore.getState();
  const b = s.blockingByTemplate[s.templateId];
  return !b?.scenes.find((x) => x.id === b.sceneId)?.paths.some((p) => p.performerId === id);
}

/** Advances playback, and keeps the camera on the followed performer. */
function Clock({ duration, poses }: { duration: number; poses: Map<string, Pose> }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const last = useRef<Pt | null>(null);
  useFrame((_, dt) => {
    const ui = useBlockingUI.getState();
    if (ui.playing) {
      const t = ui.time + Math.min(dt, 0.1) * ui.rate;
      if (t >= duration) {
        ui.setTime(duration);
        ui.setPlaying(false);
      } else ui.setTime(t);
    }
    const id = ui.follow && ui.selected?.kind === 'performer' ? ui.selected.ids[0] : null;
    const p = id ? poses.get(id) : undefined;
    if (p && controls) {
      if (last.current) {
        const d = new THREE.Vector3(p.x - last.current[0], 0, p.z - last.current[1]);
        camera.position.add(d);
        (controls as unknown as { target: THREE.Vector3 }).target.add(d);
      }
      last.current = [p.x, p.z];
    } else last.current = null;
  });
  return null;
}

export function BlockingLayer() {
  const { b, scene, entrances, map, tracks, duration } = useSceneModel();
  const active = useProjectStore((s) => s.mode === 'blocking');
  const time = useBlockingUI((s) => s.time);
  const selected = useBlockingUI((s) => (active ? s.selected : null));
  const tool = useBlockingUI((s) => s.tool);
  const highlight = useBlockingUI((s) => s.highlight);
  const warnings = useBlockingUI((s) => s.warnings);
  // Performers with a problem right now (during playback), or the one picked from the list.
  const flaggedNow = useMemo(() => new Set(highlight ? highlight.performerIds : (warnings ?? []).filter((w) => time >= w.time - 0.01 && time <= w.until + 0.5).flatMap((w) => w.performerIds)), [highlight, warnings, time]);
  const floorAt = useFloorAt();
  const poses = useMemo(() => new Map([...tracks.entries()].map(([id, { start, tracks: ts }]) => [id, poseAt(start, ts, map, time)])), [tracks, map, time]);
  const selPerf = selected?.kind === 'performer' ? selected.ids : [];
  const one = selPerf.length === 1 ? poses.get(selPerf[0]) : undefined;
  const markLabels = useMemo(() => {
    const n = new Map<string, number>();
    return b.marks.map((m) => {
      const k = (n.get(m.performerId) ?? 0) + 1;
      n.set(m.performerId, k);
      const p = b.performers.find((x) => x.id === m.performerId);
      return { m, label: `${initials(p?.name ?? '')}${k}`, color: p?.color ?? '#888' };
    });
  }, [b.marks, b.performers]);
  return (
    <group>
      {entrances.map((e) => (
        <EntranceView key={e.id} e={e} selected={selected?.kind === 'entrance' && selected.id === e.id} active={active} />
      ))}
      {markLabels.map(({ m, label, color }) => (
        <MarkView key={m.id} x={m.x} z={m.z} y={floorAt(m.x, m.z)} color={color} label={label} selected={selected?.kind === 'mark' && selected.id === m.id} onSelect={active ? () => useBlockingUI.getState().select({ kind: 'mark', id: m.id }) : undefined} />
      ))}
      {b.performers
        .filter((p) => !p.hidden)
        .flatMap((p) =>
          (tracks.get(p.id)?.tracks ?? []).map((tr, i) => (
            <PathView key={tr.path.id} tr={tr} color={p.color} order={i + 1} floorAt={floorAt} selected={selected?.kind === 'path' && selected.id === tr.path.id} active={active} />
          )),
        )}
      {selected?.kind === 'path' &&
        (() => {
          const tr = [...tracks.values()].flatMap((x) => x.tracks).find((t) => t.path.id === selected.id);
          return tr && active ? <PathHandles tr={tr} floorAt={floorAt} /> : null;
        })()}
      {b.performers
        .filter((p) => !p.hidden)
        .map((p) => {
          const pose = poses.get(p.id)!;
          return <PerformerView key={p.id} p={p} pose={pose} y={floorAt(pose.x, pose.z)} selected={selPerf.includes(p.id)} active={active} flagged={flaggedNow.has(p.id)} />;
        })}
      {highlight?.seats?.map((s, i) => (
        <mesh key={i} position={[s.x, s.y + 1.2, s.z]} userData={{ blockingHelper: true }}>
          <sphereGeometry args={[0.18, 8, 6]} />
          <meshBasicMaterial color={WARN} />
        </mesh>
      ))}
      {active && tool && <ToolCatcher entrances={entrances} from={one ? [one.x, one.z] : null} y={one ? floorAt(one.x, one.z) : 0} />}
      {active && <Clock duration={duration} poses={poses} />}
      <SceneKey id={scene.id} />
    </group>
  );
}

/** Stop playback when the scene changes. */
function SceneKey({ id }: { id: string }) {
  useEffect(() => {
    useBlockingUI.getState().setPlaying(false);
  }, [id]);
  return null;
}
