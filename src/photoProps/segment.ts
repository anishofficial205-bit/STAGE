/**
 * Tap to find the prop: SlimSAM (a small Segment Anything) outlines the
 * object under the taps. The photo is read once (the slow part, a second or
 * two); each tap after that takes a fraction of a second.
 */
import { loader, transformers, type Progress } from './ai';
import { despeckle, type Pic } from './image';

const MODEL = 'Xenova/slimsam-77-uniform';

/* The SAM classes are loosely typed in the library; these are the parts used here. */
interface Tensorish {
  data: ArrayLike<number>;
  dims: number[];
}
interface SamProcessor {
  (image: unknown): Promise<{ pixel_values: Tensorish; original_sizes: [number, number][]; reshaped_input_sizes: [number, number][] }>;
  post_process_masks(masks: Tensorish, original: [number, number][], reshaped: [number, number][]): Promise<Tensorish[][]>;
}
interface SamModel {
  get_image_embeddings(x: { pixel_values: Tensorish }): Promise<Record<string, Tensorish>>;
  (inputs: Record<string, unknown>): Promise<{ pred_masks: Tensorish; iou_scores: Tensorish }>;
}

const samModel = loader(async (progress_callback) => {
  const t = await transformers();
  const [model, processor] = await Promise.all([
    t.SamModel.from_pretrained(MODEL, { device: 'wasm', dtype: 'q8', progress_callback }),
    t.AutoProcessor.from_pretrained(MODEL, { progress_callback }),
  ]);
  return { model: model as unknown as SamModel, processor: processor as unknown as SamProcessor };
});

/** A photo read by the model, ready for taps. */
export interface Prepared {
  width: number;
  height: number;
  run: (points: TapPoint[]) => Promise<Uint8Array>;
}

/** A tap: on the prop (keep) or on something that isn't (remove). x, y in picture pixels. */
export interface TapPoint {
  x: number;
  y: number;
  keep: boolean;
}

export async function prepare(p: Pic, onProgress?: Progress): Promise<Prepared> {
  const { model, processor } = await samModel(onProgress);
  const t = await transformers();
  const image = new t.RawImage(new Uint8ClampedArray(p.data), p.width, p.height, 4).rgb();
  const inputs = await processor(image);
  const embeddings = await model.get_image_embeddings({ pixel_values: inputs.pixel_values });
  const [rh, rw] = inputs.reshaped_input_sizes[0];
  /** The object under one tap: the whole object (`large`), or the smallest sure piece of it (`small`). */
  const one = async (q: TapPoint, prefer: 'large' | 'small') => {
    const input_points = new t.Tensor('float32', Float32Array.from([(q.x / p.width) * rw, (q.y / p.height) * rh]), [1, 1, 1, 2]);
    const input_labels = new t.Tensor('int64', BigInt64Array.from([1n]), [1, 1, 1]);
    const out = await model({ ...embeddings, input_points, input_labels });
    const masks = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
    // Three candidate outlines (a part, a bigger part, the whole): take one the model is sure of —
    // the biggest such for the prop, the smallest for something to remove.
    const m = masks[0][0];
    const [n, h, w] = m.dims.slice(-3);
    const scores = Array.from(out.iou_scores.data);
    const top = Math.max(...scores);
    const area = (k: number) => {
      let a = 0;
      for (let i = k * w * h; i < (k + 1) * w * h; i++) if (m.data[i]) a++;
      return a;
    };
    const sure = [...Array(n).keys()].filter((k) => scores[k] >= top - 0.05);
    const best = sure.sort((a, b) => (prefer === 'large' ? area(b) - area(a) : area(a) - area(b)))[0];
    const res = new Uint8Array(w * h);
    const off = best * w * h;
    for (let i = 0; i < w * h; i++) res[i] = m.data[off + i] ? 255 : 0;
    return res;
  };
  return {
    width: p.width,
    height: p.height,
    run: async (points) => {
      // Each tap on the prop adds the object under it; each "not the prop" tap takes away the
      // (smallest) thing under it. Simple to predict, and two taps on two parts both count.
      const res = new Uint8Array(p.width * p.height);
      for (const q of points.filter((x) => x.keep)) {
        // Specks are cleaned per object, so a thin object next to a big one isn't mistaken for a speck.
        const m = despeckle(await one(q, 'large'), p.width, p.height);
        for (let i = 0; i < res.length; i++) if (m[i]) res[i] = 255;
      }
      for (const q of points.filter((x) => !x.keep)) {
        const m = await one(q, 'small');
        for (let i = 0; i < res.length; i++) if (m[i]) res[i] = 0;
      }
      return res;
    },
  };
}
