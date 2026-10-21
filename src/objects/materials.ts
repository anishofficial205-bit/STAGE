/**
 * Simple procedural materials (no downloads): each is a base colour,
 * roughness/metalness and optionally a greyscale texture that the colour tints.
 * Textures repeat once per metre of face so grain and weave keep a real scale.
 */
import * as THREE from 'three';
import { create } from 'zustand';

export type MaterialId =
  | 'paint'
  | 'wood-light'
  | 'wood-dark'
  | 'painted-wood'
  | 'metal-brushed'
  | 'metal-black'
  | 'fabric'
  | 'concrete'
  | 'glass'
  | 'mirror'
  | 'theatre-black';

/** How a face looks. `graphic` is added by the graphics feature. */
export interface FaceStyle {
  material: MaterialId;
  /** Tint colour (hex). */
  color: string;
  roughness: number;
  graphic?: import('../graphics/types').GraphicPlacement;
}

type Pattern = 'wood' | 'painted-wood' | 'brushed' | 'fabric' | 'concrete' | null;

export interface MaterialDef {
  id: MaterialId;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  pattern: Pattern;
  /** Uses the reflection environment (metals, mirror). */
  reflective?: boolean;
}

export const MATERIALS: MaterialDef[] = [
  { id: 'paint', name: 'Solid colour', color: '#d8d4cc', roughness: 0.8, metalness: 0, pattern: null },
  { id: 'wood-light', name: 'Light wood', color: '#d2ad7c', roughness: 0.65, metalness: 0, pattern: 'wood' },
  { id: 'wood-dark', name: 'Dark wood', color: '#6d4a2e', roughness: 0.6, metalness: 0, pattern: 'wood' },
  { id: 'painted-wood', name: 'Painted wood', color: '#e4dfd3', roughness: 0.7, metalness: 0, pattern: 'painted-wood' },
  { id: 'metal-brushed', name: 'Brushed metal', color: '#c3c7cc', roughness: 0.35, metalness: 0.9, pattern: 'brushed', reflective: true },
  { id: 'metal-black', name: 'Black metal', color: '#2a2c30', roughness: 0.4, metalness: 0.85, pattern: null, reflective: true },
  { id: 'fabric', name: 'Fabric / velvet', color: '#7a1f2b', roughness: 1, metalness: 0, pattern: 'fabric' },
  { id: 'concrete', name: 'Concrete', color: '#a9a8a3', roughness: 0.95, metalness: 0, pattern: 'concrete' },
  { id: 'glass', name: 'Glass', color: '#d6e8f2', roughness: 0.05, metalness: 0, opacity: 0.3, pattern: null, reflective: true },
  { id: 'mirror', name: 'Mirror', color: '#f2f5f7', roughness: 0.03, metalness: 1, pattern: null, reflective: true },
  { id: 'theatre-black', name: 'Matte black (theatre black)', color: '#141517', roughness: 1, metalness: 0, pattern: null },
];

export const getMaterial = (id: MaterialId) => MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];

export const defaultStyle = (id: MaterialId = 'paint'): FaceStyle => {
  const m = getMaterial(id);
  return { material: id, color: m.color, roughness: m.roughness };
};

// --- Procedural textures ---------------------------------------------------------

const SIZE = 512;

/** Deterministic noise so textures are identical every time. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draw(pattern: Exclude<Pattern, null>): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const r = rng(pattern.length * 97);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, SIZE, SIZE);
  if (pattern === 'wood' || pattern === 'painted-wood') {
    // Planks with wavy grain lines; painted wood is the same, much fainter.
    const strength = pattern === 'wood' ? 1 : 0.25;
    const planks = 4;
    for (let p = 0; p < planks; p++) {
      const y0 = (p * SIZE) / planks;
      const tone = 0.82 + r() * 0.18;
      g.fillStyle = `rgba(0,0,0,${(1 - tone) * strength})`;
      g.fillRect(0, y0, SIZE, SIZE / planks);
      for (let l = 0; l < 22; l++) {
        const y = y0 + r() * (SIZE / planks);
        g.strokeStyle = `rgba(60,35,10,${(0.08 + r() * 0.14) * strength})`;
        g.lineWidth = 0.6 + r() * 1.6;
        g.beginPath();
        for (let x = 0; x <= SIZE; x += 16) g.lineTo(x, y + Math.sin(x / (40 + r() * 30) + l) * 3);
        g.stroke();
      }
      g.fillStyle = `rgba(0,0,0,${0.25 * strength})`;
      g.fillRect(0, y0, SIZE, 1.5);
    }
  } else if (pattern === 'brushed') {
    for (let y = 0; y < SIZE; y++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
      g.fillRect(0, y, SIZE, 1);
    }
  } else if (pattern === 'fabric') {
    for (let y = 0; y < SIZE; y += 4) for (let x = 0; x < SIZE; x += 4) {
      g.fillStyle = `rgba(0,0,0,${((x + y) / 4) % 2 ? 0.1 + r() * 0.05 : 0.02})`;
      g.fillRect(x, y, 4, 4);
    }
  } else if (pattern === 'concrete') {
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() > 0.5 ? `rgba(0,0,0,${r() * 0.18})` : `rgba(255,255,255,${r() * 0.2})`;
      const s = 1 + r() * 3;
      g.fillRect(r() * SIZE, r() * SIZE, s, s);
    }
  }
  return c;
}

const bases = new Map<string, THREE.Texture>();
const scaled = new Map<string, THREE.Texture>();

/** Pattern texture repeating once per metre over a face of size w × h (shared GPU image). */
export function patternTexture(pattern: Exclude<Pattern, null>, w: number, h: number): THREE.Texture {
  const key = `${pattern}:${w.toFixed(2)}:${h.toFixed(2)}`;
  const hit = scaled.get(key);
  if (hit) return hit;
  let base = bases.get(pattern);
  if (!base) {
    base = new THREE.CanvasTexture(draw(pattern));
    base.colorSpace = THREE.SRGBColorSpace;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = 4;
    bases.set(pattern, base);
  }
  const t = base.clone(); // shares the image with the base texture
  t.repeat.set(Math.max(0.1, w), Math.max(0.1, h));
  t.needsUpdate = true;
  scaled.set(key, t);
  return t;
}

// --- Reflections -----------------------------------------------------------------

/** A soft studio environment for metals, glass and mirrors (set up once by the viewport). */
export const reflections: { env: THREE.Texture | null } = { env: null };
/** Flips to true once `reflections.env` exists, so reflective faces re-render with it. */
export const useReflectionsReady = create<{ ready: boolean }>(() => ({ ready: false }));

/** Material props for a face style (and a highlight when the face is hovered or selected). */
export function styleProps(style: FaceStyle | undefined, fallbackColor: string, size: { w: number; h: number }) {
  if (!style) return { color: fallbackColor, roughness: 0.85, metalness: 0 } as const;
  const m = getMaterial(style.material);
  return {
    color: style.color,
    roughness: style.roughness,
    metalness: m.metalness,
    map: m.pattern ? patternTexture(m.pattern, size.w, size.h) : null,
    envMap: m.reflective ? reflections.env : null,
    envMapIntensity: m.reflective ? 1 : 0,
    transparent: (m.opacity ?? 1) < 1,
    opacity: m.opacity ?? 1,
    depthWrite: (m.opacity ?? 1) >= 1,
  };
}
