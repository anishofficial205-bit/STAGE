/**
 * "Import plan to trace": a JPG, PNG or PDF page of the venue's floor plan,
 * shown faintly under the plan. The image lives in IndexedDB; the project
 * keeps where it sits and its scale (set by calibrating two points).
 */
import { useEffect, useState } from 'react';
import { deleteBlob, getBlob, putBlob } from '../graphics/db';
import { pdfToPng } from '../graphics/library';
import { useProjectStore } from '../store/useProjectStore';
import { venueId, type Pt, type Trace } from './types';

export const traceKey = (id: string) => `trace-${id}`;

const decode = (blob: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = url;
  });

/** Import a plan image (or a PDF page), placed about 40 m wide over the stage until it's calibrated. */
export async function importTrace(file: File) {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  let blob: Blob = file;
  if (pdf) {
    const r = await pdfToPng(file);
    if (!r) return null;
    blob = r.blob;
  } else if (!/^image\/(jpeg|png|webp)$/.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error('Use a JPG, PNG or PDF of the floor plan.');
  }
  const img = await decode(blob);
  const id = venueId('t');
  await putBlob(traceKey(id), blob);
  const old = useProjectStore.getState().venue.trace;
  const mPerPx = 40 / img.naturalWidth;
  const trace: Trace = {
    id,
    name: file.name.replace(/\.[^.]+$/, ''),
    mime: blob.type || 'image/png',
    width: img.naturalWidth,
    height: img.naturalHeight,
    x: -20,
    z: (-img.naturalHeight * mPerPx) / 2,
    mPerPx,
    opacity: 0.5,
    locked: false,
    hidden: false,
  };
  useProjectStore.getState().setVenue((v) => ({ ...v, trace }));
  if (old) void deleteBlob(traceKey(old.id)).catch(() => undefined);
  return trace;
}

export const patchTrace = (change: Partial<Trace>, key?: string) => useProjectStore.getState().setVenue((v) => (v.trace ? { ...v, trace: { ...v.trace, ...change } } : v), key ?? `trace:${Object.keys(change).join()}`);

export function removeTrace() {
  useProjectStore.getState().setVenue((v) => ({ ...v, trace: null }));
}

/**
 * Calibrate: the user clicked `a` and `b` on the image and says they are
 * `metres` apart. Rescale about `a` so the image is true to size.
 */
export function calibrateTrace(a: Pt, b: Pt, metres: number) {
  const t = useProjectStore.getState().venue.trace;
  const measured = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!t || measured < 1e-6 || !(metres > 0)) return;
  const k = metres / measured;
  patchTrace({ mPerPx: t.mPerPx * k, x: a[0] - (a[0] - t.x) * k, z: a[1] - (a[1] - t.z) * k }, `trace-cal:${Date.now()}`);
}

const urls = new Map<string, string>();
/** Object URL for the trace image (cached). */
export function useTraceUrl(id: string | undefined) {
  const [url, setUrl] = useState<string | null>(id ? urls.get(id) ?? null : null);
  useEffect(() => {
    if (!id) return setUrl(null);
    if (urls.has(id)) return setUrl(urls.get(id)!);
    let alive = true;
    void getBlob(traceKey(id)).then((b) => {
      if (!b || !alive) return;
      const u = URL.createObjectURL(b);
      urls.set(id, u);
      setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}
