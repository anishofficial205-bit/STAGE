/**
 * Print-resolution check. Every face has real dimensions, so for each graphic
 * we can say how many image pixels land on each inch of the printed face.
 * Screens (LED walls, projection screens, lit tower screens) get a pixel
 * check against their resolution instead.
 */
import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { getObjectType } from '../objects/registry';
import { inherited, isGroup } from '../objects/groups';
import { ALL_FACES } from '../objects/faceMaterial';
import { SURFACE, type FaceRef } from '../objects/ui';
import { num, str } from '../helpers/params';
import { fillWindow } from './placement';
import type { GraphicMeta, GraphicPlacement } from './types';
import type { FaceStyle } from '../objects/materials';

const INCH = 0.0254;

// --- Thresholds (app settings, kept in this browser) -------------------------------

export interface Thresholds {
  /** DPI at or above which artwork is print ready. */
  good: number;
  /** DPI at or above which it is fine from a distance but low close up. */
  ok: number;
}
const KEY = 'stage-builder:print-thresholds';
function readThresholds(): Thresholds {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (t && t.good > 0 && t.ok > 0) return t;
  } catch {
    // ignore
  }
  return { good: 100, ok: 50 };
}
export const usePrintSettings = create<{ thresholds: Thresholds; setThresholds: (t: Thresholds) => void }>((set) => ({
  thresholds: readThresholds(),
  setThresholds: (thresholds) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(thresholds));
    } catch {
      // ignore
    }
    set({ thresholds });
  },
}));

// --- The check ----------------------------------------------------------------------

export type Status = 'good' | 'ok' | 'low';

export interface CheckResult {
  kind: 'print' | 'screen';
  status: Status;
  /** Short badge text. */
  label: string;
  /** One-line explanation. */
  detail: string;
  /** Print: effective DPI (Infinity for vector artwork). Screen: % of the screen's pixels supplied. */
  value: number;
  /** Size of the printed/visible area of the graphic in metres (for Fit/Tile it is smaller than the face). */
  printed: [number, number];
  /** Image pixels across that area. */
  pixels: [number, number];
}

/** Image pixels and printed size (m) of the visible part of a graphic on a face. */
export function coverage(g: GraphicPlacement, meta: GraphicMeta, face: { w: number; h: number }): { pixels: [number, number]; printed: [number, number] } {
  const turns = ((Math.round(g.rotation) % 4) + 4) % 4;
  const [iw, ih] = turns % 2 ? [meta.height, meta.width] : [meta.width, meta.height];
  const da = iw / ih;
  const fa = face.w / Math.max(face.h, 1e-6);
  switch (g.fit) {
    case 'stretch':
      return { pixels: [iw, ih], printed: [face.w, face.h] };
    case 'fit':
      return { pixels: [iw, ih], printed: da > fa ? [face.w, face.w / da] : [face.h * da, face.h] };
    case 'fill': {
      const [rx, ry] = fillWindow(g, face, meta.width / meta.height);
      return { pixels: [rx * iw, ry * ih], printed: [face.w, face.h] };
    }
    case 'tile':
      return { pixels: [iw, ih], printed: [g.tileSize, g.tileSize / da] };
  }
}

export function checkPrint(g: GraphicPlacement, meta: GraphicMeta, face: { w: number; h: number }, t: Thresholds = usePrintSettings.getState().thresholds): CheckResult {
  const c = coverage(g, meta, face);
  if (meta.vector) {
    return { kind: 'print', status: 'good', label: 'Print ready (vector)', detail: 'Vector artwork scales to any size.', value: Infinity, ...c };
  }
  const dpi = Math.min(c.pixels[0] / (c.printed[0] / INCH), c.pixels[1] / (c.printed[1] / INCH));
  const status: Status = dpi >= t.good ? 'good' : dpi >= t.ok ? 'ok' : 'low';
  const label = status === 'good' ? 'Print ready' : status === 'ok' ? 'Low for close viewing' : 'Too low';
  return { kind: 'print', status, label: `${label} · ${Math.round(dpi)} DPI`, detail: `${Math.round(dpi)} pixels per inch at the printed size.`, value: dpi, ...c };
}

