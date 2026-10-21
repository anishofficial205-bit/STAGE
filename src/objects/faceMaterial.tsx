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

export interface FaceContext {
  objectId: string;
  styles: Record<string, FaceStyle>;
  sizes: Record<string, { w: number; h: number }>;
}

export const ObjectFaces = createContext<FaceContext | null>(null);

/** The face key used for parts that aren't a named face, and for "apply to all faces". */
export const ALL_FACES = '*';

const HIGHLIGHT = new THREE.Color('#2f6fde');

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
}

export function FaceMat({ face, color, side, opacity = 1, roughness = 0.85, metalness = 0, emissive, emissiveIntensity, emissiveMap, map, attach }: FaceMatProps) {
  const ctx = useContext(ObjectFaces);
  useReflectionsReady((s) => s.ready); // re-render once reflections exist
  const id = face ?? ALL_FACES;
  const highlighted = useObjectUI((s) => !!ctx && ((s.hoverFace?.objectId === ctx.objectId && (s.hoverFace.face === id || s.hoverFace.face === ALL_FACES)) || (s.selectedFace?.objectId === ctx.objectId && s.selectedFace.face === id)));
  const style = ctx ? ctx.styles[id] ?? ctx.styles[ALL_FACES] : undefined;
  const size = ctx?.sizes[id] ?? { w: 1, h: 1 };
  const props = style ? styleProps(style, color, size) : { color, roughness, metalness, map: map ?? null, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 };
  return (
    <meshStandardMaterial
      attach={attach}
      {...props}
      side={side}
      emissive={highlighted ? HIGHLIGHT : emissive ?? '#000000'}
      emissiveIntensity={highlighted ? 0.45 : emissiveIntensity ?? 0}
      emissiveMap={highlighted ? null : emissiveMap ?? null}
      userData={{ face: id, objectId: ctx?.objectId }}
    />
  );
}
