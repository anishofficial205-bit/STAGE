/**
 * Traverse — a long, narrow playing area with the audience on two opposite
 * sides facing each other, like a fashion runway.
 *
 * Layout (metres, Y up):
 *   - The runway runs along Z, centred on the origin: end A at z = -length/2,
 *     end B at z = +length/2.
 *   - Side 1 seating is on -X, side 2 on +X, both facing the runway.
 *   - End wall A (with an optional entrance) stands right at end A; end wall B
 *     stands a little beyond end B, leaving room for photographers.
 */
import type { Bounds, Params, PresetView, StageTemplate, Surface, Vec3 } from '../../types';
import { bool, num } from '../../helpers/params';
import { DimensionLabel } from '../../helpers/DimensionLabel';
import { Seating, type SeatingOptions } from '../../helpers/Seating';
import { Box, Panel, Slab, Truss, WallWithOpening, archOutline } from '../../helpers/primitives';
import { COLORS } from '../../helpers/materials';
import { EYE_HEIGHT } from '../../helpers/views';

const WALL = 0.3;
const END_B_CLEARANCE = 3; // space beyond end B (photographers' pit)

function layout(p: Params) {
  const len = num(p, 'stageLength');
  const w = num(p, 'stageWidth');
  const raised = bool(p, 'raised');
  const h = raised ? num(p, 'stageHeight') : 0;
  const gap = num(p, 'gap');
  const rowSpacing = num(p, 'rowSpacing');
  const rise = num(p, 'rake');
  const rows1 = num(p, 'rows1');
  const rows2 = num(p, 'rows2');
  const seatLen = bool(p, 'matchLength') ? len : num(p, 'seatingLength');
  const wallH = num(p, 'wallHeight');
  const openW = num(p, 'entranceWidth');
  const openH = Math.min(3.2, wallH - 0.5);
  // End walls span the whole room: runway + both seating banks + a walkway.
  const halfRoom = w / 2 + gap + Math.max(rows1, rows2) * rowSpacing + 1.5;
  const zA = -len / 2;
  const zB = Math.max(len / 2, seatLen / 2) + END_B_CLEARANCE;
  const side = (rows: number): SeatingOptions => ({ rows, firstRowDistance: gap, rowSpacing, rise, rowWidth: seatLen });
  return { len, w, h, raised, gap, rowSpacing, rise, rows1, rows2, seatLen, wallH, openW, openH, halfRoom, zA, zB, side1: side(rows1), side2: side(rows2) };
}

function Scene({ p }: { p: Params }) {
  const L = layout(p);
  const { len, w, h, wallH, halfRoom, zA, zB } = L;
  const wallA = bool(p, 'wallA');
  const entrance = wallA && bool(p, 'entrance');
  const truss = bool(p, 'truss');
  const trussH = num(p, 'trussHeight');
  const tx = w / 2 + 0.3;
  const crossBeams = Math.max(2, Math.round(len / 5) + 1);

  return (
    <group>
      <Slab
        outline={[[-w / 2, zA], [w / 2, zA], [w / 2, len / 2], [-w / 2, len / 2]]}
        top={Math.max(h, 0.02)}
        color={L.raised ? COLORS.stageFloor : COLORS.stageEdge}
      />

      {wallA &&
        (entrance ? (
          <>
            <WallWithOpening width={2 * halfRoom} height={wallH} thickness={WALL} front={zA} opening={archOutline(L.openW / 2, 0, L.openH, 0)} color={COLORS.wall} />
            {/* Dark backstage space seen through the entrance */}
            <Panel position={[0, L.openH / 2, zA - WALL - 1.5]} width={L.openW + 1} height={L.openH} color={COLORS.dark} />
          </>
        ) : (
          <Box from={[-halfRoom, 0, zA - WALL]} to={[halfRoom, wallH, zA]} color={COLORS.wall} />
        ))}
      {/* One-sided, so the default view from beyond end B can see in. */}
      {bool(p, 'wallB') && <Panel position={[0, wallH / 2, zB]} rotationY={Math.PI} width={2 * halfRoom} height={wallH} color={COLORS.wall} oneSided />}

      <Seating {...L.side1} position={[-w / 2, 0, 0]} rotationY={-Math.PI / 2} />
      <Seating {...L.side2} position={[w / 2, 0, 0]} rotationY={Math.PI / 2} />

      {truss && (
        <group>
          <Truss from={[-tx, trussH, zA]} to={[-tx, trussH, len / 2]} color={COLORS.truss} />
          <Truss from={[tx, trussH, zA]} to={[tx, trussH, len / 2]} color={COLORS.truss} />
          {Array.from({ length: crossBeams }, (_, i) => {
            const z = zA + (len * i) / (crossBeams - 1);
            return <Truss key={i} from={[-tx + 0.2, trussH, z]} to={[tx - 0.2, trussH, z]} size={0.3} color={COLORS.truss} />;
          })}
        </group>
      )}

      <DimensionLabel start={[w / 2, h, zA]} end={[w / 2, h, len / 2]} offset={[0.5, 0.3, 0]} label="Runway" />
      <DimensionLabel start={[-w / 2, h, len / 2]} end={[w / 2, h, len / 2]} offset={[0, 0.3, 0.5]} label="Width" />
      {entrance && <DimensionLabel start={[-L.openW / 2, L.openH, zA + 0.1]} end={[L.openW / 2, L.openH, zA + 0.1]} offset={[0, 0.3, 0]} label="Entrance" />}
    </group>
  );
}

