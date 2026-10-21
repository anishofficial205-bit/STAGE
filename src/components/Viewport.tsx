import { useEffect, useRef } from 'react';
import { Canvas, events as defaultEvents, useThree } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { getTemplate } from '../templates/registry';
import { useActiveData, useActiveObjects, useActiveParams, useProjectStore } from '../store/useProjectStore';
import { CAMERA_FOV, resetView } from '../helpers/views';
import { CameraRig } from './CameraRig';
import { ShadowsOnChange, StageScene } from './StageScene';
import { SetObjectsLayer, handlesFirst } from './objects/SetObjectsLayer';
import { OBJECT_DRAG_TYPE, useObjectUI, viewportBridge } from '../objects/ui';
import { addObjectAt, currentStage } from '../objects/actions';
import { floorHeightAt } from '../helpers/stageInfo';
import * as THREE from 'three';


/** Reports the canvas aspect ratio to the store and frames the stage on first load. */
function ViewportSync() {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const setAspect = useProjectStore((s) => s.setViewportAspect);
  const framed = useRef(false);
  // Dev-only hooks for automated checks (camera + store); stripped from production builds.
  const three = useThree();
  viewportBridge.three = three;
  if (import.meta.env.DEV) Object.assign(window, { __three: three, __store: useProjectStore, __objectUI: useObjectUI });
  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    setAspect(width / height);
    if (!framed.current) {
      framed.current = true;
      const s = useProjectStore.getState();
      const t = getTemplate(s.templateId)!;
      s.requestView(resetView(t.bounds(s.paramsByTemplate[s.templateId], s.dataByTemplate[s.templateId]), width / height), true);
    }
  }, [width, height, setAspect]);
  return null;
}

export function Viewport() {
  const templateId = useProjectStore((s) => s.templateId);
  const units = useProjectStore((s) => s.units);
  const requestView = useProjectStore((s) => s.requestView);
  const params = useActiveParams();
  const data = useActiveData();
  const objects = useActiveObjects();
  const template = getTemplate(templateId)!;

  // Re-frame (animated) whenever the template changes. First load is framed by ViewportSync.
  const lastTemplate = useRef(templateId);
  useEffect(() => {
    if (lastTemplate.current === templateId) return;
    lastTemplate.current = templateId;
    const s = useProjectStore.getState();
    requestView(resetView(template.bounds(s.paramsByTemplate[templateId], s.dataByTemplate[templateId]), s.viewportAspect));
  }, [templateId, template, requestView]);

  // Dropping a tile from the object library places that object where it lands on the floor.
  const onDrop = (e: React.DragEvent) => {
    const typeId = e.dataTransfer.getData(OBJECT_DRAG_TYPE);
    const three = viewportBridge.three;
    if (!typeId || !three) return;
    e.preventDefault();
    const rect = three.gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, three.camera);
    const { info } = currentStage();
    const y = floorHeightAt(info, info.centre[0], info.centre[1]);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
    addObjectAt(typeId, hit ? [hit.x, hit.z] : undefined);
  };

  return (
    <div
      className="viewport__drop"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(OBJECT_DRAG_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={onDrop}
    >
    <Canvas
      events={(store) => ({ ...defaultEvents(store), filter: (hits) => handlesFirst(hits) })}
      onPointerMissed={() => useProjectStore.getState().select([])}
      shadows
      dpr={[1, 2]}
      // While orbiting, resolution may drop to half to stay smooth; it recovers when you stop.
      performance={{ min: 0.5 }}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 3000, position: [15, 12, 25] }}
      gl={{ antialias: true }}
    >
      <StageScene template={template} params={params} data={data} />
      <SetObjectsLayer />
      <ShadowsOnChange deps={[template, params, data, units, objects]} />
      <AdaptiveDpr pixelated />
      <CameraRig />
      <ViewportSync />
    </Canvas>
    </div>
  );
}
