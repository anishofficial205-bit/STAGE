/**
 * Main (house) curtain: pleated velour hanging just behind the proscenium arch.
 * Opens three ways — bi-parting traveler, guillotine (flies straight up) or
 * Austrian (gathers upward in scalloped swags) — with an Open slider and
 * animated Play open / Play close.
 */
import { useMemo } from 'react';
import type { Params } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { stageSnapLines } from '../../helpers/stageInfo';
import { Icon } from '../common';
import type { SetObject, SetObjectType } from '../types';
import { scallop } from './pleats';
import { FABRIC_COLORS, Fabric, Track, VELOUR, useOpen, type PlacedPanel } from './Fabric';
import { playCurtain, useCurtainAnim } from './anim';
import type { StageInfo } from '../../types';

export const CURTAINS = 'Curtains & drapes';
/** Bi-parting halves overlap this much at the centre when closed. */
const OVERLAP = 0.2;

/** Panels for a bi-parting traveler at `open` (0–1). Used by the main curtain and travelers. */
export function travelerPanels(w: number, h: number, fullness: number, open: number, stacking: boolean): PlacedPanel[] {
  const closed = w / 2 + OVERLAP / 2;
  const stackW = Math.max(0.3, closed * 0.13);
  const span = stacking ? closed - (closed - stackW) * open : closed;
  const slide = stacking ? 0 : closed * open;
  return [
    { x0: -w / 2, span, closedSpan: closed, height: h, fullness, u: [0, 0.5], offset: [-slide, 0, 0] },
    { x0: w / 2 - span, span, closedSpan: closed, height: h, fullness, u: [0.5, 1], offset: [slide, 0, -0.06] },
  ];
}

function MainCurtain({ p }: { p: Params }) {
  const w = num(p, 'width');
  const h = num(p, 'height');
  const fullness = num(p, 'fullness') / 100;
  const style = str(p, 'style');
  const stacking = bool(p, 'stacking');
  const open = useOpen(num(p, 'open'));
  const panels = useMemo((): PlacedPanel[] => {
    if (style === 'guillotine') return [{ x0: -w / 2, span: w, closedSpan: w, height: h, fullness, u: [0, 1], offset: [0, open * (h + 0.3), 0] }];
    if (style === 'austrian') {
      const swags = Math.max(2, Math.round(w / 1.6));
      return [
        {
          x0: -w / 2,
          span: w,
          closedSpan: w,
          height: h,
          fullness,
          u: [0, 1],
          bottom: (t) => open * h * (0.9 - 0.2 * scallop(t, swags)),
          ruche: (t) => open * (0.6 + 0.4 * scallop(t, swags)),
        },
      ];
    }
    return travelerPanels(w, h, fullness, open, stacking);
  }, [w, h, fullness, style, stacking, open]);
  return (
    <>
      <Fabric panels={panels} fallback={VELOUR(str(p, 'color'))} />
      <Track width={w} y={h} />
    </>
  );
}

export const openingParams = (defaultStyle = 'biparting') =>
  [
    { key: 'style', label: 'Opening style', group: 'Opening', type: 'select', default: defaultStyle, options: [
      { value: 'biparting', label: 'Bi-parting traveler (slides apart)' },
      { value: 'guillotine', label: 'Guillotine / fly (rises straight up)' },
      { value: 'austrian', label: 'Austrian (gathers up in swags)' },
    ] },
    { key: 'stacking', label: 'Bunch up at the sides', group: 'Opening', type: 'boolean', default: true, help: 'On: the panels gather into stacks at the sides. Off: they slide away into the wings.', visible: (p: Params) => p.style === 'biparting' },
    { key: 'open', label: 'Open (%)', group: 'Opening', type: 'number', unit: 'none', default: 0, min: 0, max: 100, step: 1 },
    { key: 'duration', label: 'Play time (s)', group: 'Opening', type: 'number', unit: 'none', default: 3, min: 0.5, max: 20, step: 0.5 },
  ] as SetObjectType['params'];

/** Play open / Play close buttons. */
export function PlayButtons({ o }: { o: SetObject }) {
  const playing = useCurtainAnim((s) => s.live[o.id] !== undefined);
  const seconds = num(o.params, 'duration');
  return (
    <div className="btn-row">
      <button className="btn" onClick={() => playCurtain(o.id, 100, seconds)} disabled={playing || num(o.params, 'open') >= 100}>
        ▶ Play open
      </button>
      <button className="btn" onClick={() => playCurtain(o.id, 0, seconds)} disabled={playing || num(o.params, 'open') <= 0}>
        ▶ Play close
      </button>
    </div>
  );
}

/** Behind the arch on a proscenium stage; otherwise across the front of the stage. */
export function frontLine(info: StageInfo, inset = 0.4) {
  if (info.opening) return { x: -info.centre[0], z: info.opening.z - info.centre[1], width: info.opening.width + 1.2, height: info.opening.height + 0.6 };
  const [x0, , x1, z1] = stageSnapLines(info).bounds;
  return { x: (x0 + x1) / 2 - info.centre[0], z: z1 - inset - info.centre[1], width: x1 - x0, height: undefined };
}

export const fabricParams = (color: string, fullness: number) =>
  [
    { key: 'color', label: 'Colour', group: 'Fabric', type: 'color', default: color, presets: FABRIC_COLORS },
    { key: 'fullness', label: 'Fullness (%)', group: 'Fabric', type: 'number', unit: 'none', default: fullness, min: 0, max: 100, step: 5, help: '0% hangs flat; 100% uses twice the cloth for deep pleats.' },
  ] as SetObjectType['params'];

export const mainCurtainObject: SetObjectType = {
  id: 'main-curtain',
  name: 'Main curtain',
  category: CURTAINS,
  icon: (
    <Icon>
      <path d="M3 3h18M4 3v18c2-1 3-6 5-9M20 3v18c-2-1-3-6-5-9M9 3c0 3 1 6 0 9M15 3c0 3-1 6 0 9" />
    </Icon>
  ),
  placement: 'hanging',
  hangGap: 0.1,
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 10, min: 1, max: 40, step: 0.1 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 7, min: 1, max: 25, step: 0.1 },
    ...fabricParams('#8b1a1a', 50),
    ...openingParams(),
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.4, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => <MainCurtain p={p} />,
  faces: (p) => [
    { id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') },
    { id: 'back', name: 'Back', width: num(p, 'width'), height: num(p, 'height') },
  ],
  autoPlace: (info) => {
    const f = frontLine(info);
    return { x: f.x, z: f.z, elevation: 0, params: { width: f.width, ...(f.height ? { height: f.height } : {}) } };
  },
  Panel: PlayButtons,
};
