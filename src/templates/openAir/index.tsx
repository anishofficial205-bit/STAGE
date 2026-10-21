/**
 * Open-Air — an outdoor stage: a raised platform with a truss structure,
 * screens and a backdrop, and an audience standing or seated on open ground.
 *
 * Layout (metres, Y up):
 *   - The platform's front edge is at z = 0; it runs back to z = -platformDepth.
 *   - The audience area starts just in front of the stage (behind a crowd
 *     barrier) and extends towards +Z. The ground area surrounds it all.
 *   - Time of day swaps the sky and lighting via the template's environment;
 *     at night the stage is lit with coloured spotlights.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Bounds, Environment, Params, PresetView, StageTemplate, Surface, Vec3 } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { DimensionLabel } from '../../helpers/DimensionLabel';
import { Seating, type SeatingOptions } from '../../helpers/Seating';
import { Box, Panel, Slab, Truss } from '../../helpers/primitives';
import { COLORS, ROUGHNESS } from '../../helpers/materials';
import { Crowd, Skyline, Trees } from './scenery';

const GROUND_BEHIND = 8; // ground behind the stage
const BARRIER_Z = 1.5;
const AUDIENCE_Z = 2; // where the audience area starts
const FOH = { w: 4, d: 3 };
const GROUND_COLORS: Record<string, string> = { grass: '#8fae6f', paved: '#b4b1ab', sand: '#d8c69a' };

function layout(p: Params) {
  const pw = num(p, 'platformWidth');
  const pd = num(p, 'platformDepth');
  const ph = num(p, 'platformHeight');
  const structure = str(p, 'structure');
  const hasTruss = structure !== 'none';
  const trussH = num(p, 'trussHeight');
  const tw = bool(p, 'trussMatch') ? pw + 2 : num(p, 'trussWidth');
  const gw = num(p, 'groundWidth');
  const gl = num(p, 'groundLength');
  const groundZ0 = -pd - GROUND_BEHIND;
  const groundZ1 = groundZ0 + gl;
  // The audience area is trimmed to the ground.
  const aw = Math.min(num(p, 'audienceWidth'), gw);
  const ad = Math.max(2, Math.min(num(p, 'audienceDepth'), groundZ1 - AUDIENCE_Z - 1));
  const seated = str(p, 'audienceType') === 'seated';
  const upZ = -pd + 0.5; // upstage truss line
  const frontZ = -0.3; // downstage truss line (box truss)
  const headerZ = structure === 'goalpost' ? upZ : frontZ;

  // Backdrop: matches the truss opening by default.
  const bdMatch = bool(p, 'backdropMatch');
  const bdW = bdMatch ? (hasTruss ? tw - 1 : pw - 1) : num(p, 'backdropWidth');
  const bdTopLimit = hasTruss ? trussH - 0.4 : Infinity;
  const bdH = Math.max(1, Math.min(bdMatch ? (hasTruss ? trussH - ph - 0.6 : 5) : num(p, 'backdropHeight'), bdTopLimit - ph));
  const bdZ = upZ + 0.4;

  const towers = bool(p, 'towers');
  const towerH = num(p, 'towerHeight');
  const sw = num(p, 'screenWidth');
  const sh = (sw * 9) / 16;
  const towerX = (hasTruss ? tw : pw) / 2 + 1.2 + sw / 2;

  const rowSpacing = num(p, 'rowSpacing');
  const seating: SeatingOptions = {
    rows: Math.min(num(p, 'rows'), Math.floor((ad - 0.5) / rowSpacing)),
    firstRowDistance: AUDIENCE_Z + 0.6,
    rowSpacing,
    rise: 0, // flat ground
    rowWidth: aw,
    aisles: Math.max(1, Math.floor(aw / 14)),
    aisleWidth: 1.5,
  };
  // FOH sits ~60% back in a standing crowd, or just behind the seating.
  const fohZ = seated ? Math.min(AUDIENCE_Z + 0.6 + seating.rows * rowSpacing + 2, groundZ1 - FOH.d - 1) : AUDIENCE_Z + ad * 0.6;

  return { pw, pd, ph, structure, hasTruss, trussH, tw, gw, gl, groundZ0, groundZ1, aw, ad, seated, upZ, frontZ, headerZ, bdW, bdH, bdZ, towers, towerH, sw, sh, towerX, seating, fohZ };
}

type Layout = ReturnType<typeof layout>;

function Structure({ L }: { L: Layout }) {
  const { tw, trussH, upZ, frontZ } = L;
  const x = tw / 2;
  const c = COLORS.truss;
  if (L.structure === 'goalpost') {
    return (
      <>
        <Truss from={[-x, 0, upZ]} to={[-x, trussH, upZ]} color={c} />
        <Truss from={[x, 0, upZ]} to={[x, trussH, upZ]} color={c} />
        <Truss from={[-x - 0.2, trussH, upZ]} to={[x + 0.2, trussH, upZ]} color={c} />
      </>
    );
  }
  const corners: [number, number][] = [[-x, upZ], [x, upZ], [x, frontZ], [-x, frontZ]];
  return (
    <>
      {corners.map(([cx, cz], i) => (
        <Truss key={i} from={[cx, 0, cz]} to={[cx, trussH, cz]} color={c} />
      ))}
      <Truss from={[-x - 0.2, trussH, upZ]} to={[x + 0.2, trussH, upZ]} color={c} />
      <Truss from={[-x - 0.2, trussH, frontZ]} to={[x + 0.2, trussH, frontZ]} color={c} />
      <Truss from={[-x, trussH, upZ]} to={[-x, trussH, frontZ]} color={c} />
      <Truss from={[x, trussH, upZ]} to={[x, trussH, frontZ]} color={c} />
      <Truss from={[0, trussH, upZ]} to={[0, trussH, frontZ]} size={0.3} color={c} />
      {L.structure === 'roofed' && (
        // A membrane roof, pitched up towards the audience.
        <group position={[0, trussH + 0.9, (upZ + frontZ) / 2]} rotation-x={-0.08}>
          <Box from={[-x - 1, 0, upZ - (upZ + frontZ) / 2 - 1]} to={[x + 1, 0.12, frontZ - (upZ + frontZ) / 2 + 1.5]} color="#3d424a" />
        </group>
      )}
    </>
  );
}

function ScreenTower({ L, side, night }: { L: Layout; side: -1 | 1; night: boolean }) {
  const cx = side * L.towerX;
  const z = -0.5;
  const y = L.towerH - 0.6 - L.sh / 2;
  return (
    <group>
      <Truss from={[cx - L.sw / 2 - 0.2, 0, z]} to={[cx - L.sw / 2 - 0.2, L.towerH, z]} size={0.3} color={COLORS.truss} />
      <Truss from={[cx + L.sw / 2 + 0.2, 0, z]} to={[cx + L.sw / 2 + 0.2, L.towerH, z]} size={0.3} color={COLORS.truss} />
      <Truss from={[cx - L.sw / 2 - 0.35, L.towerH, z]} to={[cx + L.sw / 2 + 0.35, L.towerH, z]} size={0.3} color={COLORS.truss} />
      <mesh position={[cx, y, z + 0.25]}>
        <boxGeometry args={[L.sw, L.sh, 0.15]} />
        <meshStandardMaterial color="#14171c" roughness={0.3} emissive={night ? '#3b6fe0' : '#000000'} emissiveIntensity={night ? 1.1 : 0} />
      </mesh>
    </group>
  );
}

function FohDesk({ z }: { z: number }) {
  const { w, d } = FOH;
  return (
    <group position={[0, 0, z]}>
      <Box from={[-w / 2, 0, 0]} to={[w / 2, 0.3, d]} color={COLORS.stageEdge} />
      <Box from={[-1.5, 0.3, 0.3]} to={[1.5, 1.2, 1.1]} color={COLORS.dark} />
      {([[-w / 2 + 0.1, 0.1], [w / 2 - 0.1, 0.1], [w / 2 - 0.1, d - 0.1], [-w / 2 + 0.1, d - 0.1]] as const).map(([x, pz], i) => (
        <Box key={i} from={[x - 0.05, 0.3, pz - 0.05]} to={[x + 0.05, 2.7, pz + 0.05]} color={COLORS.truss} />
      ))}
      <Box from={[-w / 2 - 0.2, 2.7, -0.2]} to={[w / 2 + 0.2, 2.8, d + 0.2]} color="#3d424a" />
    </group>
  );
}

/** A spotlight aimed at a point (three.js lights need a target object in the scene). */
function Spot({ position, target, color, intensity = 3, angle = 0.45 }: { position: Vec3; target: Vec3; color: string; intensity?: number; angle?: number }) {
  const t = useMemo(() => new THREE.Object3D(), []);
  t.position.set(...target);
  return (
    <>
      <primitive object={t} />
      <spotLight position={position} target={t} color={color} intensity={intensity} angle={angle} penumbra={0.7} decay={0} distance={0} />
    </>
  );
}

