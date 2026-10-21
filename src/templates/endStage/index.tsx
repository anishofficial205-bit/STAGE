/**
 * End Stage — the stage simply sits at one end of a room (school halls,
 * auditoriums, modern venues). No arch, no deep wings, no fly tower.
 *
 * Layout (metres, Y up):
 *   - The stage's front edge is at z = 0 (its furthest point when curved); it
 *     runs back to the back wall at z = -stageDepth.
 *   - The room runs from the back wall forwards for `roomLength`.
 *   - Room side/rear walls are one-sided, so you can always see in from outside.
 *   - Seating that doesn't fit the room is trimmed automatically (with a
 *     warning in the panel); the requested values are kept, so making the room
 *     bigger brings the rows back.
 */
import type { Bounds, PanelMessage, Params, PresetView, StageTemplate, Surface, Vec3 } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { DimensionLabel } from '../../helpers/DimensionLabel';
import { Seating, fitRowWidth, rowCentre, seatingExtent, type SeatingOptions } from '../../helpers/Seating';
import { Box, Panel, Slab } from '../../helpers/primitives';
import { bulgedRect } from '../../helpers/shapes';
import { COLORS } from '../../helpers/materials';
import { EYE_HEIGHT } from '../../helpers/views';

const WALL = 0.3;
const REAR_AISLE = 1; // walkway kept free behind the last row
const SIDE_AISLE = 1; // walkway kept free between seating and side walls

function layout(p: Params) {
  const stageW = num(p, 'stageWidth');
  const stageD = num(p, 'stageDepth');
  const h = num(p, 'stageHeight');
  const roomW = num(p, 'roomWidth');
  const roomL = num(p, 'roomLength');
  const wallH = num(p, 'backWallHeight');
  const bulge = str(p, 'frontShape') === 'curved' ? Math.min(stageD * 0.3, stageW * 0.12) : 0;
  const roomFront = -stageD + roomL; // z of the rear wall

  const requested: SeatingOptions = {
    rows: num(p, 'rows'),
    firstRowDistance: num(p, 'gap'),
    rowSpacing: num(p, 'rowSpacing'),
    rise: num(p, 'rake'),
    rowWidth: num(p, 'seatingWidth'),
    curve: num(p, 'curve'),
    aisles: 2,
    aisleWidth: 1.2,
  };
  // Fit the rows into the room length, then the row width into the room width.
  const room = roomFront - REAR_AISLE - requested.firstRowDistance;
  const maxRows = Math.max(0, Math.floor(room / requested.rowSpacing + 1e-6));
  const rows = Math.min(Math.floor(requested.rows), maxRows);
  const fitted: SeatingOptions = { ...requested, rows };
  fitted.rowWidth = rows > 0 ? fitRowWidth(fitted, roomW / 2 - SIDE_AISLE) : requested.rowWidth;

  return { stageW, stageD, h, roomW, roomL, roomFront, wallH, bulge, requested, seating: fitted, maxRows };
}

