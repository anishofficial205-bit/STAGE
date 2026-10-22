/**
 * The rest of the theatre drapes: legs and borders (masking), the traveler,
 * the cyc cloth, the scrim and the stage skirt.
 */
import { useContext, useMemo } from 'react';
import { ObjectFaces } from '../faceMaterial';
import { useScrimTransparency } from '../../lighting/scrim';
import type { Params, StageInfo } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { stageSnapLines } from '../../helpers/stageInfo';
import { Cube, Icon } from '../common';
import type { SetObjectType } from '../types';
import { Fabric, Track, VELOUR, useOpen, type PlacedPanel } from './Fabric';
import { foldDepth } from './pleats';
import { CURTAINS, PlayButtons, fabricParams, frontLine, travelerPanels } from './mainCurtain';

const BLACK = '#141416';
const OFF_WHITE = '#ecebe6';

/** The playing area behind the front line: x extent, front and back z (world), and a sensible drape height. */
export function playingArea(info: StageInfo) {
  const [x0, z0, x1, z1] = stageSnapLines(info).bounds;
  if (info.opening) {
    const w = info.opening.width;
    return { cx: info.centre[0], width: w, front: info.opening.z, back: info.opening.backZ, height: info.opening.height };
  }
  return { cx: (x0 + x1) / 2, width: x1 - x0, front: z1 - 0.6, back: z0, height: 6 };
}

const sizeParams = (w: number, h: number, maxH = 25) =>
  [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: w, min: 0.3, max: 40, step: 0.1 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: h, min: 0.2, max: maxH, step: 0.1 },
  ] as SetObjectType['params'];

const buildParam = {
  key: 'build',
  label: 'Made of',
  group: 'Fabric',
  type: 'select',
  default: 'fabric',
  options: [
    { value: 'fabric', label: 'Fabric (soft masking)' },
    { value: 'flat', label: 'Flat (hard masking)' },
  ],
  help: 'Tormentors and teasers are often hard flats; legs and borders are usually fabric.',
} as const;

