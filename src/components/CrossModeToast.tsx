import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { viewportBridge } from '../objects/ui';
import { useProjectStore } from '../store/useProjectStore';
import { useLightsUI } from '../lighting/ui';
import { useBlockingUI } from '../blocking/ui';
import { useVenueUI } from '../venue/ui';
import { usePlacing } from '../objects/placing';
import { useLightPlacing } from '../lighting/moods';
import { MODES, type Mode } from '../modes';

interface Owner {
  mode: Mode;
  what: string;
  select: () => void;
}

/** Which mode owns a 3D object, from the markers each layer puts in userData. */
function ownerOf(o: THREE.Object3D | null): Owner | null {
  for (let p = o; p; p = p.parent) {
    const u = p.userData ?? {};
    if (u.fixture) return { mode: 'lights', what: 'a light', select: () => useLightsUI.getState().select({ kind: 'fixture', ids: [u.fixture] }) };
    if (u.lightPosition) return { mode: 'lights', what: 'a light bar', select: () => useLightsUI.getState().select({ kind: 'position', ids: [u.lightPosition] }) };
    if (u.performer) return { mode: 'blocking', what: 'a performer', select: () => useBlockingUI.getState().select({ kind: 'performer', ids: [u.performer] }) };
    if (u.objectId) return { mode: 'set', what: 'a set piece', select: () => useProjectStore.getState().select([u.objectId]) };
    if (u.venueRoom) return { mode: 'venue', what: 'a room', select: () => useVenueUI.getState().select({ kind: 'room', id: u.venueRoom }) };
    if (u.venueWall) return { mode: 'venue', what: 'a wall', select: () => useVenueUI.getState().select({ kind: 'wall', id: u.venueWall }) };
    if (u.venueDoor) return { mode: 'venue', what: 'a door', select: () => useVenueUI.getState().select({ kind: 'door', id: u.venueDoor }) };
    if (u.venueFurniture) return { mode: 'venue', what: 'furniture', select: () => useVenueUI.getState().select({ kind: 'furniture', id: u.venueFurniture }) };
  }
  return null;
}

const visible = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

const rc = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/**
 * Clicking something that belongs to another mode explains itself: "This is a
 * light. Switch to Lights to edit it", with a Switch button. Goes after 3 s or
 * on the next click.
 */
export function CrossModeToast() {
  const [toast, setToast] = useState<{ x: number; y: number; owner: Owner } | null>(null);

  useEffect(() => {
    let down: [number, number] | null = null;
    let timer = 0;
    const onDown = (e: PointerEvent) => {
      down = e.button === 0 ? [e.clientX, e.clientY] : null;
      if (!(e.target as HTMLElement).closest?.('.cross-toast')) setToast(null);
    };
    const onUp = (e: PointerEvent) => {
      const three = viewportBridge.three;
      if (!down || !three || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
      if (e.target !== three.gl.domElement || usePlacing.getState().typeId || useLightPlacing.getState().type) return;
      const r = three.gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(ndc, three.camera);
      (rc as THREE.Raycaster & { camera: THREE.Camera }).camera = three.camera;
      let hits: THREE.Intersection[] = [];
      try {
        hits = rc.intersectObjects(three.scene.children, true);
      } catch {
        return;
      }
      // Skip see-through things (haze beams, light pools, ghost helpers) so clicks land on solid objects.
      const solid = (h: THREE.Intersection) => {
        const m = (h.object as THREE.Mesh).material as THREE.Material | THREE.Material[];
        const mat = Array.isArray(m) ? m[0] : m;
        return !(mat && mat.transparent && mat.opacity < 0.35 && !(h.object.parent?.userData?.fixture));
      };
      const hit = hits.find((h) => (h.object as THREE.Mesh).isMesh && visible(h.object) && solid(h));
      const owner = hit && ownerOf(hit.object);
      const mode = useProjectStore.getState().mode;
      if (!owner || owner.mode === mode) return;
      window.clearTimeout(timer);
      setToast({ x: e.clientX, y: e.clientY, owner });
      timer = window.setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp);
      window.clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;
  const label = MODES.find((m) => m.id === toast.owner.mode)?.label ?? toast.owner.mode;
  const place = toast.owner.mode === 'venue' ? 'Backstage & venue' : label;
  return (
    <div className="cross-toast" role="status" style={{ left: toast.x + 14, top: toast.y + 14 }}>
      <span>
        This is {toast.owner.what}. Switch to {place} to edit it.
      </span>
      <button
        className="btn btn--small"
        onClick={() => {
          useProjectStore.getState().setMode(toast.owner.mode);
          // Pick it once its mode is showing.
          window.setTimeout(toast.owner.select, 0);
          setToast(null);
        }}
      >
        Switch
      </button>
    </div>
  );
}
