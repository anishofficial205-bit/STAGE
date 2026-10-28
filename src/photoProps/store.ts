/**
 * "My props": props made from photos or imported as 3D models, kept in IndexedDB so every project in
 * this browser can use them (and copied into a project's .zip when it uses
 * them). Each keeps its cut-out photos and the AI depth map; the 3D shape is
 * rebuilt from them when needed.
 */
import { create } from 'zustand';
import { PROPS, deleteRecord, getAllRecords, getRecord, putRecord } from '../graphics/db';

export type PropMode = 'cutout' | 'solid';

export interface PhotoProp {
  id: string;
  name: string;
  savedAt: number;
  /** Small picture for the library (data URL). */
  thumbnail: string;
  mode: PropMode;
  /** How much of the AI depth shows on top of the rounded shape (0 none … 1 strong). */
  detail?: number;
  /** Real size in metres (width across the front, depth front-to-back). */
  width: number;
  height: number;
  depth: number;
  /** Made from photos, or an imported 3D model. */
  kind?: 'photo' | 'model';
  /** Imported model: the shape fitted into a 1 × 1 × 1 box (.glb), scaled to the real size when placed. */
  model?: Blob;
  /** Front photo cropped to the prop, with the background made transparent (PNG). Photo props only. */
  front?: Blob;
  /** How near each pixel of the front is (brighter = nearer), same size as `front` (PNG). */
  depthMap?: Blob;
  /** Side photo, cut out the same way (gives the thickness, top to bottom). */
  side?: Blob;
  /** Back photo, cut out (the picture on the back). */
  back?: Blob;
}

const isProp = (p: unknown): p is PhotoProp => !!p && typeof (p as PhotoProp).id === 'string' && ((p as PhotoProp).front instanceof Blob || (p as PhotoProp).model instanceof Blob);

export const useMyProps = create<{ list: PhotoProp[]; loaded: boolean }>(() => ({ list: [], loaded: false }));

export async function refreshMyProps() {
  try {
    const list = (await getAllRecords<PhotoProp>(PROPS)).filter(isProp).sort((a, b) => b.savedAt - a.savedAt);
    useMyProps.setState({ list, loaded: true });
  } catch {
    useMyProps.setState({ loaded: true });
  }
}

const cache = new Map<string, Promise<PhotoProp | undefined>>();

/** A prop by id (cached). */
export function getProp(id: string) {
  let p = cache.get(id);
  if (!p) {
    p = getRecord<PhotoProp>(PROPS, id).catch(() => undefined);
    cache.set(id, p);
  }
  return p;
}

export async function saveProp(p: PhotoProp) {
  await putRecord(PROPS, p.id, p);
  cache.set(p.id, Promise.resolve(p));
  await refreshMyProps();
}

export async function renameProp(id: string, name: string) {
  const p = await getProp(id);
  if (p) await saveProp({ ...p, name });
}

export async function deleteProp(id: string) {
  await deleteRecord(PROPS, id);
  cache.delete(id);
  await refreshMyProps();
}

export const newPropId = () => `pp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