const frontBack = (p: Params) => [
  { id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') },
  { id: 'back', name: 'Back', width: num(p, 'width'), height: num(p, 'height') },
];

/** Plain pleated drape (leg or border), or a black flat when built as hard masking. */
function Drape({ p }: { p: Params }) {
  const w = num(p, 'width');
  const h = num(p, 'height');
  const fullness = num(p, 'fullness') / 100;
  const color = str(p, 'color');
  const flat = str(p, 'build') === 'flat';
  const panels = useMemo((): PlacedPanel[] => [{ x0: -w / 2, span: w, closedSpan: w, height: h, fullness, u: [0, 1] }], [w, h, fullness]);
  if (flat) return <Cube at={[0, h / 2, 0]} size={[w, h, 0.05]} color={color} faces={{ pz: 'front', nz: 'back' }} />;
  return (
    <>
      <Fabric panels={panels} fallback={VELOUR(color)} />
      <Track width={w} y={h} />
    </>
  );
}

const drapeType = (o: Pick<SetObjectType, 'id' | 'name' | 'icon'> & { w: number; h: number }): SetObjectType => ({
  id: o.id,
  name: o.name,
  category: CURTAINS,
  icon: o.icon,
  placement: 'hanging',
  hangGap: 0.1,
  params: [...sizeParams(o.w, o.h), ...fabricParams(BLACK, 50), buildParam as unknown as SetObjectType['params'][number]],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: str(p, 'build') === 'flat' ? 0.05 : 0.3, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => <Drape p={p} />,
  faces: frontBack,
});

export const legObject = drapeType({
  id: 'leg',
  name: 'Leg',
  w: 2,
  h: 7,
  icon: (
    <Icon>
      <path d="M8 3h8M9 3v18M15 3v18M11 3v18M13 3v18" />
    </Icon>
  ),
});

export const borderObject = drapeType({
  id: 'border',
  name: 'Border',
  w: 10,
  h: 2,
  icon: (
    <Icon>
      <path d="M3 6h18M4 6v6M8 6v6M12 6v6M16 6v6M20 6v6" />
    </Icon>
  ),
});

function Traveler({ p }: { p: Params }) {
  const w = num(p, 'width');
  const h = num(p, 'height');
  const fullness = num(p, 'fullness') / 100;
  const stacking = bool(p, 'stacking');
  const open = useOpen(num(p, 'open'));
  const panels = useMemo(() => travelerPanels(w, h, fullness, open, stacking), [w, h, fullness, open, stacking]);
  return (
    <>
      <Fabric panels={panels} fallback={VELOUR(str(p, 'color'))} />
      <Track width={w} y={h} />
    </>
  );
}

export const travelerObject: SetObjectType = {
  id: 'traveler',
  name: 'Traveler',
  category: CURTAINS,
  icon: (
    <Icon>
      <path d="M3 4h18M5 4v16M19 4v16M5 12h5M19 12h-5M8 9l2 3-2 3M16 9l-2 3 2 3" />
    </Icon>
  ),
  placement: 'hanging',
  hangGap: 0.1,
  params: [
    ...sizeParams(10, 7),
    ...fabricParams(BLACK, 50),
    { key: 'stacking', label: 'Bunch up at the sides', group: 'Opening', type: 'boolean', default: true, help: 'On: the panels gather at the sides. Off: they slide away into the wings.' },
    { key: 'open', label: 'Open (%)', group: 'Opening', type: 'number', unit: 'none', default: 100, min: 0, max: 100, step: 1 },
    { key: 'duration', label: 'Play time (s)', group: 'Opening', type: 'number', unit: 'none', default: 3, min: 0.5, max: 20, step: 0.5 },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.4, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => <Traveler p={p} />,
  faces: frontBack,
  // Mid-stage, across the whole playing area (wider than it, so it masks when closed).
  autoPlace: (info) => {
    const a = playingArea(info);
    return { x: a.cx - info.centre[0], z: (a.front + a.back) / 2 - info.centre[1], elevation: 0, params: { width: a.width + 2, height: a.height + 1 } };
  },
  Panel: PlayButtons,
};

/** Smooth cloth (cyc or scrim) with an optional bottom gap. */
function Smooth({ p, opacity }: { p: Params; opacity?: number }) {
  const w = num(p, 'width');
  const h = num(p, 'height');
  const panels = useMemo((): PlacedPanel[] => [{ x0: -w / 2, span: w, closedSpan: w, height: h, fullness: 0, u: [0, 1], smooth: true }], [w, h]);
  const color = str(p, 'color');
  return (
    <>
      <Fabric panels={panels} fallback={{ material: 'paint', color, roughness: 0.95 }} opacity={opacity} plain />
      <Track width={w} y={h} />
    </>
  );
}

export const cycClothObject: SetObjectType = {
  id: 'cyc-cloth',
  name: 'Cyc cloth',
  category: CURTAINS,
  icon: (
    <Icon>
      <path d="M3 4h18M4 4v15h16V4" />
    </Icon>
  ),
  placement: 'hanging',
  hangGap: 0.1,
  elevationParam: 'bottomGap',
  params: [
    ...sizeParams(12, 7, 30),
    { key: 'bottomGap', label: 'Bottom gap from floor', group: 'Size', type: 'number', default: 0, min: 0, max: 20, step: 0.05 },
    { key: 'color', label: 'Colour', group: 'Fabric', type: 'color', default: OFF_WHITE, presets: [
      { value: OFF_WHITE, label: 'Off-white' },
      { value: '#d9e4ef', label: 'Pale blue' },
      { value: '#9aa3ad', label: 'Grey (bounce)' },
      { value: '#141416', label: 'Black' },
    ] },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.1, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => <Smooth p={p} />,
  faces: frontBack,
  // Upstage, just in front of the back wall, wider and taller than the opening.
  autoPlace: (info) => {
    const a = playingArea(info);
    return { x: a.cx - info.centre[0], z: a.back + 0.8 - info.centre[1], params: { width: a.width + 3, height: a.height + 1.5, bottomGap: 0 } };
  },
};

/** A scrim's look: from the lighting (front vs. behind) when it follows it, else the manual setting. */
function Scrim({ p }: { p: Params }) {
  const ctx = useContext(ObjectFaces);
  const auto = useScrimTransparency(ctx?.objectId, bool(p, 'auto'));
  const t = auto ?? num(p, 'transparency');
  return <Smooth p={p} opacity={Math.max(0.04, 1 - t / 100)} />;
}

export const scrimObject: SetObjectType = {
  id: 'scrim',
  name: 'Scrim',
  category: CURTAINS,
  icon: (
    <Icon>
      <path d="M3 4h18M4 4v16h16V4M4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16" strokeOpacity="0.6" />
    </Icon>
  ),
  placement: 'hanging',
  hangGap: 0.1,
  params: [
    ...sizeParams(12, 7, 30),
    { key: 'color', label: 'Colour', group: 'Fabric', type: 'color', default: '#e9e7e1', presets: [
      { value: '#e9e7e1', label: 'White' },
      { value: '#8d939b', label: 'Grey' },
      { value: '#141416', label: 'Black (sharkstooth)' },
    ] },
    { key: 'auto', label: 'Follow the lighting', group: 'Fabric', type: 'boolean', default: true, help: 'Solid when lit from the front, see-through when the scene behind is brighter — worked out from the lights. Off: set it by hand.' },
    { key: 'transparency', label: 'Transparency (%)', group: 'Fabric', type: 'number', unit: 'none', default: 40, min: 0, max: 100, step: 1, help: 'How see-through it looks (used when it isn’t following the lighting, or when no lights are on).' },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.05, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => <Scrim p={p} />,
  faces: frontBack,
  autoPlace: (info) => {
    const a = playingArea(info);
    return { x: a.cx - info.centre[0], z: a.back + 2 - info.centre[1], elevation: 0, params: { width: a.width + 1, height: a.height + 0.5 } };
  },
};

/** The raised floor whose front edge is furthest downstage, and that edge (with its bow, for a curved apron). */
export function stageFront(info: StageInfo) {
  const raised = info.floors.filter((f) => f.height > 0.05);
  if (!raised.length) return null;
  const front = raised.reduce((a, b) => (Math.max(...b.outline.map((p) => p[1])) > Math.max(...a.outline.map((p) => p[1])) ? b : a));
  const xs = front.outline.map((p) => p[0]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const zMax = Math.max(...front.outline.map((p) => p[1]));
  // The front corners: the most downstage points at each side.
  const cornerZ = Math.max(...front.outline.filter((p) => Math.abs(p[0] - x0) < 0.01 || Math.abs(p[0] - x1) < 0.01).map((p) => p[1]));
  return { cx: (x0 + x1) / 2, width: x1 - x0, z: cornerZ, bow: Math.max(0, zMax - cornerZ), height: front.height };
}

function Skirt({ p }: { p: Params }) {
  const w = num(p, 'width');
  const h = num(p, 'height');
  const fullness = num(p, 'fullness') / 100;
  const bow = num(p, 'bow');
  const panels = useMemo((): PlacedPanel[] => {
    const shape = { x0: -w / 2, span: w, closedSpan: w * (1 + bow / Math.max(w, 0.1)), height: h, fullness, u: [0, 1] as [number, number], bow };
    // Stand off the stage front by the fold depth so the pleats don't cut into it.
    return [{ ...shape, offset: [0, 0, foldDepth(shape) * 1.15 + 0.02 - bow / 2] }];
  }, [w, h, fullness, bow]);
  return <Fabric panels={panels} fallback={VELOUR(str(p, 'color'))} />;
}

export const stageSkirtObject: SetObjectType = {
  id: 'stage-skirt',
  name: 'Stage skirt',
  category: CURTAINS,
  icon: (
    <Icon>
      <path d="M3 9h18M4 9v8M8 9v8M12 9v8M16 9v8M20 9v8M3 17h18" />
    </Icon>
  ),
  placement: 'hanging',
  hangGap: 0,
  onGround: true,
  params: [
    ...sizeParams(10, 1, 4),
    { key: 'bow', label: 'Curve forward', group: 'Size', type: 'number', default: 0, min: 0, max: 10, step: 0.05, help: 'Follows a curved stage front.' },
    ...fabricParams(BLACK, 50),
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.1 + num(p, 'bow'), height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => <Skirt p={p} />,
  faces: frontBack,
  autoPlace: (info) => {
    const f = stageFront(info);
    if (!f) return null;
    // The object's centre is its footprint centre, so shift by half the bow.
    return { x: f.cx - info.centre[0], z: f.z + f.bow / 2 - info.centre[1], elevation: 0, params: { width: f.width, height: f.height, bow: f.bow } };
  },
};

export { frontLine };
