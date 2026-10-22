/**
 * Valance — a short drape across the top of the opening, straight or swagged.
 * "Match main curtain" takes the colour, fullness and fabric from the main curtain.
 */
import { useMemo } from 'react';
import type { Params } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { useProjectStore } from '../../store/useProjectStore';
import { Icon } from '../common';
import type { SetObjectType } from '../types';
import { scallop } from './pleats';
import { Fabric, Track, VELOUR, type PlacedPanel } from './Fabric';
import { CURTAINS, fabricParams, frontLine } from './mainCurtain';

function Valance({ p }: { p: Params }) {
  const match = bool(p, 'match');
  const main = useProjectStore((s) => (match ? (s.objectsByTemplate[s.templateId] ?? []).find((o) => o.type === 'main-curtain') : undefined));
  const color = main ? str(main.params, 'color') : str(p, 'color');
  const fullness = (main ? num(main.params, 'fullness') : num(p, 'fullness')) / 100;
  const w = num(p, 'width');
  const h = num(p, 'height');
  const swagged = str(p, 'style') === 'swagged';
  const panels = useMemo((): PlacedPanel[] => {
    const swags = Math.max(2, Math.round(w / 1.8));
    return [
      {
        x0: -w / 2,
        span: w,
        closedSpan: w,
        height: h,
        fullness,
        u: [0, 1],
        ...(swagged ? { bottom: (t: number) => h * 0.45 * (1 - scallop(t, swags)), ruche: (t: number) => 0.5 + 0.5 * scallop(t, swags) } : {}),
      },
    ];
  }, [w, h, fullness, swagged]);
  // Matching also copies the main curtain's fabric (its front face material), if it has one.
  const fabric = main?.faces?.front ?? main?.faces?.['*'];
  const fallback = fabric && !fabric.graphic ? { ...fabric } : VELOUR(color);
  return (
    <>
      <Fabric panels={panels} fallback={fallback} />
      <Track width={w} y={h} />
    </>
  );
}

export const valanceObject: SetObjectType = {
  id: 'valance',
  name: 'Valance',
  category: CURTAINS,
  icon: (
    <Icon>
      <path d="M3 5h18M3 5v4c3 3 6 3 9 0 3 3 6 3 9 0V5" />
    </Icon>
  ),
  placement: 'hanging',
  hangGap: 0.1,
  params: [
    { key: 'width', label: 'Width', group: 'Size', type: 'number', default: 10, min: 1, max: 40, step: 0.1 },
    { key: 'height', label: 'Height', group: 'Size', type: 'number', default: 1, min: 0.2, max: 5, step: 0.05 },
    { key: 'style', label: 'Style', group: 'Fabric', type: 'select', default: 'straight', options: [
      { value: 'straight', label: 'Straight' },
      { value: 'swagged', label: 'Swagged' },
    ] },
    { key: 'match', label: 'Match main curtain', group: 'Fabric', type: 'boolean', default: true, help: 'Use the main curtain’s colour, fullness and fabric.' },
    ...fabricParams('#8b1a1a', 60).map((d) => ({ ...d, visible: (p: Params) => !p.match })),
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.3, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => <Valance p={p} />,
  faces: (p) => [
    { id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') },
    { id: 'back', name: 'Back', width: num(p, 'width'), height: num(p, 'height') },
  ],
  // Across the top of the opening, just downstage of the main curtain.
  autoPlace: (info, p) => {
    const f = frontLine(info);
    const h = num(p, 'height');
    const top = info.opening ? info.opening.height + 0.3 : 6;
    return { x: f.x, z: f.z + 0.32, elevation: Math.max(0, top - h), params: { width: f.width } };
  },
};
