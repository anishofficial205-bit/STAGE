/**
 * Colours, materials (and later graphics) on the stage template's own
 * surfaces: a thin overlay is drawn just in front of each styled surface,
 * shaped like it (circles, thrust outlines, arch frames). A surface hovered
 * or selected in the panel shows a blue tint even when it has no style yet.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { getTemplate } from '../../templates/registry';
import { useActiveData, useActiveParams, useProjectStore } from '../../store/useProjectStore';
import { styleProps, type FaceStyle } from '../../objects/materials';
import { SURFACE, useObjectUI } from '../../objects/ui';
import type { Surface } from '../../types';
import { usePlacedGraphic } from '../../graphics/usePlaced';
import { shaderKey } from '../../objects/faceMaterial';

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

function Overlay({ surface, style, highlight }: { surface: Surface; style?: FaceStyle; highlight: boolean }) {
  const geometry = useMemo(() => surfaceGeometry(surface), [surface]);
  const euler = new THREE.Euler(...surface.rotation);
  const n = new THREE.Vector3(0, 0, 1).applyEuler(euler).multiplyScalar(OFFSET);
  const size = surfaceSize(surface);
  const props = style ? styleProps(style, '#ffffff', size) : { color: '#2f6fde', transparent: true, opacity: 0.25, depthWrite: false };
  const graphic = usePlacedGraphic(style?.graphic, size);
  const glow = !!graphic && !!surface.glow;
  return (
    <mesh geometry={geometry} position={[surface.position[0] + n.x, surface.position[1] + n.y, surface.position[2] + n.z]} rotation={euler} receiveShadow>
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
  const surfaces = useMemo(() => getTemplate(templateId)!.surfaces(params, data).filter((s) => s.width > 0.01 && s.height > 0.01), [templateId, params, data]);
  return (
    <>
      {surfaces.map((s) => {
        const style = styles?.[s.id];
        const highlight = hover === s.id || picked === s.id;
        if (!style && !highlight) return null;
        return <Overlay key={s.id} surface={s} style={style} highlight={highlight} />;
      })}
    </>
  );
}
