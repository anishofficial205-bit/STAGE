/**
 * Colours, materials (and later graphics) on the stage template's own
 * surfaces: a thin overlay is drawn just in front of each styled surface,
 * shaped like it (circles, thrust outlines, arch frames). A surface hovered
 * or selected in the panel shows a blue tint even when it has no style yet.
 */
import { useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { getTemplate } from '../../templates/registry';
import { useActiveData, useActiveParams, useProjectStore } from '../../store/useProjectStore';
import { styleProps, type FaceStyle } from '../../objects/materials';
import { SURFACE, useObjectUI } from '../../objects/ui';
import type { Surface } from '../../types';
import { usePlacedGraphic } from '../../graphics/usePlaced';
import { updatePlacement } from '../../graphics/library';
import { panBy } from '../../graphics/placement';
import type { GraphicPlacement } from '../../graphics/types';
import { shaderKey } from '../../objects/faceMaterial';
import { useExportState } from '../../export/state';

const OFFSET = 0.004; // metres in front of the real surface

export function surfaceGeometry(s: Surface): THREE.BufferGeometry {
  if (!s.outline) return new THREE.PlaneGeometry(s.width, s.height);
  const shape = new THREE.Shape(s.outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of s.holes ?? []) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ShapeGeometry(shape, 48);
  // UVs 0–1 over the outline's box, so graphics fit the visible shape.
  const xs = s.outline.map((p) => p[0]);
  const ys = s.outline.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pos = g.attributes.position;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0 || 1), (pos.getY(i) - y0) / (y1 - y0 || 1));
  return g;
}

/** Size used for material textures and graphic fitting: the outline's box, or width × height. */
export function surfaceSize(s: Surface) {
  if (!s.outline) return { w: s.width, h: s.height };
  const xs = s.outline.map((p) => p[0]);
  const ys = s.outline.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Drag on a surface while "repositioning" its graphic to pan the image. */
function useSurfacePan(surface: Surface, style: FaceStyle | undefined) {
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const drag = useRef<{ uv0: THREE.Vector2; g: GraphicPlacement; aspect: number } | null>(null);
  const size = surfaceSize(surface);
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      const ui = useObjectUI.getState();
      const g = style?.graphic;
      const meta = g && useProjectStore.getState().graphics[g.id];
      if (!ui.repositioning || ui.selectedFace?.objectId !== SURFACE || ui.selectedFace.face !== surface.id || !e.uv || !g || !meta || (g.fit !== 'fill' && g.fit !== 'tile')) return;
      e.stopPropagation();
      drag.current = { uv0: e.uv.clone(), g, aspect: meta.width / meta.height };
      (e.target as unknown as Element).setPointerCapture(e.pointerId);
      if (controls) controls.enabled = false;
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current;
      if (!d || !e.uv) return;
      e.stopPropagation();
      updatePlacement({ objectId: SURFACE, face: surface.id }, panBy(d.g, size, d.aspect, e.uv.x - d.uv0.x, e.uv.y - d.uv0.y), `pan:surface:${surface.id}`);
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (!drag.current) return;
      drag.current = null;
      (e.target as unknown as Element).releasePointerCapture(e.pointerId);
      if (controls) controls.enabled = true;
    },
  };
}

function Overlay({ surface, style, highlight }: { surface: Surface; style?: FaceStyle; highlight: boolean }) {
  const geometry = useMemo(() => surfaceGeometry(surface), [surface]);
  const pan = useSurfacePan(surface, style);
  const euler = new THREE.Euler(...surface.rotation);
  const n = new THREE.Vector3(0, 0, 1).applyEuler(euler).multiplyScalar(OFFSET);
  const size = surfaceSize(surface);
  const props = style ? styleProps(style, '#ffffff', size) : { color: '#2f6fde', transparent: true, opacity: 0.25, depthWrite: false };
  const graphic = usePlacedGraphic(style?.graphic, size);
  const glow = !!graphic && !!surface.glow;
  return (
    <mesh geometry={geometry} position={[surface.position[0] + n.x, surface.position[1] + n.y, surface.position[2] + n.z]} rotation={euler} receiveShadow {...pan}>
      <meshStandardMaterial
        key={shaderKey(graphic?.map ?? ('map' in props ? props.map : null), 'envMap' in props ? props.envMap : null, graphic ? graphic.transparent : props.transparent, glow, !!graphic?.onBeforeCompile)}
        {...props}
        {...(graphic ?? {})}
        {...(glow ? { emissiveMap: graphic!.map, emissive: '#ffffff', emissiveIntensity: 0.9 } : {})}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        {...(glow ? {} : { emissive: highlight && style ? '#2f6fde' : '#000000', emissiveIntensity: highlight && style ? 0.35 : 0 })}
        userData={{ surface: surface.id }}
      />
    </mesh>
  );
}

export function StageSurfacesLayer() {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useActiveParams();
  const data = useActiveData();
  const styles = useProjectStore((s) => s.surfaceStylesByTemplate[s.templateId]);
  const hover = useObjectUI((s) => (s.hoverFace?.objectId === SURFACE ? s.hoverFace.face : null));
  const picked = useObjectUI((s) => (s.selectedFace?.objectId === SURFACE ? s.selectedFace.face : null));
  const exporting = useExportState((s) => s.exporting);
  const surfaces = useMemo(() => getTemplate(templateId)!.surfaces(params, data).filter((s) => s.width > 0.01 && s.height > 0.01), [templateId, params, data]);
  return (
    <>
      {surfaces.map((s) => {
        const style = styles?.[s.id];
        const highlight = !exporting && (hover === s.id || picked === s.id);
        if (!style && !highlight) return null;
        return <Overlay key={s.id} surface={s} style={style} highlight={highlight} />;
      })}
    </>
  );
}
