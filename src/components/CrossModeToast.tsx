import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { viewportBridge } from '../objects/ui';
import { useProjectStore } from '../store/useProjectStore';
import { DOMAIN_MODE, editIn, type Pick } from './layers/selection';
import { deleteItem, useItemMenu } from './layers/ItemMenu';
import { usePlacing } from '../objects/placing';
import { useLightPlacing } from '../lighting/moods';
import { MODES, type Mode } from '../modes';

interface Owner {
  mode: Mode;
  what: string;
  pick: Pick;
}

const owner = (what: string, domain: Pick['domain'], kind: string, id: string): Owner => ({ mode: DOMAIN_MODE[domain], what, pick: { domain, kind, ids: [id] } });

/** Which mode owns a 3D object, from the markers each layer puts in userData. */
function ownerOf(o: THREE.Object3D | null): Owner | null {
  for (let p = o; p; p = p.parent) {
    const u = p.userData ?? {};
    if (u.fixture) return owner('a light', 'lights', 'fixture', u.fixture);
    if (u.lightPosition) return owner('a light bar', 'lights', 'position', u.lightPosition);
    if (u.performer) return owner('a performer', 'performers', 'performer', u.performer);
    if (u.objectId) return owner('a set piece', 'set', 'object', u.objectId);
    if (u.venueRoom) return owner('a room', 'venue', 'room', u.venueRoom);
    if (u.venueWall) return owner('a wall', 'venue', 'wall', u.venueWall);
    if (u.venueDoor) return owner('a door', 'venue', 'door', u.venueDoor);
    if (u.venueFurniture) return owner('furniture', 'venue', 'furniture', u.venueFurniture);
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
      down = e.button === 0 || e.button === 2 ? [e.clientX, e.clientY] : null;
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
        // Things faded because they belong to another mode count as they really are.
        const orig = mat?.userData?.dim?.orig as { transparent: boolean; opacity: number } | undefined;
        const transparent = orig ? orig.transparent : mat?.transparent;
        const opacity = orig ? orig.opacity : mat?.opacity ?? 1;
        return !(mat && transparent && opacity < 0.35 && !(h.object.parent?.userData?.fixture));
      };
      const hit = hits.find((h) => (h.object as THREE.Mesh).isMesh && visible(h.object) && solid(h));
      const owner = hit && ownerOf(hit.object);
      const mode = useProjectStore.getState().mode;
      if (!owner) return;
      // Right-click on anything, from any mode: the item menu (set pieces in Set get the face menu, which has the same actions).
      if (e.button === 2) {
        if (mode === 'set' && owner.mode === 'set') return;
        const p = owner.pick;
        useItemMenu.getState().open({ item: { domain: p.domain, kind: p.kind, id: p.ids[0] }, pick: p, x: e.clientX, y: e.clientY });
        return;
      }
      if (owner.mode === mode) return;
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
          editIn(toast.owner.pick);
          setToast(null);
        }}
      >
        Switch
      </button>
      <button
        className="btn btn--small btn--danger"
        onClick={() => {
          const p = toast.owner.pick;
          deleteItem({ domain: p.domain, kind: p.kind, id: p.ids[0] });
          setToast(null);
        }}
      >
        Delete
      </button>
    </div>
  );
}
