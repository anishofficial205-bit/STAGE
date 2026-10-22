/**
 * Thrust — the stage projects out into the audience, who sit on three sides
 * (front, left, right). Behind it is an upstage area with a back wall.
 *
 * Layout (metres, Y up):
 *   - The upstage area runs from z = -upstageDepth to z = 0, with the back wall
 *     behind it and short side walls either side (an alcove).
 *   - The thrust projects from z = 0 forwards to z = thrustLength.
 *   - Three raked seating blocks face the thrust. "Left" and "right" are as seen
 *     from the audience (house left is -X). With connected corners the blocks'
 *     rows are mitred so they meet cleanly.
 *   - The sightline overlay shades the part of the back wall a typical side
 *     seat cannot see because the alcove's side wall is in the way.
 */
import { Html, Line } from '@react-three/drei';
import type { Bounds, PanelMessage, Params, PresetView, StageTemplate, Surface, Vec3 } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { DimensionLabel } from '../../helpers/DimensionLabel';
import { Seating, rowCentre, type SeatingOptions } from '../../helpers/Seating';
import { Box, Panel, Slab } from '../../helpers/primitives';
import type { Pt } from '../../helpers/shapes';
import { COLORS } from '../../helpers/materials';
import { EYE_HEIGHT } from '../../helpers/views';
import { generateSeats } from '../../helpers/Seating';
import { blockSeats } from '../../helpers/seats';

const WALL = 0.3;
const T45 = 1; // tan(45°): mitre for a square corner
const T22 = Math.tan(Math.PI / 8); // mitre for a 135° corner

interface Block {
  id: string;
  options: SeatingOptions;
  position: Vec3;
  rotationY: number;
}

function layout(p: Params) {
  const uw = num(p, 'upstageWidth');
  const ud = num(p, 'upstageDepth');
  const wallH = num(p, 'backWallHeight');
  const tw = num(p, 'thrustWidth');
  const tl = num(p, 'thrustLength');
  const h = num(p, 'stageHeight');
  const shape = str(p, 'thrustShape');
  const gap = num(p, 'gap');
  const connected = str(p, 'corners') === 'connected';
  const base = { rowSpacing: num(p, 'rowSpacing'), rise: num(p, 'rake'), firstRowDistance: gap };
  const rowsF = num(p, 'rowsFront');
  const rowsL = num(p, 'rowsLeft');
  const rowsR = num(p, 'rowsRight');

  const r = tw / 2; // rounded front radius
  const c = Math.min(tw / 3, tl / 2); // angled front chamfer
  // Thrust outline from the right of its back edge, round the front, to the left.
  let thrust: Pt[];
  let sideEnd: number; // where the straight sides stop
  let cornerTan: number; // mitre between side blocks and whatever is in front of them
  if (shape === 'rounded') {
    sideEnd = tl - r;
    cornerTan = 0;
    thrust = [[r, 0]];
    for (let i = 0; i <= 32; i++) {
      const a = Math.PI / 2 - (Math.PI * i) / 32;
      thrust.push([r * Math.sin(a), sideEnd + r * Math.cos(a)]);
    }
    thrust.push([-r, 0]);
  } else if (shape === 'angled') {
    sideEnd = tl - c;
    cornerTan = T22;
    thrust = [[tw / 2, 0], [tw / 2, sideEnd], [tw / 2 - c, tl], [-tw / 2 + c, tl], [-tw / 2, sideEnd], [-tw / 2, 0]];
  } else {
    sideEnd = tl;
    cornerTan = T45;
    thrust = [[tw / 2, 0], [tw / 2, tl], [-tw / 2, tl], [-tw / 2, 0]];
  }

  // One continuous floor: upstage rectangle + thrust.
  const floor: Pt[] = ud > 0.01 ? [[-uw / 2, -ud], [uw / 2, -ud], [uw / 2, 0], ...thrust, [-uw / 2, 0]] : thrust;
  const dedup = floor.filter((pt, i) => {
    const q = floor[(i + 1) % floor.length];
    return Math.hypot(pt[0] - q[0], pt[1] - q[1]) > 1e-4;
  });

  // Seating blocks.
  const fl = (t: number): [number, number] => (connected ? [t, t] : [0, 0]);
  const blocks: Block[] = [];
  if (shape === 'rounded') {
    const aisle = connected ? 0 : 1.2 / (r + gap);
    blocks.push({ id: 'front', options: { ...base, rows: rowsF, firstRowDistance: r + gap, arcSpan: Math.PI - 2 * aisle }, position: [0, 0, sideEnd], rotationY: 0 });
  } else if (shape === 'angled') {
    blocks.push({ id: 'front', options: { ...base, rows: rowsF, rowWidth: tw - 2 * c, flare: fl(T22) }, position: [0, 0, tl], rotationY: 0 });
    const diag = { ...base, rows: rowsF, rowWidth: c * Math.SQRT2, flare: fl(T22) };
    blocks.push({ id: 'front-right', options: diag, position: [tw / 2 - c / 2, 0, tl - c / 2], rotationY: Math.PI / 4 });
    blocks.push({ id: 'front-left', options: diag, position: [-tw / 2 + c / 2, 0, tl - c / 2], rotationY: -Math.PI / 4 });
  } else {
    blocks.push({ id: 'front', options: { ...base, rows: rowsF, rowWidth: tw, flare: fl(T45) }, position: [0, 0, tl], rotationY: 0 });
  }
  const sideFlare = connected ? cornerTan : 0;
  // Left block: its local +X points to the front (+Z); right block: local -X does.
  blocks.push({ id: 'left', options: { ...base, rows: rowsL, rowWidth: sideEnd, flare: [0, sideFlare] }, position: [-tw / 2, 0, sideEnd / 2], rotationY: -Math.PI / 2 });
  blocks.push({ id: 'right', options: { ...base, rows: rowsR, rowWidth: sideEnd, flare: [sideFlare, 0] }, position: [tw / 2, 0, sideEnd / 2], rotationY: Math.PI / 2 });

  return { uw, ud, wallH, tw, tl, h, shape, gap, r, c, sideEnd, thrust, floor: dedup, blocks, rowsF, rowsL, rowsR, ...base };
}

