import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { useProjectStore } from '../store/useProjectStore';
import { viewportBridge } from '../objects/ui';
import { setRotation } from '../objects/actions';
import { ALL_FACES } from '../objects/faceMaterial';
import { useLightsUI } from '../lighting/ui';
import { lightActions } from '../lighting/actions';
import { useBlockingUI } from '../blocking/ui';
import { useVenueUI } from '../venue/ui';
import { useSelections, type Pick } from './layers/selection';
import { nameOf, removePick } from './layers/ops';
import { QUICK_COLOURS } from './objects/ObjectProperties';
import { useShell } from './shell';
import { useExportState } from '../export/state';
import { useDismiss } from './useDismiss';

/** The userData key each kind of thing carries in the 3D scene. */
const MARK: Record<string, string> = {
  'set/object': 'objectId',
  'lights/fixture': 'fixture',
  'lights/position': 'lightPosition',
  'performers/performer': 'performer',
  'venue/room': 'venueRoom',
  'venue/wall': 'venueWall',
  'venue/door': 'venueDoor',
  'venue/furniture': 'venueFurniture',
};

function findObjects(p: Pick): THREE.Object3D[] {
  const key = MARK[`${p.domain}/${p.kind}`];
  const scene = viewportBridge.three?.scene;
  if (!key || !scene) return [];
  const ids = new Set(p.ids);
  const out: THREE.Object3D[] = [];
  scene.traverse((o) => {
    const v = o.userData?.[key];
    if (v && ids.has(v) && !(o.parent && o.parent.userData?.[key] === v)) out.push(o);
  });
  return out;
}

const box = new THREE.Box3();
const part = new THREE.Box3();
const v = new THREE.Vector3();

