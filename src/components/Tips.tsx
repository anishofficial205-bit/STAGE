import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import { viewportBridge } from '../objects/ui';
import type { Vec3 } from '../types';
import { useShell } from './shell';

/**
 * One-time tips: a small bubble the first time you do something, next to the
 * thing it's about. Each shows once (remembered in this browser); "Reset tips"
 * in Help brings them back.
 */
export type TipId = 'stage' | 'object' | 'light' | 'graphic' | 'path' | 'export' | 'new-project' | 'presets' | 'layers';

const TEXT: Record<TipId, string> = {
  stage: 'Change size here, or drag its edges.',
  object: 'Drag to move it · Use the handles to resize.',
  light: 'Drag the target to aim it.',
  graphic: 'Drag inside to reposition · Choose Fit or Fill.',
  path: 'Press Space to play the scene.',
  export: 'Lighting plans and blocking sheets use technical terms crews know.',
  'new-project': 'Start here: pick a stage and its size.',
  presets: 'Each card is a ready-made size. Double-click one to start straight away.',
  layers: 'Everything in your scene is listed here. Click to pick, right-click to hide or delete; › folds it away.',
};

const KEY = (id: TipId) => `stage-builder:tip:${id}`;
const seen = (id: TipId) => {
  try {
    return !!localStorage.getItem(KEY(id));
  } catch {
    return true;
  }
};
const markSeen = (id: TipId) => {
  try {
    localStorage.setItem(KEY(id), '1');
  } catch {
    /* not remembered */
  }
};

/** Where the bubble points: an element (CSS selector) or a point in the 3D view. */
type Anchor = { selector: string } | { world: Vec3 };

export const useTips = create<{ tip: { id: TipId; anchor: Anchor } | null; dismiss: () => void }>((set, get) => ({
  tip: null,
  dismiss: () => {
    const t = get().tip;
    if (t) markSeen(t.id);
    set({ tip: null });
  },
}));

/** Tips about what you're doing in a mode; they're stale once you've moved on to another mode. */
const MODE_TIPS: Partial<Record<TipId, string>> = { stage: 'set', object: 'set', graphic: 'set', light: 'lights', path: 'blocking' };

/** Show a tip the first time (does nothing once it has been seen, or while another is showing). */
export function showTip(id: TipId, anchor: Anchor) {
  if (seen(id) || useTips.getState().tip) return;
  const m = MODE_TIPS[id];
  if (m && useProjectStore.getState().mode !== m) return;
  useTips.setState({ tip: { id, anchor } });
}

export function resetTips() {
  try {
    for (const id of Object.keys(TEXT)) localStorage.removeItem(KEY(id as TipId));
  } catch {
    /* nothing remembered */
  }
}

const v = new THREE.Vector3();
type Box = { left: number; top: number; right: number; bottom: number };
/** The anchor's box on screen (a point in the 3D view is a box of no size). */
function screenOf(a: Anchor): Box | null {
  if ('selector' in a) {
    const r = document.querySelector(a.selector)?.getBoundingClientRect();
    return r && r.width ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
  }
  const three = viewportBridge.three;
  if (!three) return null;
  v.set(...a.world).project(three.camera);
  if (v.z > 1) return null;
  const r = three.gl.domElement.getBoundingClientRect();
  const x = r.left + ((v.x + 1) / 2) * r.width;
  const y = r.top + ((1 - v.y) / 2) * r.height;
  return { left: x, top: y, right: x, bottom: y };
}

const GAP = 14;
const HALF = 170; // half the bubble's widest
/**
 * Where the bubble goes so it never covers what it's about: beside things at the
 * left or right edge (panels, the Home sidebar), otherwise (and for a point in
 * the 3D view) above, or below when
 * there's no room above. Tall things are pointed at near their top, where their title is.
 */
function place(b: Box) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const midY = b.bottom - b.top > 120 ? b.top + 28 : (b.top + b.bottom) / 2;
  const y = Math.min(Math.max(midY, 40), h - 40);
  const sized = b.right > b.left;
  if (sized && b.right < w * 0.4 && b.right + GAP + 2 * HALF < w) return { side: 'right' as const, x: b.right + GAP, y, arrow: 0 };
  if (sized && b.left > w * 0.6 && b.left - GAP - 2 * HALF > 0) return { side: 'left' as const, x: b.left - GAP, y, arrow: 0 };
  const cx = (b.left + b.right) / 2;
  const x = Math.min(Math.max(cx, HALF + 12), w - HALF - 12);
  if (b.top > 100) return { side: 'above' as const, x, y: b.top - GAP, arrow: cx - x };
  return { side: 'below' as const, x, y: b.bottom + GAP, arrow: cx - x };
}

let openedAt = 0;