function Scene({ p }: { p: Params }) {
  const L = layout(p);
  const { stageW, stageD, h, roomW, roomL, roomFront, wallH } = L;
  const zMid = -stageD + roomL / 2;
  const legH = Math.max(1, Math.min(wallH - h - 0.5, 6));

  return (
    <group>
      <Slab outline={bulgedRect(stageW, -stageD, 0, L.bulge)} top={Math.max(h, 0.02)} color={COLORS.stageFloor} />
      <Box from={[-roomW / 2 - WALL, 0, -stageD - WALL]} to={[roomW / 2 + WALL, wallH, -stageD]} color={COLORS.wall} />

      {bool(p, 'sideWalls') && (
        <>
          <Panel position={[-roomW / 2, wallH / 2, zMid]} rotationY={Math.PI / 2} width={roomL} height={wallH} color={COLORS.wall} oneSided />
          <Panel position={[roomW / 2, wallH / 2, zMid]} rotationY={-Math.PI / 2} width={roomL} height={wallH} color={COLORS.wall} oneSided />
          <Panel position={[0, wallH / 2, roomFront]} rotationY={Math.PI} width={roomW} height={wallH} color={COLORS.wall} oneSided />
        </>
      )}

      {bool(p, 'masking') && (
        <>
          <Box from={[-stageW / 2, h, -1.05]} to={[-stageW / 2 + 1.2, h + legH, -0.95]} color={COLORS.dark} />
          <Box from={[stageW / 2 - 1.2, h, -1.05]} to={[stageW / 2, h + legH, -0.95]} color={COLORS.dark} />
        </>
      )}

      <Seating {...L.seating} />

      <DimensionLabel start={[-stageW / 2, h, -L.bulge]} end={[stageW / 2, h, -L.bulge]} offset={[0, 0.3, 0.6]} label="Stage" />
      <DimensionLabel start={[stageW / 2, h, -stageD]} end={[stageW / 2, h, 0]} offset={[0.6, 0.3, 0]} label="Depth" />
      <DimensionLabel start={[-roomW / 2, 0.05, roomFront]} end={[roomW / 2, 0.05, roomFront]} offset={[0, 0, -0.5]} label="Room" />
      <DimensionLabel start={[roomW / 2, 0.05, -stageD]} end={[roomW / 2, 0.05, roomFront]} offset={[-0.5, 0, 0]} label="Room length" />
    </group>
  );
}

const hasRows = (p: Params) => num(p, 'rows') > 0;

