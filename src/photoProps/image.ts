/**
 * Photo handling for props: loading, finding the prop against its background
 * (or using a photo that's already cut out), touching the cut-out up with a
 * brush, and cropping to the prop.
 */

/** A picture at working size, with its pixels. */
export interface Pic {
  width: number;
  height: number;
  /** RGBA. */
  data: Uint8ClampedArray;
}

/** Longest side photos are worked at (enough for a stage prop, quick to process). */
export const WORK = 768;

export async function loadPic(file: Blob, max = WORK): Promise<Pic> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
}

export function picToCanvas(p: Pic, alpha?: Uint8Array): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = p.width;
  c.height = p.height;
  const img = new ImageData(new Uint8ClampedArray(p.data), p.width, p.height);
  if (alpha) for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i];
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/** Does the photo already have a see-through background (e.g. a cut-out from a phone)? */
export function hasTransparency(p: Pic) {
  let clear = 0;
  for (let i = 3; i < p.data.length; i += 4) if (p.data[i] < 200) clear++;
  return clear > (p.data.length / 4) * 0.02;
}

/**
 * Find the prop: pixels that differ from the colour around the photo's edges,
 * or (with a depth map) that stand nearer than the background. `strength`
 * 0–1: higher removes more. Keeps the biggest piece and fills its holes.
 */
export function autoMask(p: Pic, depth: Uint8Array | null, strength = 0.5): Uint8Array {
  const { width: w, height: h, data } = p;
  const mask = new Uint8Array(w * h);
  if (hasTransparency(p)) {
    for (let i = 0; i < w * h; i++) mask[i] = data[i * 4 + 3] > 128 ? 255 : 0;
    return clean(mask, w, h);
  }
  // The background colour: the median of a band around the edges.
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const ds: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x >= band && x < w - band && y >= band && y < h - band) continue;
      const i = y * w + x;
      rs.push(data[i * 4]);
      gs.push(data[i * 4 + 1]);
      bs.push(data[i * 4 + 2]);
      if (depth) ds.push(depth[i]);
    }
  const med = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
  const [br, bg, bb] = [med(rs), med(gs), med(bs)];
  // How much the edge colour varies: a busy background needs a bigger difference to count as the prop.
  // Shadows on the wall or floor are darker versions of the background: colour counts more than brightness.
  const bl = (br + bg + bb) / 3;
  const diff = (r: number, g: number, b: number) => {
    const l = (r + g + b) / 3;
    return (Math.abs(r - l - (br - bl)) + Math.abs(g - l - (bg - bl)) + Math.abs(b - l - (bb - bl))) * 1.5 + Math.abs(l - bl) * 0.9;
  };
  let spread = 0;
  for (let k = 0; k < rs.length; k++) spread += diff(rs[k], gs[k], bs[k]);
  spread /= Math.max(1, rs.length);
  const colourCut = (24 + spread * 1.2) * (0.5 + strength * 1.2);
  const bgDepth = depth ? med(ds) : 0;
  const depthCut = 18 + strength * 40;
  for (let i = 0; i < w * h; i++) {
    const dc = diff(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    const byColour = dc / colourCut;
    const byDepth = depth ? (depth[i] - bgDepth) / depthCut : 0;
    // Depth only settles borderline colours: a floor in front of the wall is nearer too, but it's background.
    mask[i] = byColour > 1 || (byColour > 0.7 && byDepth > 1) ? 255 : 0;
  }
  return clean(mask, w, h);
}

/** Keep the biggest connected piece, fill holes inside it, and smooth the edge a little. */
export function clean(mask: Uint8Array, w: number, h: number): Uint8Array {
  // Open then close by one pixel: removes specks and pinholes.
  const erode = (m: Uint8Array) => m.map((v, i) => (v && neighbours(i, w, h).every((j) => m[j]) ? 255 : 0));
  const dilate = (m: Uint8Array) => m.map((v, i) => (v || neighbours(i, w, h).some((j) => m[j]) ? 255 : 0));
  let m = dilate(erode(mask));
  m = erode(dilate(m));
  // Biggest piece.
  const label = new Int32Array(w * h).fill(-1);
  let best = -1;
  let bestSize = 0;
  const stack: number[] = [];
  for (let s = 0, n = 0; s < w * h; s++) {
    if (!m[s] || label[s] >= 0) continue;
    let size = 0;
    stack.push(s);
    label[s] = n;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      for (const j of neighbours(i, w, h))
        if (m[j] && label[j] < 0) {
          label[j] = n;
          stack.push(j);
        }
    }
    if (size > bestSize) (best = n), (bestSize = size);
    n++;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = label[i] === best ? 255 : 0;
  // Fill holes: anything not reachable from the border through the background is part of the prop.
  const outside = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (!out[y * w + x] && !outside[y * w + x]) flood(y * w + x);
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (!out[y * w + x] && !outside[y * w + x]) flood(y * w + x);
  function flood(s: number) {
    outside[s] = 1;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      for (const j of neighbours(i, w, h))
        if (!out[j] && !outside[j]) {
          outside[j] = 1;
          stack.push(j);
        }
    }
  }
  for (let i = 0; i < w * h; i++) if (!outside[i]) out[i] = 255;
  return out;
}

