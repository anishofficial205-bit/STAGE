/**
 * Proscenium — a traditional theatre: the stage is framed by an arch, the
 * audience sits on one side facing it.
 *
 * Layout (metres, Y up):
 *   - The arch / proscenium wall sits on the "plaster line", z = 0.
 *   - The main stage runs back from z = 0 to z = -stageDepth; the wings extend
 *     either side of it behind the arch.
 *   - The apron projects forward of the arch (towards +Z), then the optional
 *     orchestra pit, then the stalls seating. An optional balcony sits above
 *     and behind the stalls.
 *   - Wall heights are measured from the stage floor.
 */
import type { Bounds, Params, PresetView, StageTemplate, Surface, Vec3 } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { DimensionLabel } from '../../helpers/DimensionLabel';
import { Seating, SeatingFront, rowCentre, seatingExtent, type SeatingOptions } from '../../helpers/Seating';
import { Box, OpeningFrame, Slab, WallWithOpening, archOutline } from '../../helpers/primitives';
import { bulgedRect } from '../../helpers/shapes';
import { COLORS } from '../../helpers/materials';
import { EYE_HEIGHT } from '../../helpers/views';

const WALL = 0.3; // thickness of back and side walls
const PROS_WALL = 0.6; // thickness of the proscenium wall
const FRAME_DEPTH = 0.75; // the arch frame stands 0.15 m proud of the wall

/** Everything derived from params, shared by the scene, views, surfaces and bounds. */
function layout(p: Params) {
  const stageW = num(p, 'stageWidth');
  const stageD = num(p, 'stageDepth');
  const h = num(p, 'stageHeight');
  const apron = num(p, 'apronDepth');
  const archW = num(p, 'archWidth');
  const archH = num(p, 'archHeight');
  const frame = num(p, 'frameThickness');
  const wing = num(p, 'wingWidth');
  const wallH = num(p, 'backWallHeight');
  const pit = bool(p, 'pit');
  const pitD = num(p, 'pitDepth');

  // The stage house is wide enough for the stage plus wings, and always wider than the arch frame.
  const houseW = Math.max(stageW + 2 * wing, archW + 2 * frame + 0.6);
  // The apron stays within the arch frame's outer width.
  const apronW = Math.min(archW + 2 * frame, houseW);
  const bulge = str(p, 'apronShape') === 'curved' ? apron * 0.6 : 0;
  const archRise = str(p, 'archTop') === 'rounded' ? Math.min(archW / 2, archH * 0.3) : 0;
  // A fly tower raises the walls of the stage house well above the arch.
  const houseTop = bool(p, 'flyTower') ? Math.max(wallH + 4, archH * 2.6) : wallH;
  // The pit pushes the audience back by its own depth.
  const seatingZ = apron + (pit ? pitD : 0);

  const stalls: SeatingOptions = {
    rows: num(p, 'rows'),
    firstRowDistance: num(p, 'gap'),
    rowSpacing: num(p, 'rowSpacing'),
    rise: num(p, 'rake'),
    rowWidth: num(p, 'seatingWidth'),
    curve: num(p, 'curve'),
    aisles: 2,
    aisleWidth: 1.2,
  };
  const stallsRows = Math.floor(stalls.rows);
  const balconyBase = Math.max(3.5, Math.max(0, stallsRows - 1) * stalls.rise + 3.2);
  const balcony: SeatingOptions | null = bool(p, 'balcony')
    ? {
        ...stalls,
        rows: num(p, 'balconyRows'),
        // Overhangs the back ~45% of the stalls.
        firstRowDistance: stalls.firstRowDistance + stallsRows * stalls.rowSpacing * 0.55,
        rise: Math.max(stalls.rise, 0.35),
        baseHeight: balconyBase,
        riserFrom: balconyBase - 0.45,
      }
    : null;

  return { stageW, stageD, h, apron, apronW, bulge, archW, archH, archRise, frame, wing, wallH, houseW, houseTop, pit, pitD, seatingZ, stalls, balcony, balconyBase };
}