export const traverseTemplate: StageTemplate = {
  id: 'traverse',
  name: 'Traverse',
  description: 'Long runway, audience on two sides',
  audienceSides: ['left', 'right'],

  dimensions: { width: 'stageWidth', depth: 'stageLength', height: 'stageHeight' },
  presets: [
    {
      name: 'Studio traverse',
      description: 'Floor-level playing strip between two small banks.',
      params: { stageLength: 12, stageWidth: 5, raised: false, wallA: true, wallB: true, entrance: true, rows1: 4, rows2: 4, truss: false },
    },
    {
      name: 'Fashion show',
      description: 'Narrow raised runway with front-row seating and a lighting truss.',
      params: { stageLength: 25, stageWidth: 3, raised: true, stageHeight: 0.6, wallA: true, wallB: false, entrance: true, entranceWidth: 3, rows1: 3, rows2: 3, rake: 0.25, gap: 0.6, truss: true, trussHeight: 6 },
    },
    {
      name: 'Catwalk gala',
      description: 'Long, wide runway for a big event.',
      params: { stageLength: 35, stageWidth: 4, raised: true, stageHeight: 0.8, wallA: true, wallB: false, entrance: true, entranceWidth: 4, rows1: 6, rows2: 6, truss: true, trussHeight: 7 },
    },
  ],

  params: [
    { key: 'stageLength', label: 'Stage length', group: 'Stage', type: 'number', default: 20, min: 6, max: 60, step: 0.1 },
    { key: 'stageWidth', label: 'Stage width', group: 'Stage', type: 'number', default: 4, min: 1.5, max: 15, step: 0.1 },
    { key: 'raised', label: 'Raised runway', group: 'Stage', type: 'boolean', default: true, help: 'Off: the playing area is at floor level.' },
    { key: 'stageHeight', label: 'Stage height', group: 'Stage', type: 'number', default: 0.6, min: 0, max: 1.5, step: 0.05, help: 'Height of the stage floor above the audience floor.', visible: (p) => bool(p, 'raised') },
    { key: 'wallA', label: 'End wall at end A', group: 'End walls', type: 'boolean', default: true },
    { key: 'wallB', label: 'End wall at end B', group: 'End walls', type: 'boolean', default: false },
    { key: 'wallHeight', label: 'End wall height', group: 'End walls', type: 'number', default: 6, min: 3, max: 15, step: 0.1, visible: (p) => bool(p, 'wallA') || bool(p, 'wallB') },
    { key: 'entrance', label: 'Entrance in end wall A', group: 'End walls', type: 'boolean', default: true, visible: (p) => bool(p, 'wallA') },
    { key: 'entranceWidth', label: 'Entrance width', group: 'End walls', type: 'number', default: 3, min: 1, max: 16, step: 0.1, help: 'At most the stage width plus 1 m.', visible: (p) => bool(p, 'wallA') && bool(p, 'entrance') },
    { key: 'rows1', label: 'Rows on side 1', group: 'Seating', type: 'number', unit: 'none', default: 6, min: 0, max: 30, step: 1 },
    { key: 'rows2', label: 'Rows on side 2', group: 'Seating', type: 'number', unit: 'none', default: 6, min: 0, max: 30, step: 1 },
    { key: 'rowSpacing', label: 'Row spacing', group: 'Seating', type: 'number', default: 0.9, min: 0.75, max: 1.5, step: 0.05, help: 'Distance from one row to the next.' },
    { key: 'rake', label: 'Rake (rise per row)', group: 'Seating', type: 'number', default: 0.2, min: 0, max: 0.5, step: 0.01, help: 'How much higher each row is than the one in front.' },
    { key: 'gap', label: 'Gap to first row', group: 'Seating', type: 'number', default: 1, min: 0.3, max: 5, step: 0.1 },
    { key: 'matchLength', label: 'Seating length matches stage', group: 'Seating', type: 'boolean', default: true },
    { key: 'seatingLength', label: 'Seating length', group: 'Seating', type: 'number', default: 20, min: 3, max: 80, step: 0.1, visible: (p) => !bool(p, 'matchLength') },
    { key: 'truss', label: 'Truss over the runway', group: 'Overhead', type: 'boolean', default: false },
    { key: 'trussHeight', label: 'Truss height', group: 'Overhead', type: 'number', default: 6, min: 3, max: 15, step: 0.1, visible: (p) => bool(p, 'truss') },
  ],

  constraints: (p) => ({ ...p, entranceWidth: Math.min(num(p, 'entranceWidth'), num(p, 'stageWidth') + 1) }),

  build: (p) => <Scene p={p} />,

  presetViews: (p): PresetView[] => {
    const L = layout(p);
    const views: PresetView[] = [];
    const across = (side: -1 | 1, rows: number) => {
      const k = Math.min(2, Math.max(0, rows - 1));
      return [side * (L.w / 2 + L.gap + k * L.rowSpacing), k * L.rise + EYE_HEIGHT, 0] as Vec3;
    };
    if (L.rows1 > 0) views.push({ id: 'side1', label: 'Side 1 centre', position: across(-1, L.rows1), target: [0, L.h + 1.2, 0] });
    if (L.rows2 > 0) views.push({ id: 'side2', label: 'Side 2 centre', position: across(1, L.rows2), target: [0, L.h + 1.2, 0] });
    views.push(
      // At the entrance, as a model steps out.
      { id: 'end-a', label: 'End A down the runway', position: [0, L.h + 1.7, L.zA + 0.8], target: [0, L.h + 1.2, L.len / 2] },
      // The photographers' pit: low, at the end of the runway, looking back up it.
      { id: 'end-b', label: 'End B down the runway', position: [0, Math.max(1.3, L.h + 0.4), L.len / 2 + 2.5], target: [0, L.h + 1.5, L.zA + 2] },
    );
    return views;
  },

  surfaces: (p): Surface[] => {
    const L = layout(p);
    const trussH = num(p, 'trussHeight');
    return [
      { id: 'stage-floor', label: 'Stage floor', position: [0, L.h, 0], rotation: [-Math.PI / 2, 0, 0], width: L.w, height: L.len },
      { id: 'stage-side-1', label: 'Stage side edge (side 1)', position: [-L.w / 2, L.h / 2, 0], rotation: [0, -Math.PI / 2, 0], width: L.len, height: L.h },
      { id: 'stage-side-2', label: 'Stage side edge (side 2)', position: [L.w / 2, L.h / 2, 0], rotation: [0, Math.PI / 2, 0], width: L.len, height: L.h },
      { id: 'end-wall-a', label: 'End wall A', position: [0, L.wallH / 2, L.zA], rotation: [0, 0, 0], width: 2 * L.halfRoom, height: L.wallH },
      { id: 'end-wall-b', label: 'End wall B', position: [0, L.wallH / 2, L.zB], rotation: [0, Math.PI, 0], width: 2 * L.halfRoom, height: L.wallH },
      { id: 'truss', label: 'Truss', position: [0, trussH, 0], rotation: [Math.PI / 2, 0, 0], width: L.w + 0.6, height: L.len },
    ];
  },

  bounds: (p): Bounds => {
    const L = layout(p);
    const top = Math.max(L.wallH, bool(p, 'truss') ? num(p, 'trussHeight') : 0, 3);
    return { min: [-L.halfRoom, 0, Math.min(L.zA - WALL, -L.seatLen / 2)], max: [L.halfRoom, top, L.zB] };
  },
};