function neighbours(i: number, w: number, h: number) {
  const x = i % w;
  const y = (i - x) / w;
  const n: number[] = [];
  if (x > 0) n.push(i - 1);
  if (x < w - 1) n.push(i + 1);
  if (y > 0) n.push(i - w);
  if (y < h - 1) n.push(i + w);
  return n;
}

/** Paint the cut-out: keep (add to the prop) or remove, in a circle. */
export function brush(mask: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, keep: boolean) {
  const r2 = r * r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) mask[y * w + x] = keep ? 255 : 0;
}

export function bbox(mask: Uint8Array, w: number, h: number) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The prop cropped to its outline: colours (edges spread outward a few pixels so no background shows at the rim), its outline, and the depth map cropped the same way. */
export function crop(p: Pic, mask: Uint8Array, extra?: Uint8Array | null): { rgba: Uint8ClampedArray; alpha: Uint8Array; depth: Uint8Array | null; w: number; h: number } | null {
  const b = bbox(mask, p.width, p.height);
  if (!b) return null;
  const pad = 2;
  const x0 = Math.max(0, b.x - pad);
  const y0 = Math.max(0, b.y - pad);
  const w = Math.min(p.width, b.x + b.w + pad) - x0;
  const h = Math.min(p.height, b.y + b.h + pad) - y0;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const alpha = new Uint8Array(w * h);
  const depth = extra ? new Uint8Array(w * h) : null;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (y + y0) * p.width + (x + x0);
      const d = y * w + x;
      rgba.set(p.data.subarray(s * 4, s * 4 + 3), d * 4);
      alpha[d] = mask[s];
      rgba[d * 4 + 3] = mask[s];
      if (depth && extra) depth[d] = extra[s];
    }
  // Spread the edge colours outward (into the see-through area).
  let edge: Uint8Array = alpha.slice();
  for (let pass = 0; pass < 6; pass++) {
    const next = edge.slice();
    for (let i = 0; i < w * h; i++) {
      if (edge[i]) continue;
      let r = 0;
      let g = 0;
      let bl = 0;
      let n = 0;
      for (const j of neighbours(i, w, h))
        if (edge[j]) {
          r += rgba[j * 4];
          g += rgba[j * 4 + 1];
          bl += rgba[j * 4 + 2];
          n++;
        }
      if (n) {
        rgba[i * 4] = r / n;
        rgba[i * 4 + 1] = g / n;
        rgba[i * 4 + 2] = bl / n;
        next[i] = 255;
      }
    }
    edge = next;
  }
  return { rgba, alpha, depth, w, h };
}

/** The cropped prop as PNG files (picture with transparent background, and the depth map). */
export async function cropToFiles(p: Pic, mask: Uint8Array, extra?: Uint8Array | null): Promise<{ png: Blob; depth?: Blob; w: number; h: number } | null> {
  const c = crop(p, mask, extra);
  if (!c) return null;
  const png = await toPng(c.rgba, c.w, c.h);
  let depth: Blob | undefined;
  if (c.depth) {
    const gray = new Uint8ClampedArray(c.w * c.h * 4);
    for (let i = 0; i < c.w * c.h; i++) {
      gray[i * 4] = gray[i * 4 + 1] = gray[i * 4 + 2] = c.depth[i];
      gray[i * 4 + 3] = 255;
    }
    depth = await toPng(gray, c.w, c.h);
  }
  return { png, depth, w: c.w, h: c.h };
}

async function toPng(rgba: Uint8ClampedArray, w: number, h: number) {
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d')!.putImageData(new ImageData(rgba, w, h), 0, 0);
  return c.convertToBlob({ type: 'image/png' });
}

/** Drop specks (pieces under 3% of the biggest); keep real gaps and separate parts. For outlines from the AI. */
export function despeckle(mask: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const n = sizes.length;
    let size = 0;
    label[s] = n;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      for (const j of neighbours(i, w, h))
        if (mask[j] && label[j] < 0) {
          label[j] = n;
          stack.push(j);
        }
    }
    sizes.push(size);
  }
  const max = Math.max(0, ...sizes);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (label[i] >= 0 && sizes[label[i]] >= max * 0.03) out[i] = 255;
  return out;
}

/** The cut-out with brush touch-ups on top: (outline + kept) − removed. */
export function compose(base: Uint8Array, add: Uint8Array, remove: Uint8Array): Uint8Array {
  const out = new Uint8Array(base.length);
  for (let i = 0; i < base.length; i++) out[i] = (base[i] || add[i]) && !remove[i] ? 255 : 0;
  return out;
}

export type CutoutProblem = 'empty' | 'tiny' | 'everything' | 'edge';

/** Plain checks on a cut-out: nothing kept, almost nothing, nearly the whole photo, or cut off at the photo's edge. */
export function checkCutout(mask: Uint8Array, w: number, h: number): CutoutProblem[] {
  let area = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) area++;
  if (!area) return ['empty'];
  const share = area / (w * h);
  const out: CutoutProblem[] = [];
  if (share < 0.02) out.push('tiny');
  if (share > 0.88) out.push('everything');
  // Edge pixels that belong to the prop (ignoring the bottom edge: a prop standing on the floor can touch it).
  let touch = 0;
  for (let x = 0; x < w; x++) if (mask[x]) touch++;
  for (let y = 0; y < h; y++) {
    if (mask[y * w]) touch++;
    if (mask[y * w + w - 1]) touch++;
  }
  if (share <= 0.88 && touch > (w + 2 * h) * 0.03) out.push('edge');
  return out;
}
