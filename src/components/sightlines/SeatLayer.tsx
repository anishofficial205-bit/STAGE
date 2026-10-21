/**
 * In the 3D view: the seat under the mouse in seat view (highlight + label),
 * and coloured dots over every seat when the sightline check is on.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useActiveObjects, useActiveParams, useProjectStore } from '../../store/useProjectStore';
import { useSightlines } from '../../sightlines/store';
import { collectOccluders, computeAll } from '../../sightlines/compute';
import type { SeatInfo } from '../../types';
import { useStageSeats } from './useStageSeats';

const HOVER_RADIUS = 0.35;

function HoverMarker({ seat }: { seat: SeatInfo }) {
  return (
    <group position={[seat.x, seat.y, seat.z]} userData={{ noOcclude: true }}>
      <mesh position-y={0.45} rotation-y={seat.facing} renderOrder={990}>
        <boxGeometry args={[0.6, 0.95, 0.7]} />
        <meshBasicMaterial color="#2f6fde" transparent opacity={0.35} depthTest={false} />
      </mesh>
      <Html position={[0, 1.25, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <div className="seat-tag">{seat.label}</div>
      </Html>
    </group>
  );
}

const dotGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12);
const dotMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });

/** Green (clear view) to red (blocked) dots above the seats. */
function SightlineDots({ seats, results }: { seats: SeatInfo[]; results: Float32Array }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    seats.forEach((s, i) => {
      m.position.set(s.x, s.y + 1.0, s.z);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
      mesh.setColorAt(i, c.setHSL((results[i] ?? 0) * 0.33, 0.85, 0.48));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [seats, results]);
  if (!seats.length || results.length !== seats.length) return null;
  return <instancedMesh key={seats.length} ref={ref} args={[dotGeometry, dotMaterial, seats.length]} userData={{ noOcclude: true }} />;
}

/** Recomputes sightlines when they're on and the stage or set changes (after changes settle). */
function SightlineRunner({ seats }: { seats: SeatInfo[] }) {
  const on = useSightlines((s) => s.sightlinesOn);
  const scene = useThree((s) => s.scene);
  const { targets } = useStageSeats();
  const objects = useActiveObjects();
  const params = useActiveParams();
  const surfaces = useProjectStore((s) => s.surfaceStylesByTemplate[s.templateId]);
  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    const set = useSightlines.getState().set;
    set({ progress: 0 }); // shows "Checking…" straight away; the work starts once changes settle
    const timer = window.setTimeout(async () => {
      const results = await computeAll(seats, targets, collectOccluders(scene), (p) => !cancelled && set({ progress: p }), () => cancelled);
      if (results && !cancelled) set({ results, progress: null });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [on, seats, targets, objects, params, surfaces, scene]);
  return null;
}

export function SeatLayer() {
  const seatView = useSightlines((s) => s.seatView);
  const hovered = useSightlines((s) => s.hovered);
  const on = useSightlines((s) => s.sightlinesOn);
  const results = useSightlines((s) => s.results);
  const { seats } = useStageSeats();
  const last = useRef('');
  const ray = useRef(new THREE.Raycaster());

  // Find the seat nearest the mouse ray (cheap enough to do for every seat when the mouse moves).
  useFrame(({ pointer, camera }) => {
    if (!seatView || !seats.length) return;
    const key = `${pointer.x.toFixed(4)},${pointer.y.toFixed(4)}`;
    if (key === last.current) return;
    last.current = key;
    ray.current.setFromCamera(pointer, camera);
    const r = ray.current.ray;
    const p = new THREE.Vector3();
    let best: SeatInfo | null = null;
    let bestAlong = Infinity;
    for (const s of seats) {
      p.set(s.x, s.y + 0.55, s.z);
      if (r.distanceSqToPoint(p) > HOVER_RADIUS * HOVER_RADIUS) continue;
      // Ignore the seats right around you when sitting in the audience.
      if (p.distanceToSquared(camera.position) < 2.5 * 2.5) continue;
      const along = p.sub(r.origin).dot(r.direction);
      if (along > 0 && along < bestAlong) {
        bestAlong = along;
        best = s;
      }
    }
    if (best !== useSightlines.getState().hovered) useSightlines.getState().set({ hovered: best });
  });

  useEffect(() => {
    if (!seatView) useSightlines.getState().set({ hovered: null });
  }, [seatView]);

  return (
    <>
      {seatView && hovered && <HoverMarker seat={hovered} />}
      {on && results && <SightlineDots seats={seats} results={results} />}
      <SightlineRunner seats={seats} />
    </>
  );
}
