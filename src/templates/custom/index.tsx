/**
 * Build Your Own — starts as an empty floor with a grid. Users draw stage
 * outlines of any shape (rounded corners, curved edges), set their heights,
 * place seating blocks (or seat along an edge) and can save the result as
 * their own template.
 *
 * Data: the drawn shapes and the seating blocks (same blocks as the Black Box).
 * Layout (metres, Y up): the room is centred on the origin.
 */
import type { Bounds, PanelMessage, PresetView, StageTemplate, Surface, Vec3 } from '../../types';
import { bool, num } from '../../helpers/params';
import { EYE_HEIGHT } from '../../helpers/views';
import { rect } from '../../helpers/stageInfo';
import { generateSeats } from '../../helpers/Seating';
import { blockSeats } from '../../helpers/seats';
import { clampToRoom, footprint, overlappingIds, roomOf, sanitizeData, toWorld, ROW_DEPTH, type Block } from '../blackBox/blocks';
import { bbox, outline, sanitizeShapes, type CustomData } from './shapes';
import { CustomScene } from './Scene';
import { CustomPanel } from './Panel';
import { CUSTOM_ID } from './myTemplates';

const dataOf = (d: unknown): CustomData => ({ shapes: (d as CustomData | undefined)?.shapes ?? [], blocks: (d as CustomData | undefined)?.blocks ?? [] });

