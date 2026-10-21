/**
 * Which face is under a screen point: an object face (materials tagged by
 * FaceMat) or a stage surface (tested geometrically, so even surfaces with no
 * style yet can take a dropped graphic).
 */
import * as THREE from 'three';
import { getTemplate } from '../templates/registry';
import { useProjectStore } from '../store/useProjectStore';
import { pointInPolygon } from '../helpers/stageInfo';
import { SURFACE, viewportBridge, type FaceRef } from './ui';

const raycaster = new THREE.Raycaster();

function isHandle(o: THREE.Object3D | null): boolean {
  return !!o && (o.userData?.handle === true || isHandle(o.parent));
}

export function pickFace(clientX: number, clientY: number): FaceRef | null {
  const three = viewportBridge.three;
  if (!three) return null;
  const rect = three.gl.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), three.camera);
  const hits = raycaster.intersectObjects(three.scene.children, true).filter((h) => (h.object as THREE.Mesh).isMesh && h.object.visible && !isHandle(h.object));

  // Nearest object face or styled surface overlay.
  let objectHit: { ref: FaceRef; distance: number } | null = null;
  for (const h of hits) {
    const mesh = h.object as THREE.Mesh;
    const mat = (Array.isArray(mesh.material) ? mesh.material[h.face?.materialIndex ?? 0] : mesh.material) as THREE.Material;
    const ud = mat?.userData ?? {};
    if (typeof ud.surface === 'string') return { objectId: SURFACE, face: ud.surface };
    if (typeof ud.objectId === 'string' && typeof ud.face === 'string') {
      objectHit = { ref: { objectId: ud.objectId, face: ud.face }, distance: h.distance };
      break;
    }
  }

  // Nearest stage surface along the ray.
  const s = useProjectStore.getState();
  const surfaces = getTemplate(s.templateId)!.surfaces(s.paramsByTemplate[s.templateId], s.dataByTemplate[s.templateId]);
  let surfaceHit: { id: string; distance: number } | null = null;
  const p = new THREE.Vector3();
  for (const sf of surfaces) {
    if (sf.width < 0.01 || sf.height < 0.01) continue;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...sf.rotation));
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(...sf.position));
    if (!raycaster.ray.intersectPlane(plane, p)) continue;
    const local = p.clone().sub(new THREE.Vector3(...sf.position)).applyQuaternion(q.clone().invert());
    const inside = sf.outline
      ? pointInPolygon([local.x, local.y], sf.outline) && !(sf.holes ?? []).some((h) => pointInPolygon([local.x, local.y], h))
      : Math.abs(local.x) <= sf.width / 2 && Math.abs(local.y) <= sf.height / 2;
    const d = raycaster.ray.origin.distanceTo(p);
    if (inside && (!surfaceHit || d < surfaceHit.distance)) surfaceHit = { id: sf.id, distance: d };
  }
  // A surface only counts if nothing solid is clearly in front of it.
  const firstSolid = hits[0]?.distance ?? Infinity;
  if (objectHit && (!surfaceHit || objectHit.distance <= surfaceHit.distance + 0.02)) return objectHit.ref;
  if (surfaceHit && surfaceHit.distance <= firstSolid + 0.05) return { objectId: SURFACE, face: surfaceHit.id };
  return objectHit?.ref ?? null;
}