function ShowLights({ L, strength }: { L: Layout; strength: number }) {
  const y = L.hasTruss ? L.trussH - 0.4 : 7;
  const z = L.hasTruss ? L.headerZ + 0.4 : 2;
  const x = (L.hasTruss ? L.tw : L.pw) / 2 - 1;
  const stage: Vec3 = [0, L.ph, -L.pd / 2];
  return (
    <>
      <Spot position={[-x, y, z]} target={[-L.pw / 5, L.ph, -L.pd / 2]} color="#ff3fb4" intensity={4 * strength} />
      <Spot position={[x, y, z]} target={[L.pw / 5, L.ph, -L.pd / 2]} color="#3f7bff" intensity={4 * strength} />
      <Spot position={[0, y, z]} target={stage} color="#ffd7a1" intensity={3 * strength} angle={0.55} />
      {/* Front wash from the FOH position onto performers and backdrop */}
      <Spot position={[0, 8, L.fohZ]} target={[0, L.ph + 2, L.bdZ]} color="#fff1dc" intensity={2.2 * strength} angle={0.3} />
      {/* Spill onto the front of the crowd */}
      <pointLight position={[0, L.ph + 3, 2]} color="#b58cff" intensity={0.8 * strength} decay={0} distance={30} />
    </>
  );
}