/** Watches for the first time things happen and shows the matching tip. */
function useTriggers() {
  // Home, the New project dialog and the first time in the editor.
  useEffect(() => {
    const later = (f: () => void, ms: number) => window.setTimeout(f, ms);
    const onShell = (s: ReturnType<typeof useShell.getState>, p?: ReturnType<typeof useShell.getState>) => {
      if (s.home && !s.newProject && (!p || !p.home || p.newProject)) later(() => document.querySelector('.hm-new') && showTip('new-project', { selector: '.hm-new' }), 900);
      if (s.newProject && !s.changingStage && (!p || !p.newProject)) {
        if (useTips.getState().tip?.id === 'new-project') useTips.getState().dismiss();
        later(() => showTip('presets', { selector: '.np__card.is-active' }), 600);
      }
      if (!s.home && !s.newProject && p && (p.home || p.newProject)) {
        if (useTips.getState().tip?.id === 'presets' || useTips.getState().tip?.id === 'new-project') useTips.getState().dismiss();
        later(() => !useShell.getState().home && showTip('layers', { selector: '[data-tour="layers"]' }), 2500);
      }
    };
    onShell(useShell.getState());
    return useShell.subscribe((s, p) => onShell(s, p));
  }, []);
  useEffect(
    () =>
      useProjectStore.subscribe((s, p) => {
        const t = s.templateId;
        // A project or template opening builds its pieces one by one: that isn't you adding them.
        if (s.projectId !== p.projectId) openedAt = Date.now();
        if (Date.now() - openedAt < 1500) return;
        // The stage selected for the first time.
        if (s.stageSelected && !p.stageSelected) window.setTimeout(() => showTip('stage', { selector: '.dock__body .stage-props .group' }), 500);
        // First set piece placed (one piece: not a template or a project loading).
        const objs = s.objectsByTemplate[t] ?? [];
        const prevObjs = p.objectsByTemplate[t] ?? [];
        if (t === p.templateId && objs.length === prevObjs.length + 1 && s.mode === 'set') {
          const o = objs[objs.length - 1];
          window.setTimeout(() => {
            const placed = (useProjectStore.getState().objectsByTemplate[t] ?? []).find((x) => x.id === o.id);
            // Above the quick bar over the new piece, so it covers neither.
            if (document.querySelector('.quick')) showTip('object', { selector: '.quick' });
            else showTip('object', placed ? { world: worldOf(placed.id) ?? [0, 1, 0] } : { selector: '.viewport' });
          }, 400);
        }
        // First graphic put on a face.
        const graphics = (list: typeof objs) => list.reduce((n, o) => n + Object.values(o.faces ?? {}).filter((f) => f?.graphic).length, 0);
        if (t === p.templateId && graphics(objs) > graphics(prevObjs)) window.setTimeout(() => showTip('graphic', { selector: '.dock__body .graphic-controls, .dock__body .group' }), 400);
        // First light added.
        const lights = s.lightingByTemplate[t]?.fixtures ?? [];
        const prevLights = p.lightingByTemplate[t]?.fixtures ?? [];
        if (t === p.templateId && lights.length === prevLights.length + 1 && s.mode === 'lights') {
          const f = lights[lights.length - 1];
          window.setTimeout(() => showTip('light', { world: f.target }), 500);
        }
        // First path drawn.
        const paths = (b: typeof s.blockingByTemplate[string]) => (b?.scenes ?? []).reduce((n, sc) => n + sc.paths.length, 0);
        if (t === p.templateId && paths(s.blockingByTemplate[t]) > paths(p.blockingByTemplate[t]) && s.mode === 'blocking') window.setTimeout(() => showTip('path', { selector: '.playbar__play' }), 400);
      }),
    [],
  );
}

/** World centre of a set piece, from the object in the 3D scene. */
function worldOf(id: string): Vec3 | null {
  const scene = viewportBridge.three?.scene;
  let found: THREE.Object3D | null = null;
  scene?.traverse((o) => {
    if (!found && o.userData?.objectId === id) found = o;
  });
  if (!found) return null;
  const box = new THREE.Box3().setFromObject(found);
  const c = box.getCenter(new THREE.Vector3());
  return [c.x, box.max.y, c.z];
}

export function Tips() {
  useTriggers();
  const tip = useTips((s) => s.tip);
  const dismiss = useTips((s) => s.dismiss);
  const mode = useProjectStore((s) => s.mode);
  const [pos, setPos] = useState<Box | null>(null);

  useEffect(() => {
    if (!tip) return;
    const update = () => setPos(screenOf(tip.anchor));
    update();
    const id = window.setInterval(update, 250);
    return () => window.clearInterval(id);
  }, [tip]);

  // A tip belongs to what you were doing; moving to another mode puts it away.
  const [tipMode, setTipMode] = useState(mode);
  useEffect(() => {
    if (tip) setTipMode(mode);
  }, [tip]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tip && mode !== tipMode && !['export', 'new-project', 'presets', 'layers'].includes(tip.id)) dismiss();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tip || !pos) return null;
  const at = place(pos);
  return (
    <div className={`tip tip--${at.side}`} role="status" style={{ left: at.x, top: at.y, ['--arrow' as string]: `${at.arrow}px` }}>
      <span>{TEXT[tip.id]}</span>
      <button className="tip__ok" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