/** Follows the selection on screen: the point just above its top centre. */
function useAnchor(p: Pick | null) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const key = p ? `${p.domain}/${p.kind}/${p.ids.join()}` : '';
  useEffect(() => {
    if (!p) return setAt(null);
    let objs = findObjects(p);
    let frame = 0;
    let n = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      // Pieces are rebuilt as they change: look them up again now and then.
      if (++n % 30 === 0 || !objs.length) objs = findObjects(p);
      const three = viewportBridge.three;
      if (!three || !objs.length) return setAt(null);
      box.makeEmpty();
      for (const o of objs) if (o.parent) box.union(part.setFromObject(o));
      if (box.isEmpty()) return setAt(null);
      v.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(three.camera);
      if (v.z > 1) return setAt(null);
      const r = three.gl.domElement.getBoundingClientRect();
      const x = Math.round(r.left + ((v.x + 1) / 2) * r.width);
      const y = Math.round(r.top + ((1 - v.y) / 2) * r.height);
      setAt((cur) => (cur && cur.x === x && cur.y === y ? cur : { x, y }));
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return at;
}

const I = ({ d, w = 1.8 }: { d: string; w?: number }) => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const TURN = 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4';
const COPY = 'M8 8h12v12H8zM4 16V6a2 2 0 0 1 2-2h10';
const DELETE = 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13';
const AIM = 'M12 3v4M12 17v4M3 12h4M17 12h4M12 12h.01';
const PATH = 'M4 18c4 0 4-12 8-12s4 12 8 12';
const MORE = 'M5 12h.01M12 12h.01M19 12h.01';
const SOLO = 'M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3zM10 20h4';

function Act({ label, icon, onClick, danger, accent }: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean; accent?: boolean }) {
  return (
    <button className={`quick__btn ${danger ? 'is-danger' : ''} ${accent ? 'is-accent' : ''}`} onClick={onClick} onPointerDown={(e) => e.stopPropagation()}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** Colour for the whole piece, picked from a few swatches. */
function Colour({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const first = useProjectStore((s) => (s.objectsByTemplate[s.templateId] ?? []).find((o) => o.id === ids[0]));
  const current = first?.faces?.[ALL_FACES]?.color ?? '#cfc6bb';
  return (
    <span className="quick__colour" ref={ref}>
      <Act label="Colour" icon={<span className="quick__swatch" style={{ background: current }} />} onClick={() => setOpen(!open)} />
      {open && (
        <span className="quick__swatches" role="menu">
          {QUICK_COLOURS.map(([name, hex]) => (
            <button
              key={hex}
              className="quick__chip"
              style={{ background: hex }}
              title={name}
              aria-label={name}
              onClick={() => {
                const s = useProjectStore.getState();
                s.batch(`Coloured ${ids.length === 1 ? `“${first?.name}”` : `${ids.length} pieces`} ${name.toLowerCase()}`, () =>
                  ids.forEach((id) => s.setFaceStyle(id, ALL_FACES, { material: 'paint', color: hex, roughness: 0.8 })),
                );
                setOpen(false);
              }}
            />
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * A small bar that floats just above whatever is picked in the 3D view: the few
 * things you do most (colour, turn, copy, delete…), and More for the full panel.
 */
export function QuickBar() {
  const { own } = useSelections();
  const exporting = useExportState((s) => s.exporting);
  const drawing = useBlockingUI((s) => !!s.tool);
  const aiming = useLightsUI((s) => s.focusMode);
  const venueTool = useVenueUI((s) => s.tool !== 'select');
  const p = own && own.domain !== 'stage' && MARK[`${own.domain}/${own.kind}`] && !exporting && !drawing && !aiming && !venueTool ? own : null;
  const at = useAnchor(p);
  useProjectStore((s) => s.objectsByTemplate); // names follow renames
  if (!p || !at) return null;
  const ids = p.ids;
  const one = ids.length === 1;
  const label = one ? nameOf({ domain: p.domain, kind: p.kind, id: ids[0] }) : `${ids.length} selected`;
  // More: the sidebar's Edit tab, scrolled to the top.
  const more = () => {
    useShell.getState().setDock('edit');
    requestAnimationFrame(() => document.querySelector('.dock__body')?.scrollTo({ top: 0, behavior: 'smooth' }));
  };
  const del = () => removePick(p);

  let actions: ReactNode;
  if (p.domain === 'set')
    actions = (
      <>
        <Colour ids={ids} />
        <Act
          label="Turn"
          icon={<I d={TURN} />}
          onClick={() => {
            const s = useProjectStore.getState();
            const list = s.objectsByTemplate[s.templateId] ?? [];
            s.batch(`Turned ${one ? `“${label}”` : label}`, () => ids.forEach((id) => setRotation(id, (list.find((o) => o.id === id)?.rotation ?? 0) + 90)));
          }}
        />
        <Act label="Copy" icon={<I d={COPY} />} onClick={() => useProjectStore.getState().duplicateObjects(ids)} />
      </>
    );
  else if (p.kind === 'fixture')
    actions = (
      <>
        <Act label="Aim" icon={<I d={AIM} />} onClick={() => useLightsUI.getState().setFocusMode(true)} />
        <SoloAct ids={ids} />
        <Act label="Copy" icon={<I d={COPY} />} onClick={() => lightActions.duplicate(ids)} />
      </>
    );
  else if (p.kind === 'performer' && one) actions = <Act label="Draw path" icon={<I d={PATH} />} accent onClick={() => useBlockingUI.getState().setTool('path')} />;

  return (
    <div className="quick" role="toolbar" aria-label={label} style={{ left: at.x, top: at.y }} onPointerDown={(e) => e.stopPropagation()}>
      <span className="quick__name">{label}</span>
      <span className="quick__sep" />
      {actions}
      <Act label="Delete" icon={<I d={DELETE} />} danger onClick={del} />
      <span className="quick__sep" />
      <Act label="More" icon={<I d={MORE} w={3.4} />} onClick={more} />
    </div>
  );
}

/** Solo: see only what these lights do (everything else goes dark until you show all again). */
function SoloAct({ ids }: { ids: string[] }) {
  const solo = useLightsUI((s) => s.solo);
  const on = !!solo && solo.length === ids.length && ids.every((id) => solo.includes(id));
  return <Act label={on ? 'Show all' : 'Solo'} icon={<I d={SOLO} />} onClick={() => useLightsUI.getState().setSolo(on ? null : ids)} />;
}
