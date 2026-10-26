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
  layers: 'Everything in your scene is listed here — right-click to delete or hide.',
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
function screenOf(a: Anchor): { x: number; y: number } | null {
  if ('selector' in a) {
    const r = document.querySelector(a.selector)?.getBoundingClientRect();
    return r && r.width ? { x: r.left + r.width / 2, y: r.top } : null;
  }
  const three = viewportBridge.three;
  if (!three) return null;
  v.set(...a.world).project(three.camera);
  if (v.z > 1) return null;
  const r = three.gl.domElement.getBoundingClientRect();
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
}

/** Watches for the first time things happen and shows the matching tip. */
function useTriggers() {
  // Home, the New project dialog and the first time in the editor.
  useEffect(() => {
    const later = (f: () => void, ms: number) => window.setTimeout(f, ms);
    const onShell = (s: ReturnType<typeof useShell.getState>, p?: ReturnType<typeof useShell.getState>) => {
      if (s.home && !s.newProject && (!p || !p.home || p.newProject)) later(() => document.querySelector('.home__new') && showTip('new-project', { selector: '.home__new' }), 900);
      if (s.newProject && !s.changingStage && (!p || !p.newProject)) {
        if (useTips.getState().tip?.id === 'new-project') useTips.getState().dismiss();
        later(() => showTip('presets', { selector: '.np__card.is-active' }), 600);
      }
      if (!s.home && !s.newProject && p && (p.home || p.newProject)) {
        if (useTips.getState().tip?.id === 'presets' || useTips.getState().tip?.id === 'new-project') useTips.getState().dismiss();
        later(() => !useShell.getState().home && showTip('layers', { selector: '.outliner__head' }), 2500);
      }
    };
    onShell(useShell.getState());
    return useShell.subscribe((s, p) => onShell(s, p));
  }, []);
  useEffect(
    () =>
      useProjectStore.subscribe((s, p) => {
        const t = s.templateId;
        // The stage selected for the first time.
        if (s.stageSelected && !p.stageSelected) window.setTimeout(() => showTip('stage', { selector: '.split__bottom .stage-props .group' }), 500);
        // First set piece placed.
        const objs = s.objectsByTemplate[t] ?? [];
        const prevObjs = p.objectsByTemplate[t] ?? [];
        if (t === p.templateId && objs.length > prevObjs.length && s.mode === 'set') {
          const o = objs[objs.length - 1];
          window.setTimeout(() => {
            const placed = (useProjectStore.getState().objectsByTemplate[t] ?? []).find((x) => x.id === o.id);
            showTip('object', placed ? { world: worldOf(placed.id) ?? [0, 1, 0] } : { selector: '.viewport' });
          }, 400);
        }
        // First graphic put on a face.
        const graphics = (list: typeof objs) => list.reduce((n, o) => n + Object.values(o.faces ?? {}).filter((f) => f?.graphic).length, 0);
        if (t === p.templateId && graphics(objs) > graphics(prevObjs)) window.setTimeout(() => showTip('graphic', { selector: '.split__bottom .graphic-controls, .split__bottom .group' }), 400);
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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

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
  const x = Math.min(Math.max(pos.x, 172), window.innerWidth - 172);
  const above = pos.y > 140;
  return (
    <div className={`tip ${above ? 'tip--above' : 'tip--below'}`} role="status" style={{ left: x, top: above ? pos.y - 12 : pos.y + 40 }}>
      <span>{TEXT[tip.id]}</span>
      <button className="tip__ok" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