type Layout = ReturnType<typeof layout>;

/**
 * Part of the back wall hidden from a typical seat (middle of the block) on one
 * side: a sightline from that seat to the back wall must pass through the
 * alcove's opening at z = 0, so the near side wall hides the near end.
 */
function hiddenFromSide(L: Layout, side: -1 | 1) {
  const rows = side < 0 ? L.rowsL : L.rowsR;
  const edge = L.uw / 2;
  if (rows <= 0 || L.ud < 0.01 || L.sideEnd <= 0) return null;
  const a = L.tw / 2 + L.gap + (Math.floor(rows) / 2) * L.rowSpacing; // seat's distance from the centre line
  const sz = L.sideEnd / 2;
  if (a <= edge) return null;
  const t = sz / (sz + L.ud);
  const bound = Math.min(edge, -a + (a - edge) / t); // in left-side terms
  if (bound <= -edge) return null;
  const seatY = (Math.floor(rows) / 2) * L.rise + EYE_HEIGHT;
  return {
    x0: side < 0 ? -edge : -bound,
    x1: side < 0 ? bound : edge,
    seat: [side * a, seatY, sz] as Vec3,
    wallPoint: [side * -bound, seatY, -L.ud] as Vec3,
  };
}

function SightlineOverlay({ L }: { L: Layout }) {
  return (
    <>
      {([-1, 1] as const).map((side) => {
        const hid = hiddenFromSide(L, side);
        if (!hid) return null;
        const w = hid.x1 - hid.x0;
        const top = L.h + L.wallH;
        return (
          <group key={side}>
            <Panel position={[(hid.x0 + hid.x1) / 2, top / 2, -L.ud + 0.03]} width={w} height={top} color={COLORS.overlay} opacity={0.35} />
            <Line points={[hid.seat, hid.wallPoint]} color={COLORS.overlay} lineWidth={1.5} dashed dashSize={0.4} gapSize={0.25} />
            <Html position={[(hid.x0 + hid.x1) / 2, L.h + Math.min(L.wallH * 0.6, 4), -L.ud + 0.1]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div className="scene-tag scene-tag--warn">Hidden from {side < 0 ? 'left' : 'right'} seats</div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function Scene({ p }: { p: Params }) {
  const L = layout(p);
  const { uw, ud, tw, tl, h, wallH } = L;
  const top = h + wallH;
  return (
    <group>
      <Slab outline={L.floor} top={Math.max(h, 0.02)} color={COLORS.stageFloor} />
      <Box from={[-uw / 2 - WALL, 0, -ud - WALL]} to={[uw / 2 + WALL, top, -ud]} color={COLORS.wall} />
      {ud > 0.01 && (
        <>
          <Box from={[-uw / 2 - WALL, 0, -ud]} to={[-uw / 2, top, 0]} color={COLORS.wall} />
          <Box from={[uw / 2, 0, -ud]} to={[uw / 2 + WALL, top, 0]} color={COLORS.wall} />
        </>
      )}

      {L.blocks.map((b) => (
        <Seating key={b.id} {...b.options} position={b.position} rotationY={b.rotationY} />
      ))}

      {bool(p, 'sightline') && <SightlineOverlay L={L} />}

      <DimensionLabel start={[-uw / 2, h, -ud]} end={[uw / 2, h, -ud]} offset={[0, 0.3, 0.6]} label="Upstage" />
      {ud > 0.01 && <DimensionLabel start={[uw / 2, h, -ud]} end={[uw / 2, h, 0]} offset={[-0.6, 0.3, 0]} label="Upstage depth" />}
      <DimensionLabel start={[-tw / 2, h, L.sideEnd]} end={[tw / 2, h, L.sideEnd]} offset={[0, 0.3, 0]} label="Thrust" />
      <DimensionLabel start={[tw / 2, h, 0]} end={[tw / 2, h, tl]} offset={[0.5, 0.3, 0]} label="Length" />
    </group>
  );
}

const seatParam = (p: Params) => num(p, 'rowsFront') + num(p, 'rowsLeft') + num(p, 'rowsRight') > 0;

export const thrustTemplate: StageTemplate = {
  id: 'thrust',
  name: 'Thrust',
  description: 'Projects into the audience on three sides',
  audienceSides: ['front', 'left', 'right'],

  dimensions: { width: 'thrustWidth', depth: 'thrustLength', height: 'stageHeight' },
  presets: [
    {
      name: 'Studio thrust',
      description: 'Small, intimate thrust with a few rows on each side.',
      params: { upstageWidth: 8, upstageDepth: 3, backWallHeight: 5, thrustWidth: 5, thrustLength: 5, stageHeight: 0.4, rowsFront: 6, rowsLeft: 5, rowsRight: 5 },
    },
    {
      name: 'Regional theatre',
      description: 'Mid-size thrust with an angled front.',
      params: { upstageWidth: 13, upstageDepth: 5, backWallHeight: 9, thrustWidth: 9, thrustLength: 9, thrustShape: 'angled', stageHeight: 0.8, rowsFront: 12, rowsLeft: 10, rowsRight: 10 },
    },
    {
      name: 'Shakespeare-style',
      description: 'High, square platform with steep galleries close in.',
      params: { upstageWidth: 14, upstageDepth: 4, backWallHeight: 10, thrustWidth: 13, thrustLength: 8.5, thrustShape: 'square', stageHeight: 1.5, rowsFront: 14, rowsLeft: 12, rowsRight: 12, rake: 0.3, gap: 1 },
    },
  ],

  params: [
    { key: 'upstageWidth', label: 'Upstage width', group: 'Main stage', type: 'number', default: 12, min: 4, max: 30, step: 0.1 },
    { key: 'upstageDepth', label: 'Upstage depth', group: 'Main stage', type: 'number', default: 4, min: 0, max: 15, step: 0.1, help: 'The area behind the thrust, in front of the back wall.' },
    { key: 'backWallHeight', label: 'Back wall height', group: 'Main stage', type: 'number', default: 8, min: 3, max: 25, step: 0.1, help: 'Measured from the stage floor.' },
    { key: 'thrustWidth', label: 'Thrust width', group: 'Thrust', type: 'number', default: 8, min: 3, max: 25, step: 0.1, help: 'Can never be wider than the upstage area.' },
    { key: 'thrustLength', label: 'Thrust length', group: 'Thrust', type: 'number', default: 8, min: 2, max: 25, step: 0.1, help: 'How far the thrust projects into the audience.' },
    {
      key: 'thrustShape',
      label: 'Thrust shape',
      group: 'Thrust',
      type: 'select',
      default: 'square',
      options: [
        { value: 'square', label: 'Square' },
        { value: 'rounded', label: 'Rounded front' },
        { value: 'angled', label: 'Angled (hexagonal) front' },
      ],
    },
    { key: 'stageHeight', label: 'Stage height', group: 'Thrust', type: 'number', default: 0.8, min: 0, max: 2, step: 0.05, help: 'Height of the stage floor above the audience floor.' },
    { key: 'rowsFront', label: 'Rows on front side', group: 'Seating', type: 'number', unit: 'none', default: 10, min: 0, max: 40, step: 1 },
    { key: 'rowsLeft', label: 'Rows on left side', group: 'Seating', type: 'number', unit: 'none', default: 8, min: 0, max: 40, step: 1, help: 'House left, as seen from the audience.' },
    { key: 'rowsRight', label: 'Rows on right side', group: 'Seating', type: 'number', unit: 'none', default: 8, min: 0, max: 40, step: 1 },
    { key: 'rowSpacing', label: 'Row spacing', group: 'Seating', type: 'number', default: 0.9, min: 0.75, max: 1.5, step: 0.05, help: 'Distance from one row to the next.', visible: seatParam },
    { key: 'rake', label: 'Rake (rise per row)', group: 'Seating', type: 'number', default: 0.2, min: 0, max: 0.5, step: 0.01, help: 'How much higher each row is than the one in front.', visible: seatParam },
    { key: 'gap', label: 'Gap to first row', group: 'Seating', type: 'number', default: 1.5, min: 0.5, max: 6, step: 0.1, visible: seatParam },
    {
      key: 'corners',
      label: 'Corner seating',
      group: 'Seating',
      type: 'select',
      default: 'connected',
      options: [
        { value: 'connected', label: 'Connected' },
        { value: 'gaps', label: 'Gaps (aisles at corners)' },
      ],
      visible: seatParam,
    },
    { key: 'sightline', label: 'Sightline check', group: 'Overlays', type: 'boolean', default: false, help: 'Shades the part of the back wall that side seats cannot see.' },
  ],

  constraints: (p) => {
    const out = { ...p };
    out.thrustWidth = Math.min(num(out, 'thrustWidth'), num(out, 'upstageWidth'));
    // A rounded front is a half circle, so the thrust must be at least half as long as it is wide.
    if (str(out, 'thrustShape') === 'rounded') out.thrustLength = Math.max(num(out, 'thrustLength'), num(out, 'thrustWidth') / 2);
    return out;
  },

  messages: (p): PanelMessage[] =>
    bool(p, 'sightline')
      ? [
          {
            kind: 'info',
            text: 'Red areas of the back wall can’t be seen from a typical side seat. Tall set pieces on the thrust will also block side seats’ view across the stage — keep them low or upstage.',
          },
        ]
      : [],

  build: (p) => <Scene p={p} />,

  presetViews: (p): PresetView[] => {
    const L = layout(p);
    const target: Vec3 = [0, L.h + 1.2, L.tl * 0.45];
    const block = (id: string) => L.blocks.find((b) => b.id === id)!;
    // World position of a seat at the centre of row `row` of a block.
    const seat = (b: Block, row: number): Vec3 => {
      const c = rowCentre(b.options, row);
      const s = Math.sin(b.rotationY);
      const co = Math.cos(b.rotationY);
      return [b.position[0] + c[2] * s, c[1] + EYE_HEIGHT, b.position[2] + c[2] * co];
    };
    const views: PresetView[] = [];
    const front = block('front');
    if (L.rowsF > 0) views.push({ id: 'front', label: 'Front centre', position: seat(front, 0), target });
    if (L.rowsL > 0) views.push({ id: 'left', label: 'Left side', position: seat(block('left'), 2), target });
    if (L.rowsR > 0) views.push({ id: 'right', label: 'Right side', position: seat(block('right'), 2), target });
    // Corner: step out diagonally from the front-left corner of the thrust.
    const corner: Pt =
      L.shape === 'rounded' ? [-L.r * Math.SQRT1_2, L.sideEnd + L.r * Math.SQRT1_2] : L.shape === 'angled' ? [-L.tw / 2 + L.c / 2, L.tl - L.c / 2] : [-L.tw / 2, L.tl];
    const out = L.gap + 3 * L.rowSpacing;
    views.push({ id: 'corner', label: 'Front-left corner', position: [corner[0] - out * Math.SQRT1_2, 3 * L.rise + EYE_HEIGHT, corner[1] + out * Math.SQRT1_2], target });
    if (L.rowsF > 0) views.push({ id: 'back', label: 'Back of house', position: seat(front, L.rowsF - 1), target });
    return views;
  },

  surfaces: (p): Surface[] => {
    const L = layout(p);
    const frontW = L.shape === 'angled' ? L.tw - 2 * L.c : L.tw;
    return [
      { id: 'back-wall', label: 'Back wall', position: [0, L.h + L.wallH / 2, -L.ud], rotation: [0, 0, 0], width: L.uw, height: L.wallH },
      { id: 'upstage-floor', label: 'Upstage floor', position: [0, L.h, -L.ud / 2], rotation: [-Math.PI / 2, 0, 0], width: L.uw, height: L.ud },
      {
        id: 'thrust-floor',
        label: 'Thrust floor',
        position: [0, L.h + 0.001, L.tl / 2],
        rotation: [-Math.PI / 2, 0, 0],
        width: L.tw,
        height: L.tl,
        outline: L.thrust.map(([x, z]) => [x, -(z - L.tl / 2)] as Pt),
      },
      { id: 'thrust-front', label: 'Thrust front edge', position: [0, L.h / 2, L.tl], rotation: [0, 0, 0], width: frontW, height: L.h },
      { id: 'thrust-left', label: 'Thrust left edge', position: [-L.tw / 2, L.h / 2, L.sideEnd / 2], rotation: [0, -Math.PI / 2, 0], width: L.sideEnd, height: L.h },
      { id: 'thrust-right', label: 'Thrust right edge', position: [L.tw / 2, L.h / 2, L.sideEnd / 2], rotation: [0, Math.PI / 2, 0], width: L.sideEnd, height: L.h },
    ];
  },

  // Vomitories at the downstage corners of the thrust, between the front and side seating.
  entrances: (p) => {
    const L = layout(p);
    const off = L.gap * 0.5 + 0.4;
    return [1, -1].map((s) => ({ key: `vom-${s > 0 ? 'sl' : 'sr'}`, name: s > 0 ? 'DSL vom' : 'DSR vom', x: s * (L.tw / 2 + off), z: L.sideEnd + off, facing: s > 0 ? 225 : 135 }));
  },

  stage: (p) => {
    const L = layout(p);
    return { centre: [0, (L.tl - L.ud) / 2], floors: [{ outline: L.floor, height: L.h }] };
  },

  seats: (p) => {
    const names: Record<string, string> = { front: 'Front', left: 'Left', right: 'Right', 'front-left': 'Front-left', 'front-right': 'Front-right' };
    return layout(p).blocks.flatMap((b) => blockSeats(generateSeats(b.options), b.position, b.rotationY, names[b.id] ?? b.id));
  },

  bounds: (p): Bounds => {
    const L = layout(p);
    const reach = (rows: number) => L.gap + rows * L.rowSpacing;
    const halfX = Math.max(L.uw / 2 + WALL, L.tw / 2 + Math.max(reach(L.rowsL), reach(L.rowsR), reach(L.rowsF)));
    return { min: [-halfX, 0, -L.ud - WALL], max: [halfX, L.h + L.wallH, L.tl + reach(L.rowsF)] };
  },
};