/** Screens: does the artwork supply at least the screen's own pixel count over the screen? */
export function checkScreen(g: GraphicPlacement, meta: GraphicMeta, face: { w: number; h: number }, screen: [number, number]): CheckResult {
  const c = coverage(g, meta, face);
  // Pixels the screen shows across the area the graphic covers.
  const need: [number, number] = [(screen[0] * c.printed[0]) / face.w, (screen[1] * c.printed[1]) / face.h];
  const ratio = meta.vector ? Infinity : Math.min(c.pixels[0] / need[0], c.pixels[1] / need[1]);
  const status: Status = ratio >= 1 ? 'good' : ratio >= 0.5 ? 'ok' : 'low';
  const pct = Math.round(Math.min(ratio, 9.99) * 100);
  const label = status === 'good' ? 'Matches the screen' : status === 'ok' ? 'Slightly soft on screen' : 'Too low for the screen';
  return {
    kind: 'screen',
    status,
    label: meta.vector ? 'Matches the screen (vector)' : `${label} · ${pct}%`,
    detail: `Screen is ${screen[0]} × ${screen[1]} px; artwork supplies ${Math.round(c.pixels[0])} × ${Math.round(c.pixels[1])} px over it.`,
    value: ratio,
    ...c,
  };
}

// --- Everything with a graphic on the current stage -----------------------------------

export interface GraphicUse {
  target: FaceRef;
  owner: string; // object name or "Stage"
  faceName: string;
  size: { w: number; h: number };
  graphic: GraphicPlacement;
  meta?: GraphicMeta;
  /** Screen pixel size, if this face is a screen. */
  screen?: [number, number];
  result?: CheckResult;
}

const res = (s: string): [number, number] => s.split('x').map(Number) as [number, number];

export function graphicUses(): GraphicUse[] {
  const s = useProjectStore.getState();
  const t = getTemplate(s.templateId)!;
  const params = s.paramsByTemplate[s.templateId];
  const data = s.dataByTemplate[s.templateId];
  const list = s.objectsByTemplate[s.templateId] ?? [];
  const uses: GraphicUse[] = [];
  const add = (u: Omit<GraphicUse, 'meta' | 'result'>) => {
    const meta = s.graphics[u.graphic.id];
    const result = meta ? (u.screen ? checkScreen(u.graphic, meta, u.size, u.screen) : checkPrint(u.graphic, meta, u.size)) : undefined;
    uses.push({ ...u, meta, result });
  };
  for (const o of list) {
    if (isGroup(o) || inherited(o, list, 'hidden')) continue;
    const type = getObjectType(o.type);
    if (!type || !o.faces) continue;
    for (const f of type.faces(o.params)) {
      const style: FaceStyle | undefined = o.faces[f.id] ?? o.faces[ALL_FACES];
      if (!style?.graphic) continue;
      let screen: [number, number] | undefined;
      if (type.id === 'led-wall' && f.id === 'screen') screen = [num(o.params, 'panelsWide') * num(o.params, 'pixelsPerPanel'), num(o.params, 'panelsHigh') * num(o.params, 'pixelsPerPanel')];
      if (type.id === 'projection-screen' && f.id === 'screen') screen = res(str(o.params, 'resolution'));
      add({ target: { objectId: o.id, face: f.id }, owner: o.name, faceName: f.name, size: { w: f.width, h: f.height }, graphic: style.graphic, screen });
    }
  }
  const styles = s.surfaceStylesByTemplate[s.templateId] ?? {};
  for (const sf of t.surfaces(params, data)) {
    const g = styles[sf.id]?.graphic;
    if (!g) continue;
    // Shaped surfaces (arch frame, round floors): the graphic spans the outline's box.
    const xs = sf.outline?.map((p) => p[0]) ?? [];
    const ys = sf.outline?.map((p) => p[1]) ?? [];
    const size = sf.outline ? { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } : { w: sf.width, h: sf.height };
    add({ target: { objectId: SURFACE, face: sf.id }, owner: 'Stage', faceName: sf.label, size, graphic: g, screen: sf.glow ? [1920, 1080] : undefined });
  }
  return uses;
}

/** Pixel size needed for a face at a given DPI. */
export const requiredPixels = (size: { w: number; h: number }, dpi: number): [number, number] => [Math.ceil((size.w / INCH) * dpi), Math.ceil((size.h / INCH) * dpi)];
