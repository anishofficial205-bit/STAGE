/**
 * Depth from a single photo, worked out in the browser by a small AI model
 * (Depth Anything V2 Small, Apache-2.0, 8-bit: about 27 MB). Nothing is
 * uploaded: the model is downloaded once (then kept by the browser) and runs
 * on this computer.
 */
import type { Pic } from './image';
// The AI engine ships with the app (instead of coming from a public CDN), so it loads as fast as the app does.
import ortWasm from '../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import ortMjs from '../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';

const MODEL = 'onnx-community/depth-anything-v2-small';

export type Progress = (p: { loaded: number; total: number } | null) => void;
type DepthPipe = (img: unknown) => Promise<{ depth: { data: Uint8Array | Uint8ClampedArray; width: number; height: number } }>;
type RawImageCtor = new (data: Uint8ClampedArray, w: number, h: number, channels: number) => unknown;

/** Everyone waiting for the download hears its progress (the dialog may be reopened meanwhile). */
const listeners = new Set<Progress>();
let last: { loaded: number; total: number } | null = null;
let loading: Promise<{ pipe: DepthPipe; RawImage: RawImageCtor }> | null = null;

async function load() {
  const t = await import('@huggingface/transformers');
  t.env.allowLocalModels = false;
  const onnx = t.env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
  if (onnx.wasm) onnx.wasm.wasmPaths = { wasm: ortWasm, mjs: ortMjs };
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (e: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (e.status !== 'progress' || !e.file || !e.total) return;
    files.set(e.file, { loaded: e.loaded ?? 0, total: e.total });
    const all = [...files.values()];
    last = { loaded: all.reduce((s, f) => s + f.loaded, 0), total: all.reduce((s, f) => s + f.total, 0) };
    listeners.forEach((l) => l(last));
  };
  const pipe = await t.pipeline('depth-estimation', MODEL, { device: 'wasm', dtype: 'q8', progress_callback });
  last = null;
  listeners.forEach((l) => l(null));
  return { pipe: pipe as unknown as DepthPipe, RawImage: t.RawImage as unknown as RawImageCtor };
}

/** How near each pixel is (0 far … 255 near), at the picture's size. */
export async function estimateDepth(p: Pic, onProgress: Progress = () => undefined): Promise<Uint8Array> {
  listeners.add(onProgress);
  if (last) onProgress(last);
  try {
    loading ??= load().catch((e) => {
      loading = null;
      throw e;
    });
    const { pipe, RawImage } = await loading;
    onProgress(null);
    const out = await pipe(new RawImage(p.data, p.width, p.height, 4));
    const d = out.depth;
    if (d.width === p.width && d.height === p.height) return Uint8Array.from(d.data);
    // Resample to the picture's size if the model returned another size.
    const res = new Uint8Array(p.width * p.height);
    for (let y = 0; y < p.height; y++)
      for (let x = 0; x < p.width; x++) res[y * p.width + x] = d.data[Math.min(d.height - 1, Math.floor((y * d.height) / p.height)) * d.width + Math.min(d.width - 1, Math.floor((x * d.width) / p.width))];
    return res;
  } finally {
    listeners.delete(onProgress);
  }
}
