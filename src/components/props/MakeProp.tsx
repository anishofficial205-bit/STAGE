import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { autoMask, bbox, brush, checkCutout, compose, crop, cropToFiles, hasTransparency, loadPic, type CutoutProblem, type Pic } from '../../photoProps/image';
import { estimateDepth } from '../../photoProps/ai';
import { prepare, type Prepared, type TapPoint } from '../../photoProps/segment';
import { buildPropGeometry } from '../../photoProps/mesh';
import { newPropId, saveProp, type PropMode } from '../../photoProps/store';
import { usePlacing } from '../../objects/placing';
import { PHOTO_PROP } from '../../objects/photoProp';
import { useProjectStore } from '../../store/useProjectStore';
import { Field } from '../fields';

type ViewId = 'front' | 'side' | 'back';
const VIEWS: { id: ViewId; label: string; help: string }[] = [
  { id: 'front', label: 'Front', help: 'Needed. Straight on, the whole prop in the picture.' },
  { id: 'side', label: 'Side', help: 'Optional. Gives the right thickness from top to bottom.' },
  { id: 'back', label: 'Back', help: 'Optional. The picture on the back.' },
];

/** Where an outline came from. */
type Source = 'phone' | 'tap' | 'colour';

interface View {
  pic: Pic;
  /** The outline (from the phone's cut-out, the taps, or the colour guess). */
  base: Uint8Array;
  /** Brush touch-ups on top of the outline. */
  add: Uint8Array;
  remove: Uint8Array;
  source: Source;
  taps: TapPoint[];
  /** Colour guess only: how much background to remove. */
  strength: number;
}

const maskOf = (v: View) => compose(v.base, v.add, v.remove);

type Load = { state: 'idle' } | { state: 'loading'; mb: [number, number] | null } | { state: 'running' } | { state: 'ready' } | { state: 'error' };

const len = (key: string, label: string, min: number, max: number, help?: string) => ({ key, label, group: '', type: 'number' as const, unit: 'length' as const, default: min, min, max, step: 0.01, help });

const PROBLEMS: Record<CutoutProblem, string> = {
  empty: 'Nothing is kept yet. Tap on the prop.',
  tiny: 'Only a small part is kept. Tap more of the prop, or paint it back with the Keep brush.',
  everything: 'This keeps nearly the whole photo. Tap on the prop, then tap what’s not the prop on the background.',
  edge: 'The prop touches the edge of the photo, so part of it may be cut off. A photo with some space around the prop works best.',
};

