/**
 * Drawing a prop made from photos: its shape is rebuilt from the saved
 * cut-outs and depth map (once per prop, then shared), with the front photo
 * on the front and the back photo (or a darker copy of the front) on the back.
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { getProp, type PhotoProp } from './store';
import { buildPropGeometry, type Outline } from './mesh';
import { readGlb } from './modelImport';

interface Built {
  geometry: THREE.BufferGeometry;
  front: THREE.MeshStandardMaterial;
  back: THREE.MeshStandardMaterial;
}

const built = new Map<string, Promise<Built | null>>();

async function pixels(b: Blob) {
  const bmp = await createImageBitmap(b);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return { canvas: c, data: ctx.getImageData(0, 0, c.width, c.height) };
}

const alphaOf = (d: ImageData): Outline => {
  const a = new Uint8Array(d.width * d.height);
  for (let i = 0; i < a.length; i++) a[i] = d.data[i * 4 + 3];
  return { width: d.width, height: d.height, alpha: a };
};

function texture(c: OffscreenCanvas) {
  const t = new THREE.CanvasTexture(c as unknown as HTMLCanvasElement);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Build (or reuse) the 3D shape and materials of a prop. */
export function buildProp(p: PhotoProp): Promise<Built | null> {
  const key = `${p.id}:${p.savedAt}`;
  let b = built.get(key);
  if (!b) {
    b = (async () => {
      const front = await pixels(p.front!);
      const depth = p.depthMap ? await pixels(p.depthMap) : null;
      const side = p.side ? await pixels(p.side) : null;
      const back = p.back ? await pixels(p.back) : null;
      let depthGray: Uint8Array | null = null;
      if (depth && depth.data.width === front.data.width && depth.data.height === front.data.height) {
        depthGray = new Uint8Array(depth.data.width * depth.data.height);
        for (let i = 0; i < depthGray.length; i++) depthGray[i] = depth.data.data[i * 4];
      }
      const geometry = buildPropGeometry(alphaOf(front.data), depthGray, side ? alphaOf(side.data) : null, p.mode, p.detail ?? 0.5);
      const frontTex = texture(front.canvas);
      const frontMat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.75, metalness: 0 });
      const backMat = back ? new THREE.MeshStandardMaterial({ map: texture(back.canvas), roughness: 0.75 }) : new THREE.MeshStandardMaterial({ map: frontTex, color: '#9a9a9a', roughness: 0.8 });
      return { geometry, front: frontMat, back: backMat };
    })().catch(() => null);
    built.set(key, b);
  }
  return b;
}

/** One of My props (from photos or an imported model), sized to width × height × depth (metres), standing on y = 0. */
export function PhotoPropModel({ id, width, height, depth }: { id: string; width: number; height: number; depth: number }) {
  const [model, setModel] = useState<Built | THREE.Object3D | null | 'missing'>(null);
  useEffect(() => {
    let live = true;
    setModel(null);
    void getProp(id)
      .then((p): Promise<Built | THREE.Object3D | null> | null => (!p ? null : p.model ? readGlb(`${p.id}:${p.savedAt}`, p.model).then((o) => o?.clone(true) ?? null) : buildProp(p)))
      .then((b) => live && setModel(b ?? 'missing'));
    return () => {
      live = false;
    };
  }, [id]);
  if (model instanceof THREE.Object3D) return <primitive object={model} scale={[width, height, depth]} />;
  if (!model || model === 'missing')
    return (
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={model === 'missing' ? '#b4554a' : '#8d8d88'} transparent opacity={0.6} />
      </mesh>
    );
  return <mesh geometry={model.geometry} material={[model.front, model.back]} scale={[width, height, depth]} castShadow receiveShadow />;
}