export const customTemplate: StageTemplate = {
  id: CUSTOM_ID,
  name: 'Build Your Own',
  description: 'Draw any stage shape',
  audienceSides: ['custom'],

  params: [
    { key: 'roomWidth', label: 'Room width', group: 'Room', type: 'number', default: 24, min: 6, max: 80, step: 0.5 },
    { key: 'roomLength', label: 'Room length', group: 'Room', type: 'number', default: 24, min: 6, max: 80, step: 0.5 },
    { key: 'walls', label: 'Walls', group: 'Room', type: 'boolean', default: false },
    { key: 'roomHeight', label: 'Wall / ceiling height', group: 'Room', type: 'number', default: 7, min: 3, max: 25, step: 0.1, visible: (p) => !!p.walls },
    {
      key: 'wallColour',
      label: 'Wall colour',
      group: 'Room',
      type: 'select',
      default: 'dark-grey',
      visible: (p) => !!p.walls,
      options: [
        { value: 'black', label: 'Black' },
        { value: 'dark-grey', label: 'Dark grey' },
        { value: 'white', label: 'White' },
      ],
    },
  ],

  constraints: (p) => p,

  data: {
    initial: () => ({ shapes: [], blocks: [] }),
    sanitize: (raw, p) => {
      const r = (raw ?? {}) as Partial<CustomData>;
      return { shapes: sanitizeShapes(r.shapes), blocks: Array.isArray(r.blocks) ? sanitizeData({ blocks: r.blocks }, p).blocks : [] };
    },
    onParamsChange: (next, _prev, data) => {
      const d = dataOf(data);
      return { ...d, blocks: d.blocks.map((b) => clampToRoom(b, roomOf(next))) };
    },
  },

  Panel: CustomPanel,

  messages: (_p, data): PanelMessage[] => {
    const n = overlappingIds(dataOf(data).blocks).size;
    return n > 0 ? [{ kind: 'warning', text: `${n} seating blocks overlap (outlined in red). Drag them apart.` }] : [];
  },

  build: (p, data) => <CustomScene p={p} data={dataOf(data)} />,

  presetViews: (p, data): PresetView[] => {
    const room = roomOf(p);
    const { shapes, blocks } = dataOf(data);
    // Look at the middle of the drawn stages (or the room centre).
    let target: Vec3 = [0, 1.2, 0];
    if (shapes.length) {
      const all = shapes.map((s) => ({ b: bbox(outline(s)), h: s.height }));
      const x = all.reduce((t, s) => t + (s.b.x0 + s.b.x1) / 2, 0) / all.length;
      const z = all.reduce((t, s) => t + (s.b.z0 + s.b.z1) / 2, 0) / all.length;
      target = [x, all.reduce((t, s) => t + s.h, 0) / all.length + 1.2, z];
    }
    const views: PresetView[] = seatingViews(blocks, target);
    if (!views.length && shapes.length) views.push({ id: 'front', label: 'Front view', position: [target[0], target[1] + 2, target[2] + Math.min(room.halfL, 12)], target });
    views.push({ id: 'corner', label: 'Corner view', position: [room.halfW - 0.6, Math.min(12, room.height + 2), room.halfL - 0.6], target });
    return views;
  },

  surfaces: (p, data): Surface[] => {
    const { halfW, halfL, height } = roomOf(p);
    const out: Surface[] = [{ id: 'floor', label: 'Floor', position: [0, 0.005, 0], rotation: [-Math.PI / 2, 0, 0], width: halfW * 2, height: halfL * 2 }];
    if (bool(p, 'walls'))
      out.push(
        { id: 'wall-back', label: 'Back wall', position: [0, height / 2, -halfL], rotation: [0, 0, 0], width: halfW * 2, height },
        { id: 'wall-front', label: 'Front wall', position: [0, height / 2, halfL], rotation: [0, Math.PI, 0], width: halfW * 2, height },
        { id: 'wall-left', label: 'Left wall', position: [-halfW, height / 2, 0], rotation: [0, Math.PI / 2, 0], width: halfL * 2, height },
        { id: 'wall-right', label: 'Right wall', position: [halfW, height / 2, 0], rotation: [0, -Math.PI / 2, 0], width: halfL * 2, height },
      );
    for (const s of dataOf(data).shapes) {
      const pts = outline(s);
      const b = bbox(pts);
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      // Top of the platform, in the surface's own plane (y runs towards -z after the rotation).
      out.push({ id: `shape-${s.id}-top`, label: `${s.name} top`, position: [cx, Math.max(0.02, s.height), cz], rotation: [-Math.PI / 2, 0, 0], width: b.x1 - b.x0, height: b.z1 - b.z0, outline: pts.map(([x, z]) => [x - cx, -(z - cz)]) });
    }
    return out;
  },

  stage: (p, data) => {
    const { halfW, halfL } = roomOf(p);
    const floors = [{ outline: rect(-halfW, -halfL, halfW, halfL), height: 0 }];
    for (const s of dataOf(data).shapes) floors.push({ outline: outline(s), height: Math.max(0.02, s.height) });
    return { centre: [0, 0], floors };
  },

  seats: (_p, data) => {
    let n = 0;
    return dataOf(data).blocks.flatMap((b) => {
      if (b.kind !== 'seating') return [];
      const { d } = footprint(b);
      const local = generateSeats({ rows: b.rows, seatsPerRow: b.seatsPerRow, firstRowDistance: 0.5, rowSpacing: ROW_DEPTH, rise: b.rake }).map((s) => ({ ...s, z: s.z - d / 2 }));
      return blockSeats(local, [b.x, 0, b.z], (b.rotation * Math.PI) / 180, `Block ${++n}`);
    });
  },

  bounds: (p, data): Bounds => {
    const { halfW, halfL } = roomOf(p);
    const tallest = Math.max(1, ...dataOf(data).shapes.map((s) => s.height + 3));
    return { min: [-halfW, 0, -halfL], max: [halfW, bool(p, 'walls') ? num(p, 'roomHeight') : tallest, halfL] };
  },
};

/** A view from the middle row of each seating block, looking at `target`. */
export function seatingViews(blocks: Block[], target: Vec3): PresetView[] {
  return blocks
    .filter((b) => b.kind === 'seating')
    .map((b, i) => {
      if (b.kind !== 'seating') throw new Error('unreachable');
      const mid = Math.floor((b.rows - 1) / 2);
      const { d } = footprint(b);
      const [x, z] = toWorld(b.x, b.z, b.rotation, 0, -d / 2 + 0.5 + mid * ROW_DEPTH);
      return { id: `seat-${b.id}`, label: `Seating ${i + 1}`, position: [x, mid * b.rake + EYE_HEIGHT, z] as Vec3, target };
    });
}