function Scene({ p }: { p: Params }) {
  const L = layout(p);
  const { stageW, stageD, h, houseW, houseTop, archW, archH, archRise, frame } = L;
  const floorTop = Math.max(h, 0.02);
  const wallTop = h + houseTop;
  const opening = archOutline(archW / 2, 0, h + archH, archRise);

  return (
    <group>
      {/* Main stage, with the wings in a slightly darker tone either side */}
      <Box from={[-stageW / 2, 0, -stageD]} to={[stageW / 2, floorTop, 0]} color={COLORS.stageFloor} />
      <Box from={[-houseW / 2, 0, -stageD]} to={[-stageW / 2, floorTop, 0]} color={COLORS.stageEdge} />
      <Box from={[stageW / 2, 0, -stageD]} to={[houseW / 2, floorTop, 0]} color={COLORS.stageEdge} />

      {/* Apron, in front of the arch */}
      {L.apron > 0.01 && <Slab outline={bulgedRect(L.apronW, -0.01, L.apron, L.bulge)} top={floorTop} color={COLORS.stageFloor} />}

      {/* Back wall and the side walls of the stage house */}
      <Box from={[-houseW / 2 - WALL, 0, -stageD - WALL]} to={[houseW / 2 + WALL, wallTop, -stageD]} color={COLORS.wall} />
      <Box from={[-houseW / 2 - WALL, 0, -stageD]} to={[-houseW / 2, wallTop, -PROS_WALL]} color={COLORS.wall} />
      <Box from={[houseW / 2, 0, -stageD]} to={[houseW / 2 + WALL, wallTop, -PROS_WALL]} color={COLORS.wall} />

      {/* Proscenium wall with the arch opening, and the darker arch frame around it */}
      <WallWithOpening width={houseW + 2 * WALL} height={wallTop} thickness={PROS_WALL} front={0} opening={opening} color={COLORS.wall} />
      <OpeningFrame
        inner={archOutline(archW / 2, h, h + archH, archRise)}
        outer={archOutline(archW / 2, h, h + archH, archRise, frame)}
        depth={FRAME_DEPTH}
        front={0.15}
        color={COLORS.frame}
      />

      {/* Orchestra pit: a dark well between apron and audience, with a rail */}
      {L.pit && (
        <group>
          <Box from={[-L.apronW / 2, 0, L.apron - L.bulge]} to={[L.apronW / 2, 0.006, L.seatingZ]} color={COLORS.dark} castShadow={false} />
          <Box from={[-L.apronW / 2, 0, L.seatingZ - 0.08]} to={[L.apronW / 2, 0.9, L.seatingZ]} color={COLORS.frame} />
          <Box from={[-L.apronW / 2 - 0.08, 0, L.apron - L.bulge]} to={[-L.apronW / 2, 0.9, L.seatingZ]} color={COLORS.frame} />
          <Box from={[L.apronW / 2, 0, L.apron - L.bulge]} to={[L.apronW / 2 + 0.08, 0.9, L.seatingZ]} color={COLORS.frame} />
        </group>
      )}

      <Seating {...L.stalls} position={[0, 0, L.seatingZ]} />
      {L.balcony && L.balcony.rows > 0 && (
        <>
          <Seating {...L.balcony} position={[0, 0, L.seatingZ]} />
          <SeatingFront options={L.balcony} bottom={L.balconyBase - 0.45} top={L.balconyBase + 0.95} color={COLORS.frame} position={[0, 0, L.seatingZ]} />
        </>
      )}

      <DimensionLabel start={[-stageW / 2, h, -stageD]} end={[stageW / 2, h, -stageD]} offset={[0, 0.3, 0.8]} label="Stage" />
      <DimensionLabel start={[stageW / 2, h, 0]} end={[stageW / 2, h, -stageD]} offset={[-0.8, 0.3, 0]} label="Depth" />
      <DimensionLabel start={[-archW / 2, h + archH, 0.3]} end={[archW / 2, h + archH, 0.3]} offset={[0, -0.7, 0.2]} label="Arch" />
      <DimensionLabel start={[-archW / 2, h, 0.3]} end={[-archW / 2, h + archH, 0.3]} offset={[0.7, 0, 0.2]} label="Arch H" />
      {L.apron > 0.01 && <DimensionLabel start={[0, h, 0]} end={[0, h, L.apron]} offset={[0, 0.25, 0]} label="Apron" />}
    </group>
  );
}

const showSeats = (p: Params) => num(p, 'rows') > 0 || bool(p, 'balcony');

