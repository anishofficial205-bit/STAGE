/**
 * In-the-Round — the stage is in the middle and the audience sits all around.
 * There is no back wall and no "front".
 *
 * Layout (metres, Y up):
 *   - The stage is centred on the origin. Section A faces it from +Z; the
 *     other sections follow round towards +X.
 *   - Seating rows follow the stage outline (circles round a circle, squares
 *     round a square, ...), split into evenly spaced sections by aisles. When
 *     the section count matches a polygon's sides, the aisles sit at its corners.
 *   - Vomitories (entrance tunnels) widen the aisles through the front rows.
 */
import { useMemo } from 'react';
import type { Bounds, Params, PresetView, StageTemplate, Surface, Vec3 } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { DimensionLabel } from '../../helpers/DimensionLabel';
import { SeatInstances, generateContourSeats, type ContourSeatingOptions } from '../../helpers/Seating';
import { Beam, Box, Slab } from '../../helpers/primitives';
import { angleOf, offsetPolygon, rayToPolygon, regularPolygon, type Pt } from '../../helpers/shapes';
import { COLORS } from '../../helpers/materials';
import { EYE_HEIGHT } from '../../helpers/views';
import { loopSegments } from '../../helpers/stageInfo';

const TAU = Math.PI * 2;
const VOM_WIDTH = 2.4;
const GRID_MARGIN = 0.5; // the lighting grid sits just outside the stage edge
const norm = (a: number) => ((a % TAU) + TAU) % TAU;

function layout(p: Params) {
  const shape = str(p, 'shape');
  const size = num(p, 'stageSize');
  const length = num(p, 'stageLength');
  const h = num(p, 'stageHeight');
  const sections = num(p, 'sections');
  const rows = num(p, 'rows');
  const rowSpacing = num(p, 'rowSpacing');
  const rise = num(p, 'rake');
  const gap = num(p, 'gap');
  const aisle = num(p, 'aisleWidth');
  const vom = bool(p, 'vomitories');

  let polygon: Pt[] | null = null;
  if (shape === 'square') polygon = [[-size / 2, -size / 2], [size / 2, -size / 2], [size / 2, size / 2], [-size / 2, size / 2]];
  else if (shape === 'rectangle') polygon = [[-size / 2, -length / 2], [size / 2, -length / 2], [size / 2, length / 2], [-size / 2, length / 2]];
  else if (shape === 'octagon') polygon = regularPolygon(8, size / 2 / Math.cos(Math.PI / 8), Math.PI / 8);
  const radius = size / 2;

  // Aisles at the corners when there is one section per side; otherwise evenly spaced.
  const aisleAngles =
    polygon && polygon.length === sections
      ? polygon.map(angleOf).map(norm).sort((a, b) => a - b)
      : Array.from({ length: sections }, (_, k) => norm(((k + 0.5) * TAU) / sections));
  // Section centres sit halfway between neighbouring aisles.
  const centres = aisleAngles.map((a, i) => {
    const next = aisleAngles[(i + 1) % aisleAngles.length] + (i === aisleAngles.length - 1 ? TAU : 0);
    return norm((a + next) / 2);
  });
  // Section A is the one nearest +Z; the rest follow round towards +X.
  const fromFront = (a: number) => Math.min(a, TAU - a);
  const start = centres.reduce((best, a) => (fromFront(a) < fromFront(best) ? a : best), centres[0]);
  centres.sort((a, b) => norm(a - start) - norm(b - start));

  const vomRows = vom ? Math.ceil(rows * 0.5) : 0;
  const seating: ContourSeatingOptions = {
    outline: polygon ? { kind: 'polygon', points: polygon } : { kind: 'circle', radius },
    rows,
    firstRowDistance: gap,
    rowSpacing,
    rise,
    aisleAngles,
    aisleWidth: aisle,
    vomitory: vom ? { width: VOM_WIDTH, rows: vomRows } : undefined,
  };

  /** Distance from the centre to a point `d` beyond the stage edge, along angle `a`. */
  const reach = (a: number, d: number) => (polygon ? rayToPolygon(offsetPolygon(polygon, d).points, a) : radius + d);

  return { shape, size, length, h, sections, rows, rowSpacing, rise, gap, polygon, radius, aisleAngles, centres, vomRows, seating, reach, gridH: num(p, 'gridHeight') };
}

type Layout = ReturnType<typeof layout>;

function LightingGrid({ L }: { L: Layout }) {
  const y = L.gridH;
  if (!L.polygon) {
    return (
      <mesh position={[0, y, 0]} rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[L.radius + GRID_MARGIN, 0.15, 8, 96]} />
        <meshStandardMaterial color={COLORS.truss} roughness={0.6} />
      </mesh>
    );
  }
  const pts = offsetPolygon(L.polygon, GRID_MARGIN).points;
  return (
    <>
      {pts.map((a, i) => {
        const b = pts[(i + 1) % pts.length];
        return <Beam key={i} from={[a[0], y, a[1]]} to={[b[0], y, b[1]]} color={COLORS.truss} />;
      })}
    </>
  );
}

