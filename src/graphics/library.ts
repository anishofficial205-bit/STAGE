/**
 * The graphics library: importing files (JPG, PNG, WebP, SVG, PDF), loading
 * them into textures, replacing artwork everywhere it's used, putting a
 * graphic on a face, and zip export/import of a project with its images.
 */
import * as THREE from 'three';
import { create } from 'zustand';
import JSZip from 'jszip';
import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { newObjectId } from '../store/ids';
import { defaultStyle, type FaceStyle } from '../objects/materials';
import { SURFACE, type FaceRef } from '../objects/ui';
import { getBlob, putBlob } from './db';
import { defaultPlacement, type GraphicMeta, type GraphicPlacement } from './types';

/** Biggest texture side we upload (most laptop GPUs handle 4096 comfortably). */
const MAX_TEXTURE = 4096;

export const ACCEPT = '.jpg,.jpeg,.png,.webp,.svg,.pdf,image/jpeg,image/png,image/webp,image/svg+xml,application/pdf';

// --- Runtime textures --------------------------------------------------------------

type Entry = THREE.Texture | 'loading' | 'missing';
export const useGraphicsRuntime = create<{ textures: Record<string, Entry>; urls: Record<string, string> }>(() => ({ textures: {}, urls: {} }));

function setEntry(id: string, e: Entry) {
  useGraphicsRuntime.setState((s) => ({ textures: { ...s.textures, [id]: e } }));
}

async function decode(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

/** Draw an image to a canvas no bigger than `max` on its long side (SVGs are drawn at that size). */
function toCanvas(img: HTMLImageElement, max: number, scaleUp: boolean) {
  const w = img.naturalWidth || 1024;
  const h = img.naturalHeight || 1024;
  const k = scaleUp ? max / Math.max(w, h) : Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

async function loadTexture(id: string) {
  setEntry(id, 'loading');
  try {
    const blob = await getBlob(id);
    if (!blob) return setEntry(id, 'missing');
    const img = await decode(blob);
    const svg = blob.type === 'image/svg+xml';
    const big = Math.max(img.naturalWidth, img.naturalHeight) > MAX_TEXTURE;
    const source = svg || big ? toCanvas(img, svg ? 2048 : MAX_TEXTURE, svg) : img;
    const t = new THREE.Texture(source);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    setEntry(id, t);
  } catch {
    setEntry(id, 'missing');
  }
}

/** The loaded texture for a graphic (null while loading or if the file is missing). */
export function useGraphicTexture(id: string | undefined): THREE.Texture | null {
  const entry = useGraphicsRuntime((s) => (id ? s.textures[id] : undefined));
  useEffect(() => {
    if (id && entry === undefined) void loadTexture(id);
  }, [id, entry]);
  return entry instanceof THREE.Texture ? entry : null;
}

/** An object URL for showing a graphic's thumbnail in the panel. */
export function useGraphicUrl(id: string): string | null {
  const url = useGraphicsRuntime((s) => s.urls[id]);
  useEffect(() => {
    if (url) return;
    void getBlob(id).then((b) => b && useGraphicsRuntime.setState((s) => ({ urls: { ...s.urls, [id]: URL.createObjectURL(b) } })));
  }, [id, url]);
  return url ?? null;
}

/** Forget a graphic's loaded texture and thumbnail so they reload (after replacing the file). */
function refresh(id: string) {
  useGraphicsRuntime.setState((s) => {
    const t = s.textures[id];
    if (t instanceof THREE.Texture) t.dispose();
    const { [id]: _t, ...textures } = s.textures; // eslint-disable-line @typescript-eslint/no-unused-vars
    const { [id]: _u, ...urls } = s.urls; // eslint-disable-line @typescript-eslint/no-unused-vars
    return { textures, urls };
  });
}

// --- PDF page picking -------------------------------------------------------------

export interface PdfRequest {
  name: string;
  pages: number;
  thumbs: string[];
  resolve: (page: number | null) => void;
}
/** The open "pick a PDF page" dialog, if any. */
export const usePdfPicker = create<{ request: PdfRequest | null }>(() => ({ request: null }));

async function pdfToPng(file: File): Promise<{ blob: Blob; width: number; height: number; page: number } | null> {
  const { openPdf, renderPage } = await import('./pdf');
  const doc = await openPdf(file);
  let page = 1;
  if (doc.numPages > 1) {
    const thumbs: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 24); i++) thumbs.push((await renderPage(doc, i, 160)).toDataURL('image/png'));
    const chosen = await new Promise<number | null>((resolve) => usePdfPicker.setState({ request: { name: file.name, pages: doc.numPages, thumbs, resolve } }));
    usePdfPicker.setState({ request: null });
    if (!chosen) return null;
    page = chosen;
  }
  // Render big enough for print checks: 4000 px on the long side.
  const canvas = await renderPage(doc, page, 4000);
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
  return { blob, width: canvas.width, height: canvas.height, page };
}

// --- Importing --------------------------------------------------------------------

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isSvg = (f: File) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);
const isRaster = (f: File) => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
export const isSupported = (f: File) => isPdf(f) || isSvg(f) || isRaster(f);