function Scene({ p }: { p: Params }) {
  const L = layout(p);
  const { pw, pd, ph } = L;
  const time = str(p, 'timeOfDay');
  const night = time === 'night';
  const ground = GROUND_COLORS[str(p, 'groundType')] ?? GROUND_COLORS.grass;
  const horizon = Math.max(L.gw, L.gl) / 2 + 8;
  const figures = Math.round(Math.min(400, Math.max(15, (L.aw * L.ad) / 15)));
  const fohHole: [number, number, number, number] = [-FOH.w / 2 - 0.5, L.fohZ - 0.5, FOH.w / 2 + 0.5, L.fohZ + FOH.d + 0.5];
  const steps = bool(p, 'steps') && ph > 0.25 ? Math.ceil(ph / 0.2) : 0;

  return (
    <group>
      {/* Ground area (covers the grid inside it) */}
      <Slab
        outline={[[-L.gw / 2, L.groundZ0], [L.gw / 2, L.groundZ0], [L.gw / 2, L.groundZ1], [-L.gw / 2, L.groundZ1]]}
        bottom={-0.02}
        top={0.004}
        color={ground}
        castShadow={false}
      />

      {/* Platform, with a dark skirt on the front */}
      <Box from={[-pw / 2, 0, -pd]} to={[pw / 2, Math.max(ph, 0.02), 0]} color={COLORS.stageFloor} />
      {ph > 0.05 && <Panel position={[0, ph / 2, 0.01]} width={pw} height={ph} color={COLORS.dark} />}
      {Array.from({ length: Math.max(0, steps - 1) }, (_, i) => (
        <Box key={i} from={[-1.5, 0, i * 0.3]} to={[1.5, ph - ((i + 1) * ph) / steps, (i + 1) * 0.3]} color={COLORS.stageEdge} />
      ))}
      {bool(p, 'ramp') && ph > 0.05 && <Ramp L={L} />}

      {L.hasTruss && <Structure L={L} />}
      {bool(p, 'backdrop') && <Panel position={[0, ph + L.bdH / 2, L.bdZ]} width={L.bdW} height={L.bdH} color="#d9d6cf" />}
      {L.towers && (
        <>
          <ScreenTower L={L} side={-1} night={night} />
          <ScreenTower L={L} side={1} night={night} />
        </>
      )}

      {/* Audience */}
      <Box from={[-L.aw / 2, 0, BARRIER_Z]} to={[L.aw / 2, 1.1, BARRIER_Z + 0.1]} color="#9aa0a8" />
      {L.seated ? (
        <Seating {...L.seating} />
      ) : (
        <>
          {/* Slightly darker zone marking the standing area */}
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, AUDIENCE_Z + L.ad / 2]} receiveShadow>
            <planeGeometry args={[L.aw, L.ad]} />
            <meshStandardMaterial color="#000000" transparent opacity={0.07} roughness={ROUGHNESS} depthWrite={false} />
          </mesh>
          <Crowd x0={-L.aw / 2 + 0.3} x1={L.aw / 2 - 0.3} z0={AUDIENCE_Z + 0.4} z1={AUDIENCE_Z + L.ad} count={figures} holes={bool(p, 'foh') ? [fohHole] : []} />
        </>
      )}
      {bool(p, 'foh') && <FohDesk z={L.fohZ} />}

      {str(p, 'background') === 'trees' && <Trees inner={horizon} outer={horizon + 35} night={night} />}
      {str(p, 'background') === 'city' && <Skyline inner={horizon} night={night} />}

      {(night || time === 'sunset') && <ShowLights L={L} strength={night ? 1 : 0.45} />}

      <DimensionLabel start={[-pw / 2, ph, 0]} end={[pw / 2, ph, 0]} offset={[0, 0.3, 0.6]} label="Platform" />
      <DimensionLabel start={[pw / 2, ph, -pd]} end={[pw / 2, ph, 0]} offset={[0.6, 0.3, 0]} label="Depth" />
      {ph > 0.05 && <DimensionLabel start={[-pw / 2, 0, 0]} end={[-pw / 2, ph, 0]} offset={[-0.5, 0, 0.3]} label="Height" />}
      {L.hasTruss && <DimensionLabel start={[L.tw / 2, 0, L.headerZ]} end={[L.tw / 2, L.trussH, L.headerZ]} offset={[0.7, 0, 0]} label="Truss" />}
    </group>
  );
}