export const endStageTemplate: StageTemplate = {
  id: 'end-stage',
  name: 'End Stage',
  description: 'Audience in front, no arch',
  audienceSides: ['front'],

  params: [
    { key: 'stageWidth', label: 'Stage width', group: 'Stage', type: 'number', default: 12, min: 3, max: 40, step: 0.1, help: 'Can never be wider than the room.' },
    { key: 'stageDepth', label: 'Stage depth', group: 'Stage', type: 'number', default: 8, min: 2, max: 25, step: 0.1 },
    { key: 'stageHeight', label: 'Stage height', group: 'Stage', type: 'number', default: 0.9, min: 0, max: 2, step: 0.05 },
    { key: 'frontShape', label: 'Front edge shape', group: 'Stage', type: 'select', default: 'straight', options: [{ value: 'straight', label: 'Straight' }, { value: 'curved', label: 'Curved' }] },
    { key: 'backWallHeight', label: 'Back wall height', group: 'Room', type: 'number', default: 8, min: 3, max: 20, step: 0.1 },
    { key: 'sideWalls', label: 'Side walls', group: 'Room', type: 'boolean', default: true },
    { key: 'roomWidth', label: 'Room width', group: 'Room', type: 'number', default: 24, min: 8, max: 60, step: 0.1 },
    { key: 'roomLength', label: 'Room length', group: 'Room', type: 'number', default: 35, min: 10, max: 80, step: 0.1, help: 'From the back wall behind the stage to the rear wall.' },
    { key: 'masking', label: 'Side masking curtains', group: 'Room', type: 'boolean', default: false, help: 'Vertical panels at the stage edges that hide performers waiting to enter.' },
    { key: 'rows', label: 'Number of rows', group: 'Seating', type: 'number', unit: 'none', default: 15, min: 0, max: 50, step: 1 },
    { key: 'rowSpacing', label: 'Row spacing', group: 'Seating', type: 'number', default: 0.9, min: 0.75, max: 1.5, step: 0.05, visible: hasRows },
    { key: 'rake', label: 'Rake (rise per row)', group: 'Seating', type: 'number', default: 0.15, min: 0, max: 0.5, step: 0.01, help: 'How much higher each row is than the one in front.', visible: hasRows },
    { key: 'curve', label: 'Seating curve', group: 'Seating', type: 'number', unit: 'none', default: 0.2, min: 0, max: 1, step: 0.05, help: '0 = straight rows, 1 = strongly curved.', visible: hasRows },
    { key: 'seatingWidth', label: 'Seating width', group: 'Seating', type: 'number', default: 16, min: 4, max: 60, step: 0.1, visible: hasRows },
    { key: 'gap', label: 'Gap to first row', group: 'Seating', type: 'number', default: 2, min: 0.5, max: 10, step: 0.1, visible: hasRows },
  ],

  constraints: (p) => ({ ...p, stageWidth: Math.min(num(p, 'stageWidth'), num(p, 'roomWidth')) }),

  messages: (p): PanelMessage[] => {
    const L = layout(p);
    const out: PanelMessage[] = [];
    const want = Math.floor(L.requested.rows);
    if (L.seating.rows < want) {
      out.push({
        kind: 'warning',
        text: `The room is too short for ${want} rows, so only ${L.seating.rows} fit. Make the room longer, the stage shallower or the gap smaller to get them back.`,
      });
    }
    if (L.seating.rows > 0 && (L.seating.rowWidth ?? 0) < (L.requested.rowWidth ?? 0) - 0.05) {
      out.push({ kind: 'warning', text: 'Seating has been narrowed to leave a 1 m aisle along each side wall.' });
    }
    return out;
  },

  build: (p) => <Scene p={p} />,

  presetViews: (p): PresetView[] => {
    const L = layout(p);
    const s = L.seating;
    const target: Vec3 = [0, L.h + 1.5, -L.stageD * 0.4];
    if (s.rows === 0) return [];
    const seat = (row: number): Vec3 => {
      const c = rowCentre(s, row);
      return [0, c[1] + EYE_HEIGHT, c[2]];
    };
    const mid = Math.floor(s.rows / 2);
    const aisleX = Math.min(seatingExtent(s).halfWidth + 0.6, L.roomW / 2 - 0.5);
    const midRow = rowCentre(s, mid);
    return [
      { id: 'front-row', label: 'Front row', position: seat(0), target },
      { id: 'middle', label: 'Middle', position: seat(mid), target },
      { id: 'back-row', label: 'Back row', position: seat(s.rows - 1), target },
      { id: 'side-aisle', label: 'Side aisle', position: [aisleX, midRow[1] + 1.6, midRow[2]], target },
    ];
  },

  surfaces: (p): Surface[] => {
    const L = layout(p);
    const zMid = -L.stageD + L.roomL / 2;
    const legH = Math.max(1, Math.min(L.wallH - L.h - 0.5, 6));
    return [
      { id: 'back-wall', label: 'Back wall', position: [0, L.wallH / 2, -L.stageD], rotation: [0, 0, 0], width: L.roomW, height: L.wallH },
      { id: 'stage-floor', label: 'Stage floor', position: [0, L.h, -L.stageD / 2], rotation: [-Math.PI / 2, 0, 0], width: L.stageW, height: L.stageD },
      { id: 'stage-front', label: 'Stage front edge', position: [0, L.h / 2, 0], rotation: [0, 0, 0], width: L.stageW, height: L.h },
      { id: 'left-wall', label: 'Left side wall', position: [-L.roomW / 2, L.wallH / 2, zMid], rotation: [0, Math.PI / 2, 0], width: L.roomL, height: L.wallH },
      { id: 'right-wall', label: 'Right side wall', position: [L.roomW / 2, L.wallH / 2, zMid], rotation: [0, -Math.PI / 2, 0], width: L.roomL, height: L.wallH },
      { id: 'left-masking', label: 'Left masking', position: [-L.stageW / 2 + 0.6, L.h + legH / 2, -0.95], rotation: [0, 0, 0], width: 1.2, height: legH },
      { id: 'right-masking', label: 'Right masking', position: [L.stageW / 2 - 0.6, L.h + legH / 2, -0.95], rotation: [0, 0, 0], width: 1.2, height: legH },
    ];
  },

  bounds: (p): Bounds => {
    const L = layout(p);
    return { min: [-L.roomW / 2 - WALL, 0, -L.stageD - WALL], max: [L.roomW / 2 + WALL, L.wallH, L.roomFront] };
  },
};
