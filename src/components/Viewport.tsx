import { useEffect, useRef } from 'react';
import { Canvas, events as defaultEvents, useThree } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { getTemplate } from '../templates/registry';
import { useActiveData, useActiveObjects, useActiveParams, useProjectStore } from '../store/useProjectStore';
import { CAMERA_FOV, resetView } from '../helpers/views';
import { CameraRig } from './CameraRig';
import { SceneBoundary, ShadowsOnChange, StageScene } from './StageScene';
import { SetObjectsLayer, handlesFirst } from './objects/SetObjectsLayer';
import { StageSurfacesLayer } from './objects/StageSurfacesLayer';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { reflections, useReflectionsReady } from '../objects/materials';
import { GRAPHIC_DRAG_TYPE, OBJECT_DRAG_TYPE, useObjectUI, viewportBridge } from '../objects/ui';
import { pickFace } from '../objects/pick';
import { assignGraphic, importFiles, importOnto } from '../graphics/library';
import { FaceContextMenu } from './graphics/FaceContextMenu';
import { SeatLayer } from './sightlines/SeatLayer';
import { Capturer } from './export/Capturer';
import { EmptyHint } from './EmptyHint';
import { SeatPanel, ViewTools } from './sightlines/SeatPanel';
import { goToSeat } from './sightlines/seatActions';
import { useSightlines } from '../sightlines/store';
import { useExportState } from '../export/state';
import { addObjectAt, currentStage } from '../objects/actions';
import { floorHeightAt } from '../helpers/stageInfo';
import * as THREE from 'three';


/** Builds a soft studio environment once, used only by reflective materials (metal, glass, mirror). */
function Reflections() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (reflections.env) return;
    const pmrem = new THREE.PMREMGenerator(gl);
    reflections.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    useReflectionsReady.setState({ ready: true });
  }, [gl]);
  return null;
}

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
  const surfaceStyles = useProjectStore((s) => s.surfaceStylesByTemplate[s.templateId]);
  const presentation = useExportState((s) => s.presentation);
  const template = getTemplate(templateId)!;

  const rightDown = useRef<[number, number] | null>(null);
  const leftDown = useRef<[number, number] | null>(null);

  // Re-frame (animated) whenever the template changes. First load is framed by ViewportSync.
  const lastTemplate = useRef(templateId);
  useEffect(() => {
    if (lastTemplate.current === templateId) return;
    lastTemplate.current = templateId;
    const s = useProjectStore.getState();
    requestView(resetView(template.bounds(s.paramsByTemplate[templateId], s.dataByTemplate[templateId]), s.viewportAspect));
  }, [templateId, template, requestView]);

  // Dropping a tile from the object library places that object where it lands on the floor;
  // dropping an image file or a library graphic onto a face puts it on that face.
  const onDrop = (e: React.DragEvent) => {
    const graphicId = e.dataTransfer.getData(GRAPHIC_DRAG_TYPE);
    const files = [...e.dataTransfer.files];
    if (graphicId || files.length) {
      e.preventDefault();
      const target = pickFace(e.clientX, e.clientY);
      if (graphicId && target) assignGraphic(target, graphicId);
      else if (files.length) void (target ? importOnto(target, files) : importFiles(files));
      return;
    }
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
        const t = e.dataTransfer.types;
        if (t.includes(OBJECT_DRAG_TYPE) || t.includes(GRAPHIC_DRAG_TYPE) || t.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={onDrop}
      // Right-click (without dragging, which pans the view) opens the face menu.
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button === 2) rightDown.current = [e.clientX, e.clientY];
        if (e.button === 0) leftDown.current = [e.clientX, e.clientY];
      }}
      onPointerUp={(e) => {
        // Seat view: a click (not a drag) on a seat sits you there.
        const l = leftDown.current;
        leftDown.current = null;
        if (e.button === 0 && l && Math.hypot(e.clientX - l[0], e.clientY - l[1]) < 4) {
          const sl = useSightlines.getState();
          if (sl.seatView && sl.hovered) goToSeat(sl.hovered);
        }
        const start = rightDown.current;
        rightDown.current = null;
        if (e.button !== 2 || !start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 4) return;
        const target = pickFace(e.clientX, e.clientY);
        const rect = e.currentTarget.getBoundingClientRect();
        if (target) useObjectUI.getState().setMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, target });
      }}
    >
      <FaceContextMenu />
      <ViewTools />
      <EmptyHint />
      <SeatPanel />
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
      <SceneBoundary resetKey={objects}>
        <SetObjectsLayer />
      </SceneBoundary>
      <StageSurfacesLayer />
      <SeatLayer />
      <Capturer />
      <Reflections />
      <ShadowsOnChange deps={[template, params, data, units, objects, surfaceStyles, presentation]} />
      <AdaptiveDpr pixelated />
      <CameraRig />
      <ViewportSync />
    </Canvas>
    </div>
  );
}