/** Wheelchair/loading ramp along the stage's right side, 1:8, high end at the back. */
function Ramp({ L }: { L: Layout }) {
  const len = L.ph * 8;
  const geometry = useMemo(() => {
    // Profile in (−z, y), extruded across X (see rotation below).
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, L.ph), new THREE.Vector2(-len, 0)]);
    return new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false });
  }, [L.ph, len]);
  // Rotating +90° about Y maps shape x → world −z and extrusion depth → world +x.
  return (
    <mesh geometry={geometry} position={[L.pw / 2, 0, -L.pd]} rotation-y={Math.PI / 2} castShadow receiveShadow>
      <meshStandardMaterial color={COLORS.stageEdge} roughness={ROUGHNESS} />
    </mesh>
  );
}

const ENVIRONMENTS: Record<string, (ground: string) => Partial<Environment>> = {
  day: () => ({
    sky: { sunPosition: [80, 60, 50], turbidity: 5, rayleigh: 1 },
    fog: '#dfe7ef',
    ground: '#b9c2a8',
    grid: { cell: '#aab49a', section: '#9aa58a' },
    hemisphere: { sky: '#dbe8ff', ground: '#8a8f7a', intensity: 0.85 },
    ambient: 0.2,
    sun: { color: '#ffffff', intensity: 1.8, direction: [0.5, 1.2, 0.8] },
  }),
  sunset: () => ({
    sky: { sunPosition: [-60, 2.5, -100], turbidity: 9, rayleigh: 2.8 },
    fog: '#e3a982',
    ground: '#7d7464',
    grid: { cell: '#8a7f6d', section: '#7b715f' },
    hemisphere: { sky: '#ffcfa3', ground: '#5a4e48', intensity: 0.7 },
    ambient: 0.1,
    sun: { color: '#ff9a55', intensity: 1.5, direction: [-0.5, 0.22, -0.85] },
  }),
  night: () => ({
    background: '#070b18',
    stars: true,
    fog: '#070b18',
    ground: '#101318',
    grid: { cell: '#1a1f2b', section: '#232a3a' },
    hemisphere: { sky: '#2a3558', ground: '#0b0d12', intensity: 0.3 },
    ambient: 0.05,
    sun: { color: '#8fa6ff', intensity: 0.25, direction: [0.4, 1, 0.6] },
  }),
};

const isSeated = (p: Params) => str(p, 'audienceType') === 'seated';

