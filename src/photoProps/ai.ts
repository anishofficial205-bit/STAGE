/**
 * The two small AI models props use, both run in the browser (nothing is
 * uploaded): one finds the prop where you tap (SlimSAM, Apache-2.0, ~15 MB),
 * one works out how near each part is (Depth Anything V2 Small, Apache-2.0,
 * ~27 MB). Each is downloaded once, then kept by the browser.
 */
import type { Pic } from './image';
// The AI engine ships with the app (instead of coming from a public CDN), so it loads as fast as the app does.
import ortWasm from '../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import ortMjs from '../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';

export type Progress = (p: { loaded: number; total: number } | null) => void;
type T = typeof import('@huggingface/transformers');

let lib: Promise<T> | null = null;
/** The AI library, set up once. */
export function transformers(): Promise<T> {
  lib ??= import('@huggingface/transformers').then((t) => {
    t.env.allowLocalModels = false;
    const onnx = t.env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
    if (onnx.wasm) onnx.wasm.wasmPaths = { wasm: ortWasm, mjs: ortMjs };
    return t;
  });
  return lib;
}

/**
 * Load something once, telling everyone who's waiting how the download is
 * going (the dialog may be closed and reopened meanwhile).
 */
export function loader<R>(make: (progress_callback: (e: { status: string; file?: string; loaded?: number; total?: number }) => void) => Promise<R>) {
  const listeners = new Set<Progress>();
  let last: { loaded: number; total: number } | null = null;
  let loading: Promise<R> | null = null;
  return async (onProgress: Progress = () => undefined): Promise<R> => {
    listeners.add(onProgress);
    if (last) onProgress(last);
    try {
      loading ??= (() => {
        const files = new Map<string, { loaded: number; total: number }>();
        return make((e) => {
          if (e.status !== 'progress' || !e.file || !e.total) return;
          files.set(e.file, { loaded: e.loaded ?? 0, total: e.total });
          const all = [...files.values()];
          last = { loaded: all.reduce((s, f) => s + f.loaded, 0), total: all.reduce((s, f) => s + f.total, 0) };
          listeners.forEach((l) => l(last));
        })
          .then((r) => {
            last = null;
            return r;
          })
          .catch((e) => {
            loading = null;
            throw e;
          });
      })();
      const r = await loading;
      onProgress(null);
      return r;
    } finally {
      listeners.delete(onProgress);
    }
  };
}

type DepthPipe = (img: unknown) => Promise<{ depth: { data: Uint8Array | Uint8ClampedArray; width: number; height: number } }>;

const depthModel = loader(async (progress_callback) => {
  const t = await transformers();
  return (await t.pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { device: 'wasm', dtype: 'q8', progress_callback })) as unknown as DepthPipe;
});

/** How near each pixel is (0 far … 255 near), at the picture's size. */
export async function estimateDepth(p: Pic, onProgress?: Progress): Promise<Uint8Array> {
  const pipe = await depthModel(onProgress);
  const t = await transformers();
  const out = await pipe(new t.RawImage(new Uint8ClampedArray(p.data), p.width, p.height, 4));
  const d = out.depth;
  if (d.width === p.width && d.height === p.height) return Uint8Array.from(d.data);
  // Resample to the picture's size if the model returned another size.
  const res = new Uint8Array(p.width * p.height);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) res[y * p.width + x] = d.data[Math.min(d.height - 1, Math.floor((y * d.height) / p.height)) * d.width + Math.min(d.width - 1, Math.floor((x * d.width) / p.width))];
  return res;
}
