/**
 * FaceMat — the material for one named face of a set object. It applies the
 * face's colour/material (or the object's "all faces" style), highlights when
 * the face is hovered or selected in the panel, and tags itself with the
 * face id so Alt-click and file drops can tell which face was hit.
 */
import { createContext, useContext } from 'react';
import * as THREE from 'three';
import { useObjectUI } from './ui';
import { styleProps, useReflectionsReady, type FaceStyle } from './materials';
import { usePlacedGraphic } from '../graphics/usePlaced';

export interface FaceContext {
  objectId: string;
  styles: Record<string, FaceStyle>;
  sizes: Record<string, { w: number; h: number }>;
}

export const ObjectFaces = createContext<FaceContext | null>(null);

/** The face key used for parts that aren't a named face, and for "apply to all faces". */
export const ALL_FACES = '*';

const HIGHLIGHT = new THREE.Color('#2f6fde');

/** Things that change a material's compiled shader. */
export const shaderKey = (map: unknown, envMap: unknown, transparent: unknown, emissiveMap: unknown, fit: boolean) =>
  `${map ? 'm' : '-'}${envMap ? 'e' : '-'}${transparent ? 't' : '-'}${emissiveMap ? 'g' : '-'}${fit ? 'f' : '-'}`;

export interface FaceMatProps {
  face?: string;
  color: string;
  side?: THREE.Side;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  /** For lit surfaces (LED walls): their own glow, kept unless a style overrides it. */
  emissive?: string;
  emissiveIntensity?: number;
  emissiveMap?: THREE.Texture | null;
  map?: THREE.Texture | null;
  attach?: string;
  /** How the face looks until the user styles it (e.g. curtains default to velour in their colour). */
  defaultStyle?: FaceStyle;
}

export function FaceMat({ face, color, side, opacity = 1, roughness = 0.85, metalness = 0, emissive, emissiveIntensity, emissiveMap, map, attach, defaultStyle }: FaceMatProps) {
  const ctx = useContext(ObjectFaces);
  useReflectionsReady((s) => s.ready); // re-render once reflections exist
  const id = face ?? ALL_FACES;
  const highlighted = useObjectUI((s) => !!ctx && ((s.hoverFace?.objectId === ctx.objectId && (s.hoverFace.face === id || s.hoverFace.face === ALL_FACES)) || (s.selectedFace?.objectId === ctx.objectId && s.selectedFace.face === id)));
  const style = (ctx ? ctx.styles[id] ?? ctx.styles[ALL_FACES] : undefined) ?? defaultStyle;
  const size = ctx?.sizes[id] ?? { w: 1, h: 1 };
  const styled = style && styleProps(style, color, size);
  // A see-through part (a scrim) stays see-through when it is styled or printed.
  const sheer = styled && opacity < 1 ? { transparent: true, opacity: ('opacity' in styled ? (styled.opacity as number) : 1) * opacity, depthWrite: false } : {};
  const props = styled ? { ...styled, ...sheer } : { color, roughness, metalness, map: map ?? null, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 };
  const graphic = usePlacedGraphic(style?.graphic, size);
  // Lit faces (LED walls) show their graphic as light, not just paint.
  const glow = graphic && emissiveMap !== undefined ? graphic.map : emissiveMap ?? null;
  const final = { ...props, ...(graphic ?? {}) };
  return (
    <meshStandardMaterial
      // three.js only recompiles a material's shader when told to; remounting whenever a map,
      // reflections, transparency or the Fit patch come or go keeps it simple and correct.
      key={shaderKey(final.map, 'envMap' in final ? final.envMap : null, final.transparent, glow, !!graphic?.onBeforeCompile)}
      attach={attach}
      {...props}
      {...(graphic ?? {})}
      side={side}
      emissive={highlighted ? HIGHLIGHT : emissive ?? '#000000'}
      emissiveIntensity={highlighted ? 0.45 : emissiveIntensity ?? 0}
      emissiveMap={highlighted ? null : glow}
      userData={{ face: id, objectId: ctx?.objectId }}
    />
  );
}
