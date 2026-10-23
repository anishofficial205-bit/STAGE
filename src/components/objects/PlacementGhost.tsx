import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Edges, Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { usePlacing, defaultSize, freeSpot } from '../../objects/placing';
import { addObjectAt, currentStage, placedAll } from '../../objects/actions';
import { floorHeightAt } from '../../helpers/stageInfo';
import { useProjectStore } from '../../store/useProjectStore';
import { getObjectType } from '../../objects/registry';
import type { Pt } from '../../venue/types';

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const ndc = new THREE.Vector2();
const rc = new THREE.Raycaster();

/**
 * While placing a piece from the library: a see-through ghost follows the cursor
 * over the stage (already moved clear of other pieces); a click puts it there and
 * Esc cancels. Dragging still orbits the view.
 */
export function PlacementGhost() {
  const typeId = usePlacing((s) => s.typeId);
  const mode = useProjectStore((s) => s.mode);
  const { camera, gl } = useThree();
  const [at, setAt] = useState<Pt | null>(null);
  const size = useMemo(() => (typeId ? defaultSize(typeId) : null), [typeId]);

  useEffect(() => {
    if (mode !== 'set') usePlacing.getState().cancel();
  }, [mode]);

  useEffect(() => {
    if (!typeId || !size) return;
    const el = gl.domElement;
    const { info } = currentStage();
    const y = floorHeightAt(info, info.centre[0], info.centre[1]);
    plane.constant = -y;
    const others = placedAll();
    const toFloor = (e: PointerEvent | MouseEvent): Pt | null => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(ndc, camera);
      return rc.ray.intersectPlane(plane, hit) ? [hit.x, hit.z] : null;
    };
    let down: [number, number] | null = null;
    let placed = false;
    const onMove = (e: PointerEvent) => {
      const p = toFloor(e);
      setAt(p && (size.floor ? freeSpot(p, size.width, size.depth, 0, others) : p));
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) down = [e.clientX, e.clientY];
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return (down = null);
      down = null;
      const p = toFloor(e);
      if (!p) return;
      e.stopImmediatePropagation();
      placed = true;
      usePlacing.getState().cancel();
      addObjectAt(typeId, p);
    };
    // The click that placed the piece shouldn't also deselect it.
    const onClick = (e: MouseEvent) => {
      if (!placed) return;
      placed = false;
      e.stopImmediatePropagation();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') usePlacing.getState().cancel();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown, true);
    el.addEventListener('pointerup', onUp, true);
    el.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);
    el.style.cursor = 'copy';
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('pointerup', onUp, true);
      window.setTimeout(() => el.removeEventListener('click', onClick, true), 0);
      window.removeEventListener('keydown', onKey);
      el.style.cursor = '';
      setAt(null);
    };
  }, [typeId, size, camera, gl]);

  if (!typeId || !size || !at) return null;
  const { info } = currentStage();
  const y = floorHeightAt(info, at[0], at[1]);
  const h = Math.max(0.05, size.floor ? size.height : 0.1);
  return (
    <group position={[at[0], y, at[1]]} userData={{ noOcclude: true }}>
      <mesh position={[0, h / 2, 0]} raycast={() => null}>
        <boxGeometry args={[Math.max(0.05, size.width), h, Math.max(0.05, size.depth)]} />
        <meshBasicMaterial color="#ffd2ae" transparent opacity={0.22} depthWrite={false} />
        <Edges color="#ffd2ae" />
      </mesh>
      <Html center position={[0, h + 0.5, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <span className="dim-label">
          <span className="dim-label__name">{getObjectType(typeId)?.name}</span>Click to place · Esc to cancel
        </span>
      </Html>
    </group>
  );
}
