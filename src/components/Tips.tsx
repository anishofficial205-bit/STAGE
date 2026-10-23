import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import { viewportBridge } from '../objects/ui';
import type { Vec3 } from '../types';

/**
 * One-time tips: a small bubble the first time you do something, next to the
 * thing it's about. Each shows once (remembered in this browser); "Reset tips"
 * in Help brings them back.
 */
export type TipId = 'stage' | 'object' | 'light' | 'graphic' | 'path' | 'export';

const TEXT: Record<TipId, string> = {
  stage: 'Drag the edges to resize your stage.',
  object: 'Drag to move it · Use the handles to resize.',
  light: 'Drag the target to aim it.',
  graphic: 'Drag inside to reposition · Choose Fit or Fill.',
  path: 'Press Space to play the scene.',
  export: 'Lighting plans and blocking sheets use technical terms crews know.',
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

/** Show a tip the first time (does nothing once it has been seen, or while another is showing). */
export function showTip(id: TipId, anchor: Anchor) {
  if (seen(id) || useTips.getState().tip) return;
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
  useEffect(
    () =>
      useProjectStore.subscribe((s, p) => {
        const t = s.templateId;
        // A stage chosen (switching type, or opening a starter).
        if (t !== p.templateId && s.mode === 'stage') window.setTimeout(() => showTip('stage', { selector: '.sidebar--right .group' }), 600);
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
        if (t === p.templateId && graphics(objs) > graphics(prevObjs)) window.setTimeout(() => showTip('graphic', { selector: '.sidebar--right .graphic-controls, .sidebar--right .group' }), 400);
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
    if (tip && mode !== tipMode && tip.id !== 'export') dismiss();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tip || !pos) return null;
  const x = Math.min(Math.max(pos.x, 150), window.innerWidth - 150);
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