/** Make a prop from photos: tap the prop to cut it out, get its shape (in the browser), size it, save it to My props. */
export function MakeProp({ onClose }: { onClose: () => void }) {
  const units = useProjectStore((s) => s.units);
  const [views, setViews] = useState<Partial<Record<ViewId, View>>>({});
  const [tab, setTab] = useState<ViewId>('front');
  const [mode, setMode] = useState<PropMode>('solid');
  const [detail, setDetail] = useState(0.4);
  const [depth, setDepth] = useState<Uint8Array | null>(null);
  const [depthLoad, setDepthLoad] = useState<Load>({ state: 'idle' });
  const [segLoad, setSegLoad] = useState<Partial<Record<ViewId, Load>>>({});
  const prepared = useRef<Partial<Record<ViewId, Prepared>>>({});
  const [name, setName] = useState('');
  const [height, setHeight] = useState(1);
  const [thick, setThick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const front = views.front;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const setView = useCallback((id: ViewId, change: Partial<View>) => setViews((x) => (x[id] ? { ...x, [id]: { ...x[id]!, ...change } } : x)), []);

  /**
   * Outline the prop under these taps. Taps made while it's still working are queued: the dots
   * show at once, and the outline catches up with the latest taps.
   */
  const queue = useRef<Partial<Record<ViewId, { taps: TapPoint[]; running: boolean }>>>({});
  const runTaps = useCallback(
    async (id: ViewId, taps: TapPoint[]) => {
      const q = (queue.current[id] ??= { taps, running: false });
      q.taps = taps;
      setView(id, { taps });
      if (q.running) return;
      const p = prepared.current[id];
      if (!p) return;
      q.running = true;
      setSegLoad((s) => ({ ...s, [id]: { state: 'running' } }));
      try {
        for (;;) {
          const now = q.taps;
          const m = now.some((t) => t.keep) ? await p.run(now) : new Uint8Array(p.width * p.height);
          if (q.taps === now) {
            setView(id, { base: m, source: 'tap' });
            break;
          }
        }
        setSegLoad((s) => ({ ...s, [id]: { state: 'ready' } }));
      } catch {
        setSegLoad((s) => ({ ...s, [id]: { state: 'error' } }));
      }
      q.running = false;
    },
    [setView],
  );
  const tapsOf = (id: ViewId) => queue.current[id]?.taps ?? views[id]?.taps ?? [];

  const add = async (id: ViewId, file: File) => {
    setError('');
    let pic: Pic;
    try {
      pic = await loadPic(file);
    } catch {
      return setError('That picture couldn’t be opened. Try a JPG or PNG.');
    }
    const phone = hasTransparency(pic);
    const empty = () => new Uint8Array(pic.width * pic.height);
    const v: View = { pic, base: autoMask(pic, null, 0.5), add: empty(), remove: empty(), source: phone ? 'phone' : 'colour', taps: [], strength: 0.5 };
    setViews((x) => ({ ...x, [id]: v }));
    setTab(id);
    if (id === 'front') {
      setDepth(null);
      setDepthLoad({ state: 'idle' });
      if (!name) setName(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 40));
    }
    delete prepared.current[id];
    delete queue.current[id];
    if (phone) return;
    // Read the photo for tapping, then start with a tap in the middle of the best guess.
    setSegLoad((s) => ({ ...s, [id]: { state: 'loading', mb: null } }));
    try {
      const p = await prepare(pic, (pr) => setSegLoad((s) => ({ ...s, [id]: pr ? { state: 'loading', mb: [pr.loaded / 1e6, pr.total / 1e6] } : { state: 'running' } })));
      prepared.current[id] = p;
      const b = bbox(v.base, pic.width, pic.height);
      const guess = b && b.w * b.h < pic.width * pic.height * 0.85 ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: pic.width / 2, y: pic.height / 2 };
      await runTaps(id, [{ ...guess, keep: true }]);
    } catch {
      setSegLoad((s) => ({ ...s, [id]: { state: 'error' } }));
    }
  };

  // The AI depth for the front photo (3D only), as soon as there is one.
  useEffect(() => {
    if (!front || mode !== 'solid' || depth || depthLoad.state !== 'idle') return;
    let live = true;
    setDepthLoad({ state: 'loading', mb: null });
    estimateDepth(front.pic, (p) => live && setDepthLoad(p ? { state: 'loading', mb: [p.loaded / 1e6, p.total / 1e6] } : { state: 'running' }))
      .then((d) => {
        if (!live) return;
        setDepth(d);
        setDepthLoad({ state: 'ready' });
      })
      .catch(() => live && setDepthLoad({ state: 'error' }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front?.pic, mode, depth]);

  const masks = useMemo(() => {
    const out: Partial<Record<ViewId, Uint8Array>> = {};
    for (const id of ['front', 'side', 'back'] as ViewId[]) if (views[id]) out[id] = maskOf(views[id]!);
    return out;
  }, [views]);
  const frontMask = masks.front ?? null;
  const frontBox = front && frontMask ? bbox(frontMask, front.pic.width, front.pic.height) : null;
  const sideBox = views.side && masks.side ? bbox(masks.side, views.side.pic.width, views.side.pic.height) : null;
  const width = frontBox ? (height * frontBox.w) / frontBox.h : height;
  const autoDepth = mode === 'cutout' ? 0.03 : sideBox ? (height * sideBox.w) / sideBox.h : Math.min(width, height) * 0.45;
  const depthM = thick ?? autoDepth;
  const frontProblems = front && frontMask ? checkCutout(frontMask, front.pic.width, front.pic.height) : [];
  const unusable = frontProblems.includes('empty');
  const doubtful = frontProblems.includes('everything') || frontProblems.includes('tiny');
  const depthPending = mode === 'solid' && detail > 0 && depthLoad.state !== 'ready' && depthLoad.state !== 'error';

  const save = async () => {
    if (!front || !frontMask) return;
    setBusy(true);
    try {
      const f = await cropToFiles(front.pic, frontMask, mode === 'solid' ? depth : null);
      if (!f) throw new Error('Nothing is kept yet. Tap on the prop.');
      const side = views.side && masks.side ? await cropToFiles(views.side.pic, masks.side) : null;
      const back = views.back && masks.back ? await cropToFiles(views.back.pic, masks.back) : null;
      const id = newPropId();
      const prop = {
        id,
        name: name.trim() || 'My prop',
        savedAt: Date.now(),
        thumbnail: await thumbnail(f.png),
        mode,
        detail,
        width,
        height,
        depth: depthM,
        front: f.png,
        ...(f.depth ? { depthMap: f.depth } : {}),
        ...(side ? { side: side.png } : {}),
        ...(back ? { back: back.png } : {}),
      };
      await saveProp(prop);
      onClose();
      const st = useProjectStore.getState();
      if (st.mode !== 'set') st.setMode('set');
      usePlacing.getState().start(PHOTO_PROP, { params: { source: id, width, height, depth: depthM }, name: prop.name, key: id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The prop couldn’t be saved.');
    }
    setBusy(false);
  };

  const v = views[tab];
  const vMask = masks[tab] ?? null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal modal--wide mp" role="dialog" aria-modal="true" aria-label="Make a prop from photos">
        <div className="mp__head">
          <h2 className="modal__title">Make a prop from photos</h2>
          <span className="hint">Photos stay on this computer.</span>
        </div>
        <div className="mp__body">
          <div className="mp__photos">
            <div className="mp__slots">
              {VIEWS.map((x) => (
                <Slot key={x.id} label={x.label} help={x.help} view={views[x.id]} mask={masks[x.id] ?? null} active={tab === x.id} onPick={() => setTab(x.id)} onFile={(f) => void add(x.id, f)} onRemove={x.id === 'front' ? undefined : () => setViews((s) => ({ ...s, [x.id]: undefined }))} />
              ))}
            </div>
            {v && vMask ? (
              <MaskEditor
                key={tab}
                view={v}
                mask={vMask}
                load={segLoad[tab] ?? { state: 'idle' }}
                onTap={(t) => void runTaps(tab, [...tapsOf(tab), t])}
                onUndoTap={() => void runTaps(tab, tapsOf(tab).slice(0, -1))}
                onBrush={(addM, removeM) => setView(tab, { add: addM, remove: removeM })}
                onStrength={(strength) => setView(tab, { strength, base: autoMask(v.pic, null, strength) })}
              />
            ) : (
              <Drop label={VIEWS.find((x) => x.id === tab)!.label} onFile={(f) => void add(tab, f)} />
            )}
            {v && vMask && (
              <ul className="mp__problems">
                {checkCutout(vMask, v.pic.width, v.pic.height).map((p) => (
                  <li key={p} className="panel-msg panel-msg--warning">
                    {PROBLEMS[p]}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mp__side">
            <div className="mp__preview">
              {front && frontMask && !unusable ? (
                <Preview front={front} frontMask={frontMask} depth={mode === 'solid' ? depth : null} side={views.side} sideMask={masks.side ?? null} back={views.back} backMask={masks.back ?? null} mode={mode} detail={detail} size={[width, height, depthM]} />
              ) : (
                <p className="mp__empty">{front ? 'Tap the prop in the photo to see it here.' : 'Add a front photo to see the prop here.'}</p>
              )}
              {front && mode === 'solid' && detail > 0 && <LoadStatus load={depthLoad} what="the shape" />}
            </div>
            <div className="segmented segmented--wide2" role="group" aria-label="Shape">
              <button className={mode === 'solid' ? 'is-active' : ''} onClick={() => setMode('solid')} title="A rounded 3D shape, with detail from the photo">
                3D
              </button>
              <button className={mode === 'cutout' ? 'is-active' : ''} onClick={() => setMode('cutout')} title="A flat board shaped like the photo: always works">
                Flat cut-out
              </button>
            </div>
            {doubtful && mode === 'solid' && (
              <p className="panel-msg panel-msg--info mp__suggest">
                The outline doesn’t look right yet, so the 3D shape may look odd.{' '}
                <button className="btn btn--link" onClick={() => setMode('cutout')}>
                  Use a flat cut-out
                </button>
              </p>
            )}
            {mode === 'solid' && (
              <label className="mp__detail" title="How much of the photo's own shape shows on top of the rounded form">
                <span className="field__label">Detail</span>
                <span className="mp__detail-row">
                  <small>None</small>
                  <input type="range" min={0} max={1} step={0.05} value={detail} onChange={(e) => setDetail(Number(e.target.value))} />
                  <small>Strong</small>
                </span>
              </label>
            )}
            <label className="field">
              <span className="field__label">Name</span>
              <input className="field__input" value={name} placeholder="e.g. Grandfather clock" onChange={(e) => setName(e.target.value)} />
            </label>
            <Field def={len('height', 'Real height', 0.05, 15, 'How tall the real prop is.')} value={height} units={units} onChange={(x) => setHeight(x as number)} />
            <Field def={len('depth', mode === 'cutout' ? 'Thickness' : 'Depth, front to back', 0.01, 15, sideBox ? 'Measured from the side photo; change it if needed.' : 'A guess; change it to the real depth.')} value={depthM} units={units} onChange={(x) => setThick(x as number)} />
            <p className="hint">Width {fmt(width, units)} — from the photo’s proportions.</p>
            {error && <p className="panel-msg panel-msg--warning">{error}</p>}
          </div>
        </div>
        <div className="modal__actions">
          <span className="hint mp__tip">Tips: shoot straight on, the whole prop in the picture with some space around it. A photo with the background already removed (from your phone’s photos app) works best.</span>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!front || unusable || busy || depthPending} onClick={() => void save()}>
            {busy ? 'Saving…' : depthPending && front ? 'Working out the shape…' : 'Save to My props and place it'}
          </button>
        </div>
      </div>
    </div>
  );
}

const fmt = (m: number, units: string) => (units === 'ft' ? `${(m / 0.3048).toFixed(1)} ft` : `${m.toFixed(2)} m`);

async function thumbnail(png: Blob) {
  const bmp = await createImageBitmap(png);
  const S = 160;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const k = Math.min((S - 16) / bmp.width, (S - 16) / bmp.height);
  ctx.drawImage(bmp, (S - bmp.width * k) / 2, (S - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
  bmp.close();
  return c.toDataURL('image/png');
}

function LoadStatus({ load, what }: { load: Load; what: string }) {
  if (load.state === 'ready' || load.state === 'idle') return null;
  return (
    <p className={`mp__ai ${load.state === 'error' ? 'is-error' : ''}`}>
      {load.state === 'loading' && (load.mb && load.mb[1] > 1 ? `Downloading the AI for ${what}, first time only… ${load.mb[0].toFixed(0)} of ${Math.max(load.mb[0], load.mb[1]).toFixed(0)} MB` : `Getting the AI for ${what} ready…`)}
      {load.state === 'running' && (what === 'the shape' ? 'Working out the shape…' : 'Finding the prop…')}
      {load.state === 'error' && (what === 'the shape' ? 'The shape AI couldn’t run here. It will be a plain rounded shape — or try Flat cut-out.' : 'Tapping isn’t available here. Use the brushes, or a photo with the background already removed.')}
    </p>
  );
}

function Slot({ label, help, view, mask, active, onPick, onFile, onRemove }: { label: string; help: string; view?: View; mask: Uint8Array | null; active: boolean; onPick: () => void; onFile: (f: File) => void; onRemove?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const url = useMemo(() => (view && mask ? thumbUrl(view.pic, mask) : null), [view, mask]);
  return (
    <div className={`mp__slot ${active ? 'is-active' : ''}`}>
      <button className="mp__slot-pic" onClick={() => (view ? onPick() : input.current?.click())} title={help}>
        {url ? <img src={url} alt="" /> : <span>+</span>}
      </button>
      <span className="mp__slot-label">
        {label}
        {view && onRemove && (
          <button className="mp__slot-x" onClick={onRemove} aria-label={`Remove the ${label.toLowerCase()} photo`}>
            ×
          </button>
        )}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

/** A cropped cut-out as a canvas (see-through background). */
function toCanvas(c: { rgba: Uint8ClampedArray; w: number; h: number }) {
  const cv = document.createElement('canvas');
  cv.width = c.w;
  cv.height = c.h;
  cv.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(c.rgba), c.w, c.h), 0, 0);
  return cv;
}

function thumbUrl(pic: Pic, mask: Uint8Array) {
  const c = crop(pic, mask);
  if (!c) return null;
  const k = Math.min(1, 120 / Math.max(c.w, c.h));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(c.w * k));
  cv.height = Math.max(1, Math.round(c.h * k));
  cv.getContext('2d')!.drawImage(toCanvas(c), 0, 0, cv.width, cv.height);
  return cv.toDataURL();
}

function Drop({ label, onFile }: { label: string; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <button
      className={`mp__drop ${over ? 'is-over' : ''}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <b>Drop the {label.toLowerCase()} photo here, or click to choose it</b>
      <span>JPG, PNG or HEIC from your phone. Then tap the prop to cut it out.</span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </button>
  );
}

type Tool = 'tap' | 'keep' | 'remove';

/** The photo with what's cut away dimmed. Tap the prop (or what isn't the prop); brush to touch up. */
function MaskEditor({ view, mask, load, onTap, onUndoTap, onBrush, onStrength }: { view: View; mask: Uint8Array; load: Load; onTap: (t: TapPoint) => void; onUndoTap: () => void; onBrush: (add: Uint8Array, remove: Uint8Array) => void; onStrength: (s: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const canTap = view.source !== 'phone' && load.state !== 'error';
  const [tool, setTool] = useState<Tool>(canTap ? 'tap' : 'remove');
  const [notProp, setNotProp] = useState(false);
  const [size, setSize] = useState(24);
  const live = useRef<{ add: Uint8Array; remove: Uint8Array } | null>(null);
  const frame = useRef(0);
  const { pic } = view;
  const busy = load.state === 'loading' || load.state === 'running';
  // While the photo is still being read, taps can't be used yet; while an outline is being worked out they queue.
  const waiting = load.state === 'loading';
  const mode: Tool = canTap ? tool : tool === 'tap' ? 'remove' : tool;

  const paint = useCallback(
    (m: Uint8Array) => {
      const c = canvas.current;
      if (!c) return;
      const img = new ImageData(new Uint8ClampedArray(pic.data), pic.width, pic.height);
      for (let i = 0; i < m.length; i++) {
        if (m[i]) continue;
        // Cut away: dimmed, on a checkerboard.
        const x = i % pic.width;
        const y = (i - x) / pic.width;
        const check = ((x >> 3) + (y >> 3)) % 2 ? 60 : 40;
        img.data[i * 4] = img.data[i * 4] * 0.25 + check;
        img.data[i * 4 + 1] = img.data[i * 4 + 1] * 0.25 + check;
        img.data[i * 4 + 2] = img.data[i * 4 + 2] * 0.25 + check;
        img.data[i * 4 + 3] = 255;
      }
      const ctx = c.getContext('2d')!;
      ctx.putImageData(img, 0, 0);
      // The taps: lime on the prop, red on what isn't.
      const r = Math.max(5, pic.width / 90);
      for (const t of view.taps) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fillStyle = t.keep ? '#d4f542' : '#ff6b5b';
        ctx.fill();
        ctx.lineWidth = r / 2.5;
        ctx.strokeStyle = '#141414';
        ctx.stroke();
      }
    },
    [pic, view.taps],
  );

  useEffect(() => paint(mask), [mask, paint]);

  const at = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * pic.width, ((e.clientY - r.top) / r.height) * pic.height] as const;
  };
  const stroke = (e: React.PointerEvent) => {
    const l = live.current;
    if (!l) return;
    const [x, y] = at(e);
    const r = (size / canvas.current!.getBoundingClientRect().width) * pic.width;
    // Keep paints onto the prop (and undoes Remove there); Remove does the opposite.
    brush(mode === 'keep' ? l.add : l.remove, pic.width, pic.height, x, y, r, true);
    brush(mode === 'keep' ? l.remove : l.add, pic.width, pic.height, x, y, r, false);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => paint(compose(view.base, l.add, l.remove)));
  };

  return (
    <div className="mp__editor">
      <div className="mp__stage">
        <canvas
          ref={canvas}
          width={pic.width}
          height={pic.height}
          className={`mp__canvas ${mode === 'tap' ? 'is-tap' : ''}`}
          style={{ aspectRatio: `${pic.width} / ${pic.height}` }}
          onPointerDown={(e) => {
            if (mode === 'tap') {
              if (waiting) return;
              const [x, y] = at(e);
              onTap({ x, y, keep: !(notProp || e.shiftKey || e.altKey) });
              return;
            }
            live.current = { add: view.add.slice(), remove: view.remove.slice() };
            (e.target as Element).setPointerCapture(e.pointerId);
            stroke(e);
          }}
          onPointerMove={stroke}
          onPointerUp={() => {
            const l = live.current;
            if (!l) return;
            live.current = null;
            onBrush(l.add, l.remove);
          }}
        />
        {canTap && busy && <LoadStatus load={load} what="finding the prop" />}
      </div>
      <div className="mp__tools">
        <div className="segmented" role="group" aria-label="Tool">
          {canTap && (
            <button className={mode === 'tap' ? 'is-active' : ''} onClick={() => setTool('tap')} title="Tap the prop to cut it out">
              Tap
            </button>
          )}
          <button className={mode === 'keep' ? 'is-active' : ''} onClick={() => setTool('keep')} title="Paint back parts of the prop that were cut away">
            Keep brush
          </button>
          <button className={mode === 'remove' ? 'is-active' : ''} onClick={() => setTool('remove')} title="Paint over background that was left in">
            Remove brush
          </button>
        </div>
        {mode === 'tap' ? (
          <>
            <label className="mp__check" title="Tap things that aren’t part of the prop (or hold Shift while tapping)">
              <input type="checkbox" checked={notProp} onChange={(e) => setNotProp(e.target.checked)} />
              Tap what’s not the prop
            </label>
            {view.taps.length > 0 && (
              <button className="btn btn--small" onClick={onUndoTap} disabled={waiting}>
                Undo tap
              </button>
            )}
          </>
        ) : (
          <label className="mp__range" title="Brush size">
            Size
            <input type="range" min={6} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </label>
        )}
        {view.source === 'colour' && !canTap && (
          <label className="mp__range" title="How much of the background to remove">
            Background
            <input type="range" min={0} max={1} step={0.05} value={view.strength} onChange={(e) => onStrength(Number(e.target.value))} />
          </label>
        )}
      </div>
      <p className="hint mp__how">
        {view.source === 'phone'
          ? 'Already cut out. Touch up with the brushes if needed.'
          : canTap
            ? 'Tap the prop to outline it. Tap again to add a missed part; tick “Tap what’s not the prop” (or hold Shift) to drop a wrong bit. Brushes fix the last details.'
            : 'Paint away what isn’t the prop with the Remove brush.'}
      </p>
    </div>
  );
}

/** The prop as it will look, turning slowly. */
function Preview({ front, frontMask, depth, side, sideMask, back, backMask, mode, detail, size }: { front: View; frontMask: Uint8Array; depth: Uint8Array | null; side?: View; sideMask: Uint8Array | null; back?: View; backMask: Uint8Array | null; mode: PropMode; detail: number; size: [number, number, number] }) {
  const [model, setModel] = useState<{ geometry: THREE.BufferGeometry; mats: THREE.Material[] } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const f = crop(front.pic, frontMask, depth);
      if (!f) return setModel(null);
      const s = side && sideMask ? crop(side.pic, sideMask) : null;
      const b = back && backMask ? crop(back.pic, backMask) : null;
      const geometry = buildPropGeometry({ width: f.w, height: f.h, alpha: f.alpha }, f.depth, s ? { width: s.w, height: s.h, alpha: s.alpha } : null, mode, detail);
      const tex = (c: { rgba: Uint8ClampedArray; w: number; h: number }) => {
        const t = new THREE.CanvasTexture(toCanvas(c));
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };
      const ft = tex(f);
      setModel((old) => {
        old?.geometry.dispose();
        return { geometry, mats: [new THREE.MeshStandardMaterial({ map: ft, roughness: 0.75 }), b ? new THREE.MeshStandardMaterial({ map: tex(b), roughness: 0.75 }) : new THREE.MeshStandardMaterial({ map: ft, color: '#9a9a9a', roughness: 0.8 })] };
      });
    }, 200);
    return () => clearTimeout(t);
  }, [front, frontMask, depth, side, sideMask, back, backMask, mode, detail]);
  const [w, h, d] = size;
  const k = 1.6 / Math.max(w, h, d);
  return (
    <Canvas className="mp__canvas3d" camera={{ position: [1.6, 1.1, 2.4], fov: 35 }} dpr={[1, 2]}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 3]} intensity={1.6} />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} />
      {model && (
        <group scale={k} position={[0, -(h * k) / 2, 0]}>
          <mesh geometry={model.geometry} material={model.mats} scale={[w, h, d]} />
        </group>
      )}
      <OrbitControls autoRotate autoRotateSpeed={1.6} enablePan={false} enableZoom={false} />
    </Canvas>
  );
}
