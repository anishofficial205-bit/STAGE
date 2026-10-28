/**
 * Turning a cut-out photo into a solid.
 *
 * The outline comes from the cut-out; the front surface from the depth map
 * (nearer parts stand out more); the thickness, top to bottom, from the side
 * photo's outline when there is one. Edges are rounded so the front and the
 * (smoother) back meet in a closed shape. A "cut-out" is the same with no
 * relief: a flat board shaped like the photo.
 *
 * The result fits a 1 × 1 × 1 box: x −0.5…0.5 across, y 0…1 up, z −0.5…0.5
 * front to back; the piece scales it to the real size.
 */
import * as THREE from 'three';

export interface Outline {
  width: number;
  height: number;
  /** 0–255 per pixel: inside the prop when > 127. */
  alpha: Uint8Array | Uint8ClampedArray;
}

export function buildPropGeometry(front: Outline, depth: Uint8Array | null, side: Outline | null, mode: 'cutout' | 'solid'): THREE.BufferGeometry {
  const { width: w, height: h } = front;
  const N = mode === 'solid' ? 150 : 120;
  const step = Math.max(w, h) / N;
  const gw = Math.max(2, Math.round((w - 1) / step));
  const gh = Math.max(2, Math.round((h - 1) / step));
  const at = (i: number, j: number) => {
    const px = Math.min(w - 1, Math.round((i / gw) * (w - 1)));
    const py = Math.min(h - 1, Math.round((j / gh) * (h - 1)));
    return py * w + px;
  };
  const V = (gw + 1) * (gh + 1);
  const id = (i: number, j: number) => j * (gw + 1) + i;
  const inside = new Uint8Array(V);
  for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) inside[id(i, j)] = front.alpha[at(i, j)] > 127 ? 1 : 0;

  // Distance (in cells) to the nearest point outside the prop.
  const dist = new Float32Array(V);
  for (let k = 0; k < V; k++) dist[k] = inside[k] ? 1e9 : 0;
  const D = Math.SQRT2;
  for (let j = 0; j <= gh; j++)
    for (let i = 0; i <= gw; i++) {
      const k = id(i, j);
      if (!inside[k]) continue;
      if (i === 0 || j === 0 || i === gw || j === gh) dist[k] = 0;
      else dist[k] = Math.min(dist[k], dist[k - 1] + 1, dist[k - gw - 1] + 1, dist[k - gw - 2] + D, dist[k - gw] + D);
    }
  for (let j = gh; j >= 0; j--)
    for (let i = gw; i >= 0; i--) {
      const k = id(i, j);
      if (!inside[k] || i === 0 || j === 0 || i === gw || j === gh) continue;
      dist[k] = Math.min(dist[k], dist[k + 1] + 1, dist[k + gw + 1] + 1, dist[k + gw + 2] + D, dist[k + gw] + D);
    }

  // Relief: the depth map, stretched to use its full range inside the outline.
  const relief = new Float32Array(V);
  if (depth && mode === 'solid') {
    const vals: number[] = [];
    for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) if (inside[id(i, j)]) vals.push(depth[at(i, j)]);
    vals.sort((a, b) => a - b);
    const lo = vals[Math.floor(vals.length * 0.05)] ?? 0;
    const hi = vals[Math.floor(vals.length * 0.95)] ?? 255;
    for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) relief[id(i, j)] = Math.min(1, Math.max(0, (depth[at(i, j)] - lo) / Math.max(1, hi - lo)));
  }

  // Thickness top to bottom, from the side photo (its width at each height).
  const thick = new Float32Array(gh + 1).fill(1);
  if (side) {
    const rows = new Float32Array(side.height);
    let max = 1;
    for (let y = 0; y < side.height; y++) {
      let n = 0;
      for (let x = 0; x < side.width; x++) if (side.alpha[y * side.width + x] > 127) n++;
      rows[y] = n;
      max = Math.max(max, n);
    }
    for (let j = 0; j <= gh; j++) {
      const y = Math.min(side.height - 1, Math.round((j / gh) * (side.height - 1)));
      // A little smoothing across nearby rows.
      let s = 0;
      let c = 0;
      for (let d = -2; d <= 2; d++) {
        const yy = Math.min(side.height - 1, Math.max(0, y + d));
        s += rows[yy];
        c++;
      }
      thick[j] = Math.max(0.12, s / c / max);
    }
  }

  // Positions on both faces.
  const R = mode === 'solid' ? Math.max(2, 0.14 * Math.min(gw, gh)) : 1;
  const zf = new Float32Array(V);
  const zb = new Float32Array(V);
  for (let j = 0; j <= gh; j++)
    for (let i = 0; i <= gw; i++) {
      const k = id(i, j);
      // The rim (next to the outside) stays at 0 so the front and back meet in a closed shape.
      if (!inside[k] || dist[k] <= 1) continue;
      const e = Math.min(1, (dist[k] - 1) / R);
      const round = mode === 'solid' ? Math.sqrt(1 - (1 - e) * (1 - e)) : 1;
      const t = 0.5 * thick[j] * round;
      zf[k] = mode === 'solid' ? t * (0.35 + 0.65 * relief[k]) : t;
      zb[k] = mode === 'solid' ? -t * 0.7 : -t;
    }
  // Fit the front-to-back extent into −0.5…0.5.
  let zmin = 0;
  let zmax = 0;
  for (let k = 0; k < V; k++) if (inside[k]) (zmin = Math.min(zmin, zb[k])), (zmax = Math.max(zmax, zf[k]));
  const zs = 1 / Math.max(1e-6, zmax - zmin);
  const zc = (zmax + zmin) / 2;

  const pos: number[] = [];
  const uv: number[] = [];
  const fi = new Int32Array(V).fill(-1);
  const bi = new Int32Array(V).fill(-1);
  for (let j = 0; j <= gh; j++)
    for (let i = 0; i <= gw; i++) {
      const k = id(i, j);
      if (!inside[k]) continue;
      const x = i / gw - 0.5;
      const y = 1 - j / gh;
      fi[k] = pos.length / 3;
      pos.push(x, y, (zf[k] - zc) * zs);
      uv.push(i / gw, 1 - j / gh);
      bi[k] = pos.length / 3;
      pos.push(x, y, (zb[k] - zc) * zs);
      // The back shows the back photo seen from behind (mirrored).
      uv.push(1 - i / gw, 1 - j / gh);
    }
  const frontIdx: number[] = [];
  const backIdx: number[] = [];
  const tri = (a: number, b: number, c: number) => {
    frontIdx.push(fi[a], fi[b], fi[c]);
    backIdx.push(bi[a], bi[c], bi[b]);
  };
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const a = id(i, j);
      const b = id(i + 1, j);
      const c = id(i, j + 1);
      const d = id(i + 1, j + 1);
      const n = inside[a] + inside[b] + inside[c] + inside[d];
      if (n === 4) {
        tri(a, c, b);
        tri(b, c, d);
      } else if (n === 3) {
        if (!inside[d]) tri(a, c, b);
        else if (!inside[a]) tri(b, c, d);
        else if (!inside[b]) tri(a, c, d);
        else tri(a, d, b);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([...frontIdx, ...backIdx]);
  g.addGroup(0, frontIdx.length, 0);
  g.addGroup(frontIdx.length, backIdx.length, 1);
  g.computeVertexNormals();
  return g;
}