export const openAirTemplate: StageTemplate = {
  id: 'open-air',
  name: 'Open-Air',
  description: 'Outdoor stage with truss',
  audienceSides: ['front'],

  params: [
    { key: 'groundWidth', label: 'Ground area width', group: 'Ground', type: 'number', default: 60, min: 20, max: 300, step: 1 },
    { key: 'groundLength', label: 'Ground area length', group: 'Ground', type: 'number', default: 60, min: 20, max: 300, step: 1 },
    { key: 'groundType', label: 'Ground type', group: 'Ground', type: 'select', default: 'grass', options: [{ value: 'grass', label: 'Grass' }, { value: 'paved', label: 'Paved' }, { value: 'sand', label: 'Sand' }] },
    { key: 'platformWidth', label: 'Platform width', group: 'Stage platform', type: 'number', default: 14, min: 4, max: 50, step: 0.1 },
    { key: 'platformDepth', label: 'Platform depth', group: 'Stage platform', type: 'number', default: 10, min: 3, max: 30, step: 0.1 },
    { key: 'platformHeight', label: 'Platform height', group: 'Stage platform', type: 'number', default: 1.5, min: 0, max: 3, step: 0.05 },
    { key: 'steps', label: 'Steps at front', group: 'Stage platform', type: 'boolean', default: true },
    { key: 'ramp', label: 'Ramp at side', group: 'Stage platform', type: 'boolean', default: false, help: 'A 1:8 ramp along the right side of the stage.' },
    {
      key: 'structure',
      label: 'Structure',
      group: 'Structure',
      type: 'select',
      default: 'goalpost',
      options: [
        { value: 'none', label: 'None' },
        { value: 'goalpost', label: 'Goalpost truss' },
        { value: 'box', label: 'Full box truss' },
        { value: 'roofed', label: 'Roofed truss' },
      ],
    },
    { key: 'trussHeight', label: 'Truss height', group: 'Structure', type: 'number', default: 8, min: 3, max: 20, step: 0.1, visible: (p) => str(p, 'structure') !== 'none' },
    { key: 'trussMatch', label: 'Truss width = platform + 2 m', group: 'Structure', type: 'boolean', default: true, visible: (p) => str(p, 'structure') !== 'none' },
    { key: 'trussWidth', label: 'Truss width', group: 'Structure', type: 'number', default: 16, min: 4, max: 60, step: 0.1, visible: (p) => str(p, 'structure') !== 'none' && !bool(p, 'trussMatch') },
    { key: 'towers', label: 'Side towers for LED screens', group: 'Structure', type: 'boolean', default: false },
    { key: 'towerHeight', label: 'Tower height', group: 'Structure', type: 'number', default: 8, min: 3, max: 20, step: 0.1, visible: (p) => bool(p, 'towers') },
    { key: 'screenWidth', label: 'Screen width', group: 'Structure', type: 'number', default: 4, min: 1, max: 12, step: 0.1, help: 'Screens are 16:9.', visible: (p) => bool(p, 'towers') },
    { key: 'backdrop', label: 'Backdrop panel', group: 'Backdrop', type: 'boolean', default: true },
    { key: 'backdropMatch', label: 'Size matches truss', group: 'Backdrop', type: 'boolean', default: true, visible: (p) => bool(p, 'backdrop') },
    { key: 'backdropWidth', label: 'Backdrop width', group: 'Backdrop', type: 'number', default: 14, min: 2, max: 60, step: 0.1, visible: (p) => bool(p, 'backdrop') && !bool(p, 'backdropMatch') },
    { key: 'backdropHeight', label: 'Backdrop height', group: 'Backdrop', type: 'number', default: 6, min: 1, max: 20, step: 0.1, visible: (p) => bool(p, 'backdrop') && !bool(p, 'backdropMatch') },
    { key: 'audienceType', label: 'Audience type', group: 'Audience', type: 'select', default: 'standing', options: [{ value: 'standing', label: 'Standing' }, { value: 'seated', label: 'Seated rows' }] },
    { key: 'audienceWidth', label: 'Audience area width', group: 'Audience', type: 'number', default: 40, min: 5, max: 300, step: 0.5 },
    { key: 'audienceDepth', label: 'Audience area depth', group: 'Audience', type: 'number', default: 30, min: 5, max: 300, step: 0.5 },
    { key: 'rows', label: 'Rows', group: 'Audience', type: 'number', unit: 'none', default: 20, min: 1, max: 100, step: 1, visible: isSeated },
    { key: 'rowSpacing', label: 'Row spacing', group: 'Audience', type: 'number', default: 0.9, min: 0.75, max: 1.5, step: 0.05, visible: isSeated },
    { key: 'foh', label: 'Front-of-house desk', group: 'Audience', type: 'boolean', default: true, help: 'The sound and lighting control position.' },
    { key: 'timeOfDay', label: 'Time of day', group: 'Environment', type: 'select', default: 'day', options: [{ value: 'day', label: 'Day' }, { value: 'sunset', label: 'Sunset' }, { value: 'night', label: 'Night' }] },
    { key: 'background', label: 'Background', group: 'Environment', type: 'select', default: 'trees', options: [{ value: 'open', label: 'Open' }, { value: 'trees', label: 'Trees' }, { value: 'city', label: 'City skyline' }] },
  ],

  constraints: (p) => p, // audience area is trimmed to the ground in layout()

  messages: (p) => {
    const L = layout(p);
    const out = [];
    if (L.aw < num(p, 'audienceWidth') || L.ad < num(p, 'audienceDepth')) {
      out.push({ kind: 'warning' as const, text: 'The audience area is bigger than the ground, so it has been trimmed to fit.' });
    }
    if (L.seated && L.seating.rows < num(p, 'rows')) {
      out.push({ kind: 'warning' as const, text: `Only ${L.seating.rows} rows fit in the audience area.` });
    }
    return out;
  },

  environment: (p) => ENVIRONMENTS[str(p, 'timeOfDay')]?.(str(p, 'groundType')) ?? {},

  build: (p) => <Scene p={p} />,

  presetViews: (p): PresetView[] => {
    const L = layout(p);
    const stage: Vec3 = [0, L.ph + 2.5, -L.pd / 2];
    return [
      { id: 'front', label: 'Front of crowd', position: [0, 1.65, AUDIENCE_Z + 0.6], target: stage },
      { id: 'middle', label: 'Middle of crowd', position: [0, 1.65, AUDIENCE_Z + L.ad / 2], target: stage },
      { id: 'foh', label: 'Front-of-house desk', position: [0, 0.3 + 1.65, L.fohZ + 0.2], target: stage },
      { id: 'side', label: 'Side angle', position: [Math.max(L.pw / 2 + 14, L.aw / 2 + 4), 5, 6], target: [0, L.ph + 2, -L.pd / 2] },
      // Festival drone shot: high, behind the crowd, looking over it at the stage.
      { id: 'drone', label: 'Aerial / drone', position: [-L.aw * 0.3, Math.max(28, L.trussH * 3), AUDIENCE_Z + L.ad + 18], target: [0, L.ph, -L.pd * 0.3] },
    ];
  },

  surfaces: (p): Surface[] => {
    const L = layout(p);
    const screenY = L.towerH - 0.6 - L.sh / 2;
    return [
      { id: 'backdrop', label: 'Backdrop', position: [0, L.ph + L.bdH / 2, L.bdZ], rotation: [0, 0, 0], width: L.bdW, height: L.bdH },
      { id: 'stage-floor', label: 'Stage floor', position: [0, L.ph, -L.pd / 2], rotation: [-Math.PI / 2, 0, 0], width: L.pw, height: L.pd },
      { id: 'stage-skirt', label: 'Stage front skirt', position: [0, L.ph / 2, 0], rotation: [0, 0, 0], width: L.pw, height: L.ph },
      { id: 'truss-header', label: 'Truss header (banner)', position: [0, L.trussH - 0.7, L.headerZ + 0.3], rotation: [0, 0, 0], width: L.tw, height: 1 },
      { id: 'left-screen', label: 'Left screen', position: [-L.towerX, screenY, -0.17], rotation: [0, 0, 0], width: L.sw, height: L.sh },
      { id: 'right-screen', label: 'Right screen', position: [L.towerX, screenY, -0.17], rotation: [0, 0, 0], width: L.sw, height: L.sh },
    ];
  },

  bounds: (p): Bounds => {
    const L = layout(p);
    const top = Math.max(L.hasTruss ? L.trussH + 1 : 0, L.towers ? L.towerH : 0, L.ph + 3);
    // Frame the stage and audience rather than the whole ground.
    const half = Math.max(L.pw / 2 + 2, L.towers ? L.towerX + L.sw / 2 : 0, L.aw / 2);
    return { min: [-half, 0, -L.pd - 2], max: [half, top, AUDIENCE_Z + L.ad + 2] };
  },
};
