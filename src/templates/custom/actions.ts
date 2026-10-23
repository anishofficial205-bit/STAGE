/**
 * Edits to the drawn stage shapes (undoable, through the project store), the
 * draw tool's snapping, and "seating along an edge".
 */
import { useProjectStore } from '../../store/useProjectStore';
import { M_PER_FT } from '../../units';
import type { Pt } from '../../helpers/shapes';
import { findFreeSpot, footprint, newId, roomOf, ROW_DEPTH, SEAT_WIDTH, useBlackBoxUI, type SeatingBlock } from '../blackBox/blocks';
import { gridSize } from '../blackBox/actions';
import { edgeMiddle, outwardNormal, shapeId, signedArea, type CustomData, type DrawnShape } from './shapes';
import { useCustomUI } from './ui';
import { nextName } from '../../helpers/names';

/** Drawing grid: 0.25 m, or 6 in when working in feet. */
export const drawGrid = () => (useProjectStore.getState().units === 'ft' ? 0.5 * M_PER_FT : 0.25);

const data = () => {
  const s = useProjectStore.getState();
  return s.dataByTemplate[s.templateId] as CustomData;
};

function update(fn: (d: CustomData) => CustomData, key?: string) {
  useProjectStore.getState().setData((d) => fn(d as CustomData), key);
}

function patchShape(id: string, fn: (s: DrawnShape) => DrawnShape, key?: string) {
  update((d) => ({ ...d, shapes: d.shapes.map((s) => (s.id === id ? fn(s) : s)) }), key);
}

const snap = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Where the next point goes for a pointer at `at`: on the grid, or — holding
 * Shift — along the nearest 15° direction from the previous point.
 */
export function snapPoint(at: Pt, prev: Pt | undefined, shift: boolean, free: boolean): Pt {
  if (shift && prev) {
    const dx = at[0] - prev[0];
    const dz = at[1] - prev[1];
    const step = Math.PI / 12;
    const ang = Math.round(Math.atan2(dz, dx) / step) * step;
    const len = snap(Math.hypot(dx, dz), free ? 0.01 : drawGrid() / 5);
    return [prev[0] + Math.cos(ang) * len, prev[1] + Math.sin(ang) * len];
  }
  if (free) return at;
  const g = drawGrid();
  return [snap(at[0], g), snap(at[1], g)];
}

export const customActions = {
  /** Close the outline being drawn into a new platform. */
  finishDraft: () => {
    const { draft } = useCustomUI.getState();
    if (draft.length < 3 || Math.abs(signedArea(draft)) < 0.05) return false;
    const id = shapeId();
        const shape: DrawnShape = { id, name: nextName('Stage', data().shapes.map((x) => x.name)), points: draft.map(([x, z]) => ({ x, z })), bulges: draft.map(() => 0), height: 0.6, edge: 'straight', material: 'black', radius: 0 };
    update((d) => ({ ...d, shapes: [...d.shapes, shape] }));
    useCustomUI.getState().setTool(null);
    useCustomUI.getState().selectShape(id);
    return true;
  },
  patch: (id: string, change: Partial<DrawnShape>, key?: string) => patchShape(id, (s) => ({ ...s, ...change }), key ?? `shape:${id}:${Object.keys(change).join()}`),
  movePoint: (id: string, i: number, at: Pt) => patchShape(id, (s) => ({ ...s, points: s.points.map((p, k) => (k === i ? { ...p, x: at[0], z: at[1] } : p)) }), `shape-pt:${id}:${i}`),
  setPointRadius: (id: string, i: number, r: number | undefined) =>
    patchShape(id, (s) => ({ ...s, points: s.points.map((p, k) => (k === i ? (r === undefined ? { x: p.x, z: p.z } : { ...p, r }) : p)) }), `shape-r:${id}:${i}`),
  /** Bend edge i so its middle passes through `at` (or straighten it near the chord). */
  bendEdge: (id: string, i: number, at: Pt) =>
    patchShape(
      id,
      (s) => {
        const pts = s.points.map((p) => [p.x, p.z] as Pt);
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const n = outwardNormal(a, b, signedArea(pts));
        const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        let bulge = (at[0] - m[0]) * n[0] + (at[1] - m[1]) * n[1];
        const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
        bulge = Math.abs(bulge) < 0.08 ? 0 : Math.max(-chord / 2, Math.min(chord / 2, Math.round(bulge * 20) / 20));
        return { ...s, bulges: s.bulges.map((v, k) => (k === i ? bulge : v)) };
      },
      `shape-bend:${id}:${i}`,
    ),
  /** Add a point in the middle of edge i (on the curve, if it's curved; both halves stay straight). */
  splitEdge: (id: string, i: number) => {
    patchShape(id, (s) => {
      const [x, z] = edgeMiddle(s, i);
      const points = [...s.points.slice(0, i + 1), { x, z }, ...s.points.slice(i + 1)];
      const bulges = [...s.bulges.slice(0, i), 0, 0, ...s.bulges.slice(i + 1)];
      return { ...s, points, bulges };
    });
    useCustomUI.getState().selectShape(id, i + 1);
  },
  removePoint: (id: string, i: number) => {
    const s = data().shapes.find((x) => x.id === id);
    if (!s || s.points.length <= 3) return;
    patchShape(id, (sh) => ({ ...sh, points: sh.points.filter((_, k) => k !== i), bulges: sh.bulges.filter((_, k) => k !== i) }));
    useCustomUI.getState().selectShape(id);
  },
  remove: (id: string) => {
    update((d) => ({ ...d, shapes: d.shapes.filter((s) => s.id !== id) }));
    useCustomUI.getState().selectShape(null);
  },
  duplicate: (id: string) => {
    const src = data().shapes.find((s) => s.id === id);
    if (!src) return;
    const copy = { ...src, id: shapeId(), name: `${src.name} copy`, points: src.points.map((p) => ({ ...p, x: p.x + 1, z: p.z + 1 })) };
    update((d) => ({ ...d, shapes: [...d.shapes, copy] }));
    useCustomUI.getState().selectShape(copy.id);
  },
  /** Seating rows facing edge i of a shape, set back from it by `gap`. */
  seatAlongEdge: (id: string, i: number, gap = 1) => {
    const s = data().shapes.find((x) => x.id === id);
    if (!s) return;
    const pts = s.points.map((p) => [p.x, p.z] as Pt);
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = outwardNormal(a, b, signedArea(pts));
    const mid = edgeMiddle(s, i);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const seatsPerRow = Math.max(2, Math.min(30, Math.floor((len - 0.2) / SEAT_WIDTH)));
    const rows = 5;
    const block: SeatingBlock = { id: newId(), kind: 'seating', x: 0, z: 0, rotation: 0, rows, seatsPerRow, rake: 0.25 };
    const { d } = footprint(block);
    // Seats face the block's local -Z edge; turn that edge towards the stage.
    const rotation = ((Math.atan2(n[0], n[1]) * 180) / Math.PI + 360) % 360;
    const placed = { ...block, rotation, x: mid[0] + n[0] * (gap + d / 2), z: mid[1] + n[1] * (gap + d / 2) };
    const st = useProjectStore.getState();
    const room = roomOf(st.paramsByTemplate[st.templateId]);
    update((dd) => ({ ...dd, blocks: [...dd.blocks, findFreeSpot(placed, dd.blocks, room, gridSize() / 5)] }));
    useCustomUI.getState().setTool(null);
    useBlackBoxUI.getState().select(placed.id);
  },
};

export { ROW_DEPTH };