function Scene({ p }: { p: Params }) {
  const L = layout(p);
  const seatsKey = JSON.stringify(L.seating);
  const seats = useMemo(() => generateContourSeats(L.seating), [seatsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const outline: Pt[] = L.polygon ?? regularPolygon(96, L.radius, 0);
  const top = Math.max(L.h, 0.02);
  const vomEnd = L.gap + L.vomRows * L.rowSpacing;
  const tunnelH = Math.max(0.6, L.vomRows * L.rise);

  return (
    <group>
      <Slab outline={outline} top={top} color={COLORS.stageFloor} />
      <SeatInstances seats={seats} />

      {/* Vomitory mouths: dark openings where the aisle runs under the back rows */}
      {L.vomRows > 0 &&
        L.vomRows < L.rows &&
        L.aisleAngles.map((a) => {
          const d = L.reach(a, vomEnd);
          return (
            <group key={a} rotation-y={a}>
              <Box from={[-VOM_WIDTH / 2, 0, d - 0.25]} to={[VOM_WIDTH / 2, tunnelH, d + 0.05]} color={COLORS.dark} />
            </group>
          );
        })}

      {bool(p, 'lightingGrid') && <LightingGrid L={L} />}

      {L.shape === 'circle' && <DimensionLabel start={[-L.radius, L.h, 0]} end={[L.radius, L.h, 0]} offset={[0, 0.3, 0]} label="Diameter" />}
      {(L.shape === 'square' || L.shape === 'octagon') && <DimensionLabel start={[-L.size / 2, L.h, 0]} end={[L.size / 2, L.h, 0]} offset={[0, 0.3, 0]} label="Size" />}
      {L.shape === 'rectangle' && (
        <>
          <DimensionLabel start={[-L.size / 2, L.h, L.length / 2]} end={[L.size / 2, L.h, L.length / 2]} offset={[0, 0.3, 0]} label="Width" />
          <DimensionLabel start={[L.size / 2, L.h, -L.length / 2]} end={[L.size / 2, L.h, L.length / 2]} offset={[0, 0.3, 0]} label="Length" />
        </>
      )}
      {bool(p, 'lightingGrid') && <DimensionLabel start={[0, 0, 0]} end={[0, L.gridH, 0]} label="Grid" />}
    </group>
  );
}

const letter = (i: number) => String.fromCharCode(65 + i);

export const inTheRoundTemplate: StageTemplate = {
  id: 'in-the-round',
  name: 'In-the-Round',
  description: 'Audience on all sides',
  audienceSides: ['front', 'left', 'right', 'back'],

  dimensions: { width: 'stageSize', depth: 'stageLength', height: 'stageHeight' },
  presets: [
    {
      name: 'Studio in-the-round',
      description: 'Small circular floor with a few rows all round.',
      params: { shape: 'circle', stageSize: 6, stageHeight: 0, sections: 4, rows: 6, gap: 1, aisleWidth: 1.2, gridHeight: 5 },
    },
    {
      name: 'Boxing ring',
      description: 'Regulation-size raised square, four seating banks.',
      params: { shape: 'square', stageSize: 6.1, stageHeight: 1.2, sections: 4, rows: 15, gap: 2.5, aisleWidth: 1.5, gridHeight: 8 },
    },
    {
      name: 'Arena concert',
      description: 'Big central stage, eight sections, high rig.',
      params: { shape: 'octagon', stageSize: 16, stageHeight: 1.8, sections: 8, rows: 30, gap: 4, aisleWidth: 2, rake: 0.3, gridHeight: 14 },
    },
  ],

  params: [
    {
      key: 'shape',
      label: 'Stage shape',
      group: 'Stage',
      type: 'select',
      default: 'circle',
      options: [
        { value: 'circle', label: 'Circle' },
        { value: 'square', label: 'Square' },
        { value: 'octagon', label: 'Octagon' },
        { value: 'rectangle', label: 'Rectangle' },
      ],
    },
    { key: 'stageSize', label: 'Stage size', group: 'Stage', type: 'number', default: 8, min: 3, max: 30, step: 0.1, help: 'Diameter of a circle, side length of a square, width across an octagon or rectangle.' },
    { key: 'stageLength', label: 'Stage length', group: 'Stage', type: 'number', default: 12, min: 3, max: 40, step: 0.1, visible: (p) => str(p, 'shape') === 'rectangle' },
    { key: 'stageHeight', label: 'Stage height', group: 'Stage', type: 'number', default: 0.3, min: 0, max: 1.5, step: 0.05, help: 'Height of the stage floor above the audience floor.' },
    { key: 'sections', label: 'Seating sections', group: 'Seating', type: 'number', unit: 'none', default: 4, min: 2, max: 8, step: 1 },
    { key: 'rows', label: 'Rows per section', group: 'Seating', type: 'number', unit: 'none', default: 10, min: 0, max: 40, step: 1 },
    { key: 'rowSpacing', label: 'Row spacing', group: 'Seating', type: 'number', default: 0.9, min: 0.75, max: 1.5, step: 0.05, help: 'Distance from one row to the next.' },
    { key: 'rake', label: 'Rake (rise per row)', group: 'Seating', type: 'number', default: 0.2, min: 0, max: 0.5, step: 0.01, help: 'How much higher each row is than the one in front.' },
    { key: 'gap', label: 'Gap to first row', group: 'Seating', type: 'number', default: 1.5, min: 0.5, max: 6, step: 0.1 },
    { key: 'aisleWidth', label: 'Aisle width', group: 'Seating', type: 'number', default: 1.5, min: 0.8, max: 4, step: 0.1, help: 'Width of the aisles between sections.' },
    { key: 'vomitories', label: 'Vomitories', group: 'Seating', type: 'boolean', default: true, help: 'Entrance tunnels through the seating at the aisles, for performers.' },
    { key: 'lightingGrid', label: 'Lighting grid', group: 'Overhead', type: 'boolean', default: true, help: 'A frame hanging above the stage for lights and hanging pieces.' },
    { key: 'gridHeight', label: 'Grid height', group: 'Overhead', type: 'number', default: 7, min: 3, max: 20, step: 0.1, visible: (p) => bool(p, 'lightingGrid') },
  ],

  constraints: (p) => p, // seating follows the shape and sections are spaced evenly by construction

  messages: () => [
    {
      kind: 'info',
      text: 'Sightline warning: with the audience on every side, anything tall on the stage blocks the view from the sections opposite. Keep set pieces low and put graphics on the floor or hang them overhead.',
    },
  ],

  build: (p) => <Scene p={p} />,

  presetViews: (p): PresetView[] => {
    const L = layout(p);
    const target: Vec3 = [0, L.h + 0.8, 0];
    const views: PresetView[] = [];
    if (L.rows > 0) {
      const mid = Math.floor(L.rows / 2);
      L.centres.forEach((a, i) => {
        const r = L.reach(a, L.gap + mid * L.rowSpacing);
        views.push({ id: `section-${i}`, label: `Section ${letter(i)}`, position: [r * Math.sin(a), mid * L.rise + EYE_HEIGHT, r * Math.cos(a)], target });
      });
    }
    const a = L.centres[0] ?? 0;
    views.push({ id: 'performer', label: "Performer's view", position: [0, L.h + 1.65, 0], target: [4 * Math.sin(a), L.h + 1.4, 4 * Math.cos(a)] });
    return views;
  },

  surfaces: (p): Surface[] => {
    const L = layout(p);
    const w = L.size;
    const d = L.shape === 'rectangle' ? L.length : L.size;
    const edgeLength = L.polygon
      ? L.polygon.reduce((s, pt, i) => {
          const q = L.polygon![(i + 1) % L.polygon!.length];
          return s + Math.hypot(q[0] - pt[0], q[1] - pt[1]);
        }, 0)
      : Math.PI * L.size;
    const gridW = w + 2 * GRID_MARGIN;
    const gridD = d + 2 * GRID_MARGIN;
    return [
      {
        id: 'stage-floor',
        label: 'Stage floor',
        position: [0, L.h + 0.001, 0],
        rotation: [-Math.PI / 2, 0, 0],
        width: w,
        height: d,
        // Floor surfaces: plane x = world x, plane y = world -z.
        outline: (L.polygon ?? regularPolygon(96, L.radius, 0)).map(([x, z]) => [x, -z] as Pt),
      },
      // The edge wraps right round the stage; width is its full unrolled length.
      { id: 'stage-edge', label: 'Stage edge', position: [0, L.h / 2, d / 2], rotation: [0, 0, 0], width: edgeLength, height: L.h },
      { id: 'overhead-grid', label: 'Overhead grid', position: [0, L.gridH, 0], rotation: [Math.PI / 2, 0, 0], width: gridW, height: gridD },
    ];
  },

  stage: (p) => {
    const L = layout(p);
    const outline = L.polygon ?? regularPolygon(64, L.radius, 0);
    const grid = L.polygon ? offsetPolygon(L.polygon, GRID_MARGIN).points : regularPolygon(48, L.radius + GRID_MARGIN, 0);
    return { centre: [0, 0], floors: [{ outline, height: L.h }], rigging: bool(p, 'lightingGrid') ? loopSegments(grid, L.gridH) : [] };
  },

  bounds: (p): Bounds => {
    const L = layout(p);
    const d = L.gap + L.rows * L.rowSpacing + 0.5;
    const extent = L.polygon ? Math.max(...offsetPolygon(L.polygon, d).points.map((q) => Math.hypot(q[0], q[1]))) : L.radius + d;
    const top = Math.max(bool(p, 'lightingGrid') ? L.gridH : 0, L.rows * L.rise + 1, L.h + 2);
    return { min: [-extent, 0, -extent], max: [extent, top, extent] };
  },
};