/** Read a file into stored image + metadata (keeping `id` when replacing). */
async function store(file: File, id: string): Promise<GraphicMeta | null> {
  const name = file.name.replace(/\.[^.]+$/, '');
  if (isPdf(file)) {
    const r = await pdfToPng(file);
    if (!r) return null;
    await putBlob(id, r.blob);
    return { id, name, width: r.width, height: r.height, mime: 'image/png', bytes: r.blob.size, vector: true, page: r.page };
  }
  const blob = isSvg(file) && !file.type ? new Blob([file], { type: 'image/svg+xml' }) : file;
  const img = await decode(blob);
  await putBlob(id, blob);
  return { id, name, width: img.naturalWidth || 1024, height: img.naturalHeight || 1024, mime: blob.type || 'image/png', bytes: blob.size, vector: isSvg(file) };
}

/** Add files to the library. Returns the new graphics (unsupported files are skipped). */
export async function importFiles(files: File[]): Promise<GraphicMeta[]> {
  const metas: GraphicMeta[] = [];
  for (const f of files.filter(isSupported)) {
    const m = await store(f, newObjectId());
    if (m) metas.push(m);
  }
  useProjectStore.getState().addGraphics(metas);
  return metas;
}

/** Replace a library graphic's artwork: every face using it updates. */
export async function replaceGraphic(id: string, file: File) {
  if (!isSupported(file)) return;
  const m = await store(file, id);
  if (!m) return;
  refresh(id);
  useProjectStore.getState().updateGraphic(m);
}

// --- Putting graphics on faces ------------------------------------------------------

function styleOf(target: FaceRef): FaceStyle | undefined {
  const s = useProjectStore.getState();
  if (target.objectId === SURFACE) return s.surfaceStylesByTemplate[s.templateId]?.[target.face];
  const o = (s.objectsByTemplate[s.templateId] ?? []).find((x) => x.id === target.objectId);
  return o?.faces?.[target.face] ?? o?.faces?.['*'];
}

function setStyle(target: FaceRef, style: FaceStyle | null, key?: string) {
  const s = useProjectStore.getState();
  if (target.objectId === SURFACE) s.setSurfaceStyle(target.face, style, key);
  else s.setFaceStyle(target.objectId, target.face, style, key);
}

/** Put a library graphic on a face (white base so the artwork isn't tinted). */
export function assignGraphic(target: FaceRef, graphicId: string, key?: string) {
  const current = styleOf(target);
  // Keep the face's material, but make it white so the artwork isn't tinted; keep an existing placement.
  setStyle(target, { ...(current ?? defaultStyle()), color: '#ffffff', graphic: current?.graphic ? { ...current.graphic, id: graphicId } : defaultPlacement(graphicId) }, key);
}

/** Change how the graphic sits on a face. */
export function updatePlacement(target: FaceRef, change: Partial<GraphicPlacement>, key?: string) {
  const current = styleOf(target);
  if (!current?.graphic) return;
  setStyle(target, { ...current, graphic: { ...current.graphic, ...change } }, key);
}

export function removeFaceGraphic(target: FaceRef) {
  const current = styleOf(target);
  if (!current?.graphic) return;
  const { graphic: _g, ...rest } = current; // eslint-disable-line @typescript-eslint/no-unused-vars
  setStyle(target, rest);
}

/** Import files and put the first one on a face (e.g. dropped from the desktop). */
export async function importOnto(target: FaceRef, files: File[]) {
  const metas = await importFiles(files);
  if (metas[0]) assignGraphic(target, metas[0].id, '@merge');
}

/** How many faces/surfaces use each graphic (across all templates). */
export function usageCounts(): Record<string, number> {
  const s = useProjectStore.getState();
  const n: Record<string, number> = {};
  const count = (styles?: Record<string, FaceStyle>) => {
    for (const v of Object.values(styles ?? {})) if (v.graphic) n[v.graphic.id] = (n[v.graphic.id] ?? 0) + 1;
  };
  for (const list of Object.values(s.objectsByTemplate)) for (const o of list) count(o.faces);
  for (const st of Object.values(s.surfaceStylesByTemplate)) count(st);
  return n;
}

// --- Project zip ------------------------------------------------------------------

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

/** project.json plus every library image in images/. */
export async function exportZip(): Promise<Blob> {
  const s = useProjectStore.getState();
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(s.toFile(), null, 2));
  for (const g of Object.values(s.graphics)) {
    const blob = await getBlob(g.id);
    if (blob) zip.file(`images/${g.id}.${EXT[g.mime] ?? 'bin'}`, blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/** Restore a zip export: images go back into IndexedDB under their ids, then the project loads. */
export async function importZip(file: Blob) {
  const zip = await JSZip.loadAsync(file);
  const json = zip.file('project.json');
  if (!json) throw new Error('This zip has no project.json — it is not a Stage Builder export.');
  const project = JSON.parse(await json.async('string'));
  const metas: Record<string, GraphicMeta> = project.graphics ?? {};
  for (const path of Object.keys(zip.files)) {
    const m = path.match(/^images\/([^/.]+)\.\w+$/);
    if (!m) continue;
    const mime = metas[m[1]]?.mime ?? 'image/png';
    const data = await zip.file(path)!.async('arraybuffer');
    await putBlob(m[1], new Blob([data], { type: mime }));
    refresh(m[1]);
  }
  useProjectStore.getState().loadFile(project);
}

// Dev-only hooks for automated checks; stripped from production builds.
if (import.meta.env.DEV) Object.assign(window, { __graphics: { exportZip, importZip, useGraphicsRuntime } });
