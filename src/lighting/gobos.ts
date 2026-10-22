/**
 * Gobos: black-and-white patterns a profile projects (used as the spot
 * light's map: white lets light through). Built-in ones are drawn here; users
 * can upload their own (kept in IndexedDB as gobo-<id>).
 */
import * as THREE from 'three';
import { create } from 'zustand';
import { getBlob, putBlob } from '../graphics/db';
import { lightId } from './types';

export const GOBOS: { id: string; name: string }[] = [
  { id: 'leaves', name: 'Leaves' },
  { id: 'window', name: 'Window' },
  { id: 'stars', name: 'Stars' },
  { id: 'breakup', name: 'Breakup' },
  { id: 'lines', name: 'Lines' },
  { id: 'circle', name: 'Circle' },
];

const S = 256;

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw a built-in pattern. Everything outside the round gate is black. */
export function drawGobo(id: string, size = S): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const k = size / S;
  g.scale(k, k);
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#fff';
  const r = rng(id.length * 977 + id.charCodeAt(0));
  if (id === 'window') {
    g.fillRect(40, 40, 176, 176);
    g.fillStyle = '#000';
    g.fillRect(122, 40, 12, 176);
    g.fillRect(40, 122, 176, 12);
  } else if (id === 'stars') {
    for (let i = 0; i < 60; i++) {
      g.beginPath();
      g.arc(r() * S, r() * S, 1.5 + r() * 4, 0, Math.PI * 2);
      g.fill();
    }
  } else if (id === 'lines') {
    for (let x = 18; x < S; x += 34) g.fillRect(x, 0, 14, S);
  } else if (id === 'circle') {
    g.beginPath();
    g.arc(S / 2, S / 2, 70, 0, Math.PI * 2);
    g.fill();
  } else {
    // Leaves: light through gaps between dark leaf shapes; breakup: soft blotches.
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#000';
    const n = id === 'leaves' ? 46 : 30;
    for (let i = 0; i < n; i++) {
      g.save();
      g.translate(r() * S, r() * S);
      g.rotate(r() * Math.PI);
      g.beginPath();
      if (id === 'leaves') g.ellipse(0, 0, 10 + r() * 18, 4 + r() * 8, 0, 0, Math.PI * 2);
      else g.arc(0, 0, 10 + r() * 26, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  // Round gate.
  g.globalCompositeOperation = 'destination-in';
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  return c;
}

export const goboKey = (id: string) => `gobo-${id}`;

/** Textures for gobos (built-in drawn now; uploaded ones loaded from IndexedDB). */
export const useGoboTextures = create<{ textures: Record<string, THREE.Texture> }>(() => ({ textures: {} }));

export function goboTexture(id: string): THREE.Texture | null {
  const have = useGoboTextures.getState().textures[id];
  if (have) return have;
  if (GOBOS.some((g) => g.id === id)) {
    const t = new THREE.CanvasTexture(drawGobo(id));
    t.colorSpace = THREE.SRGBColorSpace;
    useGoboTextures.setState((s) => ({ textures: { ...s.textures, [id]: t } }));
    return t;
  }
  // Uploaded: load once, then the store update re-renders whoever asked.
  void getBlob(goboKey(id)).then(async (b) => {
    if (!b || useGoboTextures.getState().textures[id]) return;
    const img = await createImageBitmap(b);
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 512, 512);
    const k = 512 / Math.max(img.width, img.height);
    g.drawImage(img, (512 - img.width * k) / 2, (512 - img.height * k) / 2, img.width * k, img.height * k);
    // Black and white: brightness only.
    const d = g.getImageData(0, 0, 512, 512);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2];
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    useGoboTextures.setState((s) => ({ textures: { ...s.textures, [id]: t } }));
  });
  return null;
}

/** Store an uploaded gobo image; returns its id. */
export async function uploadGobo(file: File) {
  const id = lightId('u');
  await putBlob(goboKey(id), file);
  return { id, name: file.name.replace(/\.[^.]+$/, '') };
}