export const prosceniumTemplate: StageTemplate = {
  id: 'proscenium',
  name: 'Proscenium',
  description: 'Framed by an arch, audience in front',
  audienceSides: ['front'],

  dimensions: { width: 'stageWidth', depth: 'stageDepth', height: 'stageHeight' },
  presets: [
    {
      name: 'School auditorium',
      description: 'Modest stage, single raked seating block, no fly tower.',
      params: { stageWidth: 10, stageDepth: 7, stageHeight: 0.9, apronDepth: 1.2, archWidth: 9, archHeight: 5, frameThickness: 0.6, wingWidth: 2, backWallHeight: 7, flyTower: false, pit: false, rows: 18, seatingWidth: 16, curve: 0.2, balcony: false },
    },
    {
      name: 'City theatre',
      description: 'Mid-size house with fly tower, orchestra pit and a balcony.',
      params: { stageWidth: 14, stageDepth: 12, stageHeight: 1, apronDepth: 2, archWidth: 12, archHeight: 8, frameThickness: 1.2, wingWidth: 5, backWallHeight: 16, flyTower: true, pit: true, pitDepth: 2.5, rows: 22, seatingWidth: 22, curve: 0.35, balcony: true, balconyRows: 8 },
    },
    {
      name: 'Grand opera house',
      description: 'Very large stage and wings, deep pit, rounded arch, big balcony.',
      params: { stageWidth: 20, stageDepth: 22, stageHeight: 1.1, apronDepth: 3, archWidth: 16, archHeight: 12, frameThickness: 2, archTop: 'rounded', wingWidth: 10, backWallHeight: 25, flyTower: true, pit: true, pitDepth: 4.5, rows: 28, seatingWidth: 28, curve: 0.5, balcony: true, balconyRows: 10 },
    },
  ],

  params: [
    // Stage
    { key: 'stageWidth', label: 'Stage width', group: 'Stage', type: 'number', default: 12, min: 4, max: 40, step: 0.1 },
    { key: 'stageDepth', label: 'Stage depth', group: 'Stage', type: 'number', default: 10, min: 3, max: 30, step: 0.1, help: 'From the arch back to the back wall.' },
    { key: 'stageHeight', label: 'Stage height', group: 'Stage', type: 'number', default: 1, min: 0, max: 2.5, step: 0.05, help: 'Height of the stage floor above the audience floor.' },
    { key: 'apronDepth', label: 'Apron depth', group: 'Stage', type: 'number', default: 2, min: 0, max: 6, step: 0.1, help: 'The part of the stage in front of the arch.' },
    { key: 'apronShape', label: 'Apron shape', group: 'Stage', type: 'select', default: 'curved', options: [{ value: 'straight', label: 'Straight' }, { value: 'curved', label: 'Curved' }], visible: (p) => num(p, 'apronDepth') > 0 },
    // Proscenium arch
    { key: 'archWidth', label: 'Arch opening width', group: 'Proscenium arch', type: 'number', default: 10, min: 3, max: 30, step: 0.1, help: 'Can never be wider than the stage.' },
    { key: 'archHeight', label: 'Arch opening height', group: 'Proscenium arch', type: 'number', default: 7, min: 3, max: 20, step: 0.1, help: 'Measured from the stage floor. Limited by the back wall height.' },
    { key: 'frameThickness', label: 'Arch frame thickness', group: 'Proscenium arch', type: 'number', default: 1, min: 0.3, max: 3, step: 0.05 },
    { key: 'archTop', label: 'Arch top shape', group: 'Proscenium arch', type: 'select', default: 'flat', options: [{ value: 'flat', label: 'Flat' }, { value: 'rounded', label: 'Rounded' }] },
    // Wings and walls
    { key: 'wingWidth', label: 'Wing width (each side)', group: 'Wings and walls', type: 'number', default: 3, min: 0, max: 10, step: 0.1, help: 'Offstage space either side, hidden behind the arch.' },
    { key: 'backWallHeight', label: 'Back wall height', group: 'Wings and walls', type: 'number', default: 12, min: 4, max: 30, step: 0.1 },
    { key: 'flyTower', label: 'Fly tower', group: 'Wings and walls', type: 'boolean', default: false, help: 'A tall stage house above the stage for flying scenery.' },
    { key: 'pit', label: 'Orchestra pit', group: 'Wings and walls', type: 'boolean', default: false },
    { key: 'pitDepth', label: 'Pit depth (front to back)', group: 'Wings and walls', type: 'number', default: 2.5, min: 1, max: 6, step: 0.1, visible: (p) => bool(p, 'pit') },
    // Seating
    { key: 'rows', label: 'Number of rows', group: 'Seating', type: 'number', unit: 'none', default: 15, min: 0, max: 50, step: 1 },
    { key: 'rowSpacing', label: 'Row spacing', group: 'Seating', type: 'number', default: 0.9, min: 0.75, max: 1.5, step: 0.05, help: 'Distance from one row to the next.', visible: showSeats },
    { key: 'rake', label: 'Rake (rise per row)', group: 'Seating', type: 'number', default: 0.15, min: 0, max: 0.5, step: 0.01, help: 'How much higher each row is than the one in front.', visible: showSeats },
    { key: 'curve', label: 'Seating curve', group: 'Seating', type: 'number', unit: 'none', default: 0.3, min: 0, max: 1, step: 0.05, help: '0 = straight rows, 1 = strongly curved.', visible: showSeats },
    { key: 'seatingWidth', label: 'Seating width', group: 'Seating', type: 'number', default: 18, min: 4, max: 60, step: 0.1, visible: showSeats },
    { key: 'gap', label: 'Gap to first row', group: 'Seating', type: 'number', default: 2, min: 0.5, max: 10, step: 0.1, help: 'Measured from the apron (or the pit, when there is one).', visible: showSeats },
    { key: 'balcony', label: 'Balcony', group: 'Seating', type: 'boolean', default: false },
    { key: 'balconyRows', label: 'Balcony rows', group: 'Seating', type: 'number', unit: 'none', default: 6, min: 1, max: 20, step: 1, visible: (p) => bool(p, 'balcony') },
  ],

  constraints: (p) => {
    const out = { ...p };
    // The arch can never be wider than the stage.
    out.archWidth = Math.min(num(out, 'archWidth'), num(out, 'stageWidth'));
    // The arch (and its frame) must fit under the back wall height.
    out.archHeight = Math.max(3, Math.min(num(out, 'archHeight'), num(out, 'backWallHeight') - 0.3));
    out.frameThickness = Math.max(0.3, Math.min(num(out, 'frameThickness'), num(out, 'backWallHeight') - num(out, 'archHeight')));
    return out;
  },

  build: (p) => <Scene p={p} />,

  presetViews: (p): PresetView[] => {
    const L = layout(p);
    const target: Vec3 = [0, L.h + L.archH * 0.35, -L.stageD * 0.3];
    const seat = (o: SeatingOptions, row: number): Vec3 => {
      const c = rowCentre(o, row);
      return [0, c[1] + EYE_HEIGHT, L.seatingZ + c[2]];
    };
    const rows = Math.floor(L.stalls.rows);
    const views: PresetView[] = [];
    if (rows > 0) {
      views.push(
        { id: 'front-row', label: 'Front row', position: seat(L.stalls, 0), target },
        { id: 'middle', label: 'Middle of house', position: seat(L.stalls, Math.floor(rows / 2)), target },
        { id: 'back-row', label: 'Back row', position: seat(L.stalls, rows - 1), target },
      );
    }
    if (L.balcony && L.balcony.rows > 0) views.push({ id: 'balcony', label: 'Balcony', position: seat(L.balcony, 0), target });
    const wingX = L.wing > 0.5 ? L.stageW / 2 + L.wing * 0.5 : L.stageW / 2 - 0.5;
    views.push({
      id: 'stage-left',
      label: 'Stage left wing',
      position: [wingX, L.h + 1.7, -L.stageD * 0.35],
      target: [-L.stageW / 4, L.h + 1.2, -L.stageD * 0.35],
    });
    return views;
  },

  surfaces: (p): Surface[] => {
    const L = layout(p);
    return [
      { id: 'back-wall', label: 'Back wall', position: [0, L.h + L.houseTop / 2, -L.stageD], rotation: [0, 0, 0], width: L.houseW, height: L.houseTop },
      { id: 'stage-floor', label: 'Stage floor', position: [0, L.h, -L.stageD / 2], rotation: [-Math.PI / 2, 0, 0], width: L.stageW, height: L.stageD },
      { id: 'apron-front', label: 'Apron front edge', position: [0, L.h / 2, L.apron], rotation: [0, 0, 0], width: L.apronW, height: L.h },
      { id: 'arch-front', label: 'Arch front face', position: [0, L.h + (L.archH + L.frame) / 2, 0.15], rotation: [0, 0, 0], width: L.archW + 2 * L.frame, height: L.archH + L.frame },
      { id: 'left-wing-wall', label: 'Stage left wing wall', position: [L.houseW / 2, L.h + L.houseTop / 2, -L.stageD / 2], rotation: [0, -Math.PI / 2, 0], width: L.stageD, height: L.houseTop },
      { id: 'right-wing-wall', label: 'Stage right wing wall', position: [-L.houseW / 2, L.h + L.houseTop / 2, -L.stageD / 2], rotation: [0, Math.PI / 2, 0], width: L.stageD, height: L.houseTop },
    ];
  },

  bounds: (p): Bounds => {
    const L = layout(p);
    const s = seatingExtent(L.stalls);
    const b = L.balcony ? seatingExtent(L.balcony) : s;
    const half = Math.max(L.houseW / 2 + WALL, s.halfWidth, b.halfWidth);
    return {
      min: [-half, 0, -L.stageD - WALL],
      max: [half, L.h + L.houseTop, L.seatingZ + Math.max(s.maxZ, b.maxZ, 1)],
    };
  },
};
