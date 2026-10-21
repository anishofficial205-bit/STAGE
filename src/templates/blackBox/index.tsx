/**
 * Black Box — an empty, usually black room with a flat floor. Instead of fixed
 * geometry the user arranges movable stage platforms and seating blocks.
 *
 * The blocks are this template's "data" (see TemplateDataHooks): saved and
 * exported with the project, regenerated when the starting layout changes,
 * and kept inside the room when it is resized.
 *
 * Layout (metres, Y up): the room is centred on the origin; the back wall is
 * at z = -roomLength / 2 (starting layouts put the stage there).
 */
import type { Bounds, PanelMessage, PresetView, StageTemplate, Surface, Vec3 } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { EYE_HEIGHT } from '../../helpers/views';
import { clampToRoom, footprint, makeLayout, overlappingIds, roomOf, sanitizeData, toWorld, ROW_DEPTH, type BlackBoxData } from './blocks';
import { BlackBoxScene } from './Scene';
import { BlackBoxPanel } from './Panel';
import { rect } from '../../helpers/stageInfo';
import { generateSeats } from '../../helpers/Seating';
import { blockSeats } from '../../helpers/seats';

const blocksOf = (data: unknown) => (data as BlackBoxData | undefined)?.blocks ?? [];

export const blackBoxTemplate: StageTemplate = {
  id: 'black-box',
  name: 'Black Box',
  description: 'Flexible room, arrange it yourself',
  audienceSides: ['custom'],

  presets: [
    { name: 'Studio', description: 'Small studio theatre, about 60 seats.', params: { roomWidth: 12, roomLength: 15, roomHeight: 6 }, resetData: true },
    { name: 'Medium flexible', description: 'Typical flexible theatre, about 120 seats.', params: { roomWidth: 15, roomLength: 20, roomHeight: 7 }, resetData: true },
    { name: 'Large flexible', description: 'Large flexible space for bigger layouts.', params: { roomWidth: 22, roomLength: 28, roomHeight: 9 }, resetData: true },
  ],

  params: [
    { key: 'roomWidth', label: 'Room width', group: 'Room', type: 'number', default: 15, min: 6, max: 40, step: 0.1 },
    { key: 'roomLength', label: 'Room length', group: 'Room', type: 'number', default: 20, min: 6, max: 50, step: 0.1 },
    { key: 'roomHeight', label: 'Room height', group: 'Room', type: 'number', default: 7, min: 3, max: 15, step: 0.1 },
    {
      key: 'wallColour',
      label: 'Wall colour',
      group: 'Room',
      type: 'select',
      default: 'black',
      options: [
        { value: 'black', label: 'Black' },
        { value: 'dark-grey', label: 'Dark grey' },
        { value: 'white', label: 'White' },
      ],
    },
    { key: 'lightingGrid', label: 'Lighting grid', group: 'Room', type: 'boolean', default: true },
    {
      key: 'layout',
      label: 'Layout',
      group: 'Starting layout',
      type: 'select',
      default: 'end-on',
      help: 'Choosing a layout replaces the current blocks.',
      options: [
        { value: 'end-on', label: 'End-on' },
        { value: 'thrust', label: 'Thrust' },
        { value: 'in-the-round', label: 'In-the-round' },
        { value: 'traverse', label: 'Traverse' },
        { value: 'l-shape', label: 'L-shape' },
        { value: 'empty', label: 'Empty' },
      ],
    },
  ],

  constraints: (p) => p,

  data: {
    initial: (p) => ({ blocks: makeLayout(str(p, 'layout'), roomOf(p)) }),
    sanitize: sanitizeData,
    onParamsChange: (next, prev, data) => {
      const room = roomOf(next);
      if (next.layout !== prev.layout) return { blocks: makeLayout(str(next, 'layout'), room) };
      // Room resized: keep every block inside.
      return { blocks: blocksOf(data).map((b) => clampToRoom(b, room)) };
    },
  },

  Panel: BlackBoxPanel,

  messages: (_p, data): PanelMessage[] => {
    const n = overlappingIds(blocksOf(data)).size;
    return n > 0 ? [{ kind: 'warning', text: `${n} blocks overlap (outlined in red). Drag them apart.` }] : [];
  },

  build: (p, data) => <BlackBoxScene p={p} data={{ blocks: blocksOf(data) }} />,

  presetViews: (p, data): PresetView[] => {
    const room = roomOf(p);
    const blocks = blocksOf(data);
    const platforms = blocks.filter((b) => b.kind === 'platform');
    // Look at the middle of all the platforms (or the room centre if there are none).
    const target: Vec3 = platforms.length
      ? [
          platforms.reduce((s, b) => s + b.x, 0) / platforms.length,
          platforms.reduce((s, b) => s + (b.kind === 'platform' ? b.height : 0), 0) / platforms.length + 1.2,
          platforms.reduce((s, b) => s + b.z, 0) / platforms.length,
        ]
      : [0, 1.2, 0];
    const views: PresetView[] = blocks
      .filter((b) => b.kind === 'seating')
      .map((b, i) => {
        if (b.kind !== 'seating') throw new Error('unreachable');
        const mid = Math.floor((b.rows - 1) / 2);
        const { d } = footprint(b);
        const [x, z] = toWorld(b.x, b.z, b.rotation, 0, -d / 2 + 0.5 + mid * ROW_DEPTH);
        return { id: `seat-${b.id}`, label: `Seating ${i + 1}`, position: [x, mid * b.rake + EYE_HEIGHT, z] as Vec3, target };
      });
    views.push({ id: 'corner', label: 'Corner view', position: [room.halfW - 0.6, room.height - 1, room.halfL - 0.6], target: [0, 0.5, 0] });
    return views;
  },

  surfaces: (p, data): Surface[] => {
    const { halfW, halfL, height } = roomOf(p);
    const out: Surface[] = [
      { id: 'wall-back', label: 'Back wall', position: [0, height / 2, -halfL], rotation: [0, 0, 0], width: halfW * 2, height },
      { id: 'wall-front', label: 'Front wall', position: [0, height / 2, halfL], rotation: [0, Math.PI, 0], width: halfW * 2, height },
      { id: 'wall-left', label: 'Left wall', position: [-halfW, height / 2, 0], rotation: [0, Math.PI / 2, 0], width: halfL * 2, height },
      { id: 'wall-right', label: 'Right wall', position: [halfW, height / 2, 0], rotation: [0, -Math.PI / 2, 0], width: halfL * 2, height },
      { id: 'floor', label: 'Floor', position: [0, 0.005, 0], rotation: [-Math.PI / 2, 0, 0], width: halfW * 2, height: halfL * 2 },
    ];
    blocksOf(data)
      .filter((b) => b.kind === 'platform')
      .forEach((b, i) => {
        if (b.kind !== 'platform') return;
        const t = (b.rotation * Math.PI) / 180;
        const [fx, fz] = toWorld(b.x, b.z, b.rotation, 0, b.depth / 2);
        out.push(
          { id: `platform-${b.id}-top`, label: `Platform ${i + 1} top`, position: [b.x, b.height, b.z], rotation: [-Math.PI / 2, 0, t], width: b.width, height: b.depth },
          { id: `platform-${b.id}-front`, label: `Platform ${i + 1} front`, position: [fx, b.height / 2, fz], rotation: [0, t, 0], width: b.width, height: b.height },
        );
      });
    return out;
  },

  stage: (p, data) => {
    const { halfW, halfL, height } = roomOf(p);
    const floors = [{ outline: rect(-halfW, -halfL, halfW, halfL), height: 0 }];
    for (const b of blocksOf(data)) {
      if (b.kind !== 'platform') continue;
      const c = [[-b.width / 2, -b.depth / 2], [b.width / 2, -b.depth / 2], [b.width / 2, b.depth / 2], [-b.width / 2, b.depth / 2]] as const;
      floors.push({ outline: c.map(([x, z]) => toWorld(b.x, b.z, b.rotation, x, z)), height: b.height });
    }
    // The lighting grid pipes (same spacing as drawn in the scene).
    const rigging: [Vec3, Vec3][] = [];
    if (bool(p, 'lightingGrid')) {
      const y = height - 0.6;
      for (let x = -halfW + 0.5; x <= halfW - 0.5 + 1e-6; x += 1.5) rigging.push([[x, y, -halfL + 0.3], [x, y, halfL - 0.3]]);
      for (let z = -halfL + 0.5; z <= halfL - 0.5 + 1e-6; z += 1.5) rigging.push([[-halfW + 0.3, y, z], [halfW - 0.3, y, z]]);
    }
    return { centre: [0, 0], floors, rigging };
  },

  seats: (_p, data) => {
    let n = 0;
    return blocksOf(data).flatMap((b) => {
      if (b.kind !== 'seating') return [];
      const { d } = footprint(b);
      // Same layout as the scene: rows start 0.5 m behind the block's front edge.
      const local = generateSeats({ rows: b.rows, seatsPerRow: b.seatsPerRow, firstRowDistance: 0.5, rowSpacing: ROW_DEPTH, rise: b.rake }).map((s) => ({ ...s, z: s.z - d / 2 }));
      return blockSeats(local, [b.x, 0, b.z], (b.rotation * Math.PI) / 180, `Block ${++n}`);
    });
  },

  bounds: (p): Bounds => {
    const { halfW, halfL } = roomOf(p);
    return { min: [-halfW, 0, -halfL], max: [halfW, num(p, 'roomHeight'), halfL] };
  },
};
