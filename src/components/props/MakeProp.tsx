import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { autoMask, bbox, brush, crop, cropToFiles, hasTransparency, loadPic, type Pic } from '../../photoProps/image';
import { estimateDepth } from '../../photoProps/ai';
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

interface View {
  pic: Pic;
  mask: Uint8Array;
  strength: number;
  /** Touched up with the brush: don't redo the cut-out automatically. */
  edited: boolean;
  /** Already cut out (a photo with a see-through background). */
  clear: boolean;
}

type Ai = { state: 'idle' } | { state: 'loading'; mb: [number, number] | null } | { state: 'running' } | { state: 'done' } | { state: 'error'; msg: string };

const len = (key: string, label: string, min: number, max: number, help?: string) => ({ key, label, group: '', type: 'number' as const, unit: 'length' as const, default: min, min, max, step: 0.01, help });

/** Make a prop from photos: cut it out, get its shape with AI (in the browser), size it, save it to My props. */
export function MakeProp({ onClose }: { onClose: () => void }) {
  const units = useProjectStore((s) => s.units);
  const [views, setViews] = useState<Partial<Record<ViewId, View>>>({});
  const [tab, setTab] = useState<ViewId>('front');
  const [mode, setMode] = useState<PropMode>('solid');
  const [depth, setDepth] = useState<Uint8Array | null>(null);
  const [ai, setAi] = useState<Ai>({ state: 'idle' });
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

  const add = async (id: ViewId, file: File) => {
    setError('');
    try {
      const pic = await loadPic(file);
      const clear = hasTransparency(pic);
      const v: View = { pic, mask: autoMask(pic, null, 0.5), strength: 0.5, edited: false, clear };
      setViews((x) => ({ ...x, [id]: v }));
      setTab(id);
      if (id === 'front') {
        setDepth(null);
        setAi({ state: 'idle' });
        if (!name) setName(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 40));
      }
    } catch {
      setError('That picture couldn’t be opened. Try a JPG or PNG.');
    }
  };

  // The AI depth for the front photo (3D only), as soon as there is one.
  useEffect(() => {
    if (!front || mode !== 'solid' || depth || ai.state !== 'idle') return;
    let live = true;
    setAi({ state: 'loading', mb: null });
    estimateDepth(front.pic, (p) => live && setAi(p ? { state: 'loading', mb: [p.loaded / 1e6, p.total / 1e6] } : { state: 'running' }))
      .then((d) => {
        if (!live) return;
        setDepth(d);
        setAi({ state: 'done' });
        // With the depth known, the automatic cut-out can tell the prop from the background better.
        setViews((x) => (x.front && !x.front.edited && !x.front.clear ? { ...x, front: { ...x.front, mask: autoMask(x.front.pic, d, x.front.strength) } } : x));
      })
      .catch((e) => live && setAi({ state: 'error', msg: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front?.pic, mode, depth]);

  const setView = (id: ViewId, change: Partial<View>) => setViews((x) => (x[id] ? { ...x, [id]: { ...x[id]!, ...change } } : x));

  // Proportions from the cut-outs.
  const frontBox = front ? bbox(front.mask, front.pic.width, front.pic.height) : null;
  const sideBox = views.side ? bbox(views.side.mask, views.side.pic.width, views.side.pic.height) : null;
  const width = frontBox ? (height * frontBox.w) / frontBox.h : height;
  const autoDepth = mode === 'cutout' ? 0.03 : sideBox ? (height * sideBox.w) / sideBox.h : Math.min(width, height) * 0.45;
  const depthM = thick ?? autoDepth;

  const save = async () => {
    if (!front) return;
    setBusy(true);
    try {
      const f = await cropToFiles(front.pic, front.mask, mode === 'solid' ? depth : null);
      if (!f) throw new Error('The cut-out is empty: keep some of the picture with the brush.');
      const side = views.side ? await cropToFiles(views.side.pic, views.side.mask) : null;
      const back = views.back ? await cropToFiles(views.back.pic, views.back.mask) : null;
      const id = newPropId();
      const prop = {
        id,
        name: name.trim() || 'My prop',
        savedAt: Date.now(),
        thumbnail: await thumbnail(f.png),
        mode,
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
                <Slot key={x.id} label={x.label} help={x.help} view={views[x.id]} active={tab === x.id} onPick={() => setTab(x.id)} onFile={(f) => void add(x.id, f)} onRemove={x.id === 'front' ? undefined : () => setViews((s) => ({ ...s, [x.id]: undefined }))} />
              ))}
            </div>
            {v ? (
              <MaskEditor key={tab} view={v} onChange={(mask) => setView(tab, { mask, edited: true })} onStrength={(strength) => setView(tab, { strength, edited: false, mask: autoMask(v.pic, tab === 'front' ? depth : null, strength) })} />
            ) : (
              <Drop label={VIEWS.find((x) => x.id === tab)!.label} onFile={(f) => void add(tab, f)} />
            )}
          </div>
          <div className="mp__side">
            <div className="mp__preview">
              {front ? <Preview front={front} depth={mode === 'solid' ? depth : null} side={views.side} back={views.back} mode={mode} size={[width, height, depthM]} /> : <p className="mp__empty">Add a front photo to see the prop here.</p>}
              {front && mode === 'solid' && <AiStatus ai={ai} />}
            </div>
            <div className="segmented segmented--wide2" role="group" aria-label="Shape">
              <button className={mode === 'solid' ? 'is-active' : ''} onClick={() => setMode('solid')} title="AI works out the shape from the photo">
                3D
              </button>
              <button className={mode === 'cutout' ? 'is-active' : ''} onClick={() => setMode('cutout')} title="A flat board shaped like the photo: instant">
                Flat cut-out
              </button>
            </div>
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
          <span className="hint mp__tip">Tips: shoot straight on, against a plain wall, the whole prop in the picture. A photo with the background already removed works best.</span>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!front || busy || (mode === 'solid' && ai.state !== 'done' && ai.state !== 'error')} onClick={() => void save()}>
            {busy ? 'Saving…' : mode === 'solid' && front && ai.state !== 'done' && ai.state !== 'error' ? 'Working out the shape…' : 'Save to My props and place it'}
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

function AiStatus({ ai }: { ai: Ai }) {
  if (ai.state === 'done' || ai.state === 'idle') return null;
  return (
    <p className={`mp__ai ${ai.state === 'error' ? 'is-error' : ''}`}>
      {ai.state === 'loading' && (ai.mb ? `Downloading the shape AI, first time only… ${ai.mb[0].toFixed(0)} of ${Math.max(ai.mb[0], ai.mb[1]).toFixed(0)} MB` : 'Starting the shape AI…')}
      {ai.state === 'running' && 'Working out the shape…'}
      {ai.state === 'error' && 'The shape AI couldn’t run here. You can still save it: it will be smoother, or try Flat cut-out.'}
    </p>
  );
}

function Slot({ label, help, view, active, onPick, onFile, onRemove }: { label: string; help: string; view?: View; active: boolean; onPick: () => void; onFile: (f: File) => void; onRemove?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const url = useMemo(() => (view ? thumbUrl(view) : null), [view]);
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

function thumbUrl(v: View) {
  const c = crop(v.pic, v.mask);
  if (!c) return null;
  const k = Math.min(1, 120 / Math.max(c.w, c.h));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(c.w * k));
  cv.height = Math.max(1, Math.round(c.h * k));
  cv.getContext('2d')!.drawImage(toCanvas(c), 0, 0, cv.width, cv.height);
  return cv.toDataURL();
}

/** A cropped cut-out as a canvas (see-through background). */
function toCanvas(c: { rgba: Uint8ClampedArray; w: number; h: number }) {
  const cv = document.createElement('canvas');
  cv.width = c.w;
  cv.height = c.h;
  cv.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(c.rgba), c.w, c.h), 0, 0);
  return cv;
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
      <span>JPG, PNG or HEIC from your phone. A photo with the background already removed (e.g. lifted from the phone’s photos app) works best.</span>
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

/** The photo with what's cut away dimmed; brush to keep or remove parts. */
function MaskEditor({ view, onChange, onStrength }: { view: View; onChange: (mask: Uint8Array) => void; onStrength: (s: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [keep, setKeep] = useState(false);
  const [size, setSize] = useState(24);
  const mask = useRef(view.mask);
  const drawing = useRef(false);
  const frame = useRef(0);
  const { pic } = view;

  const paint = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const img = new ImageData(new Uint8ClampedArray(pic.data), pic.width, pic.height);
    const m = mask.current;
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
    c.getContext('2d')!.putImageData(img, 0, 0);
  }, [pic]);

  useEffect(() => {
    mask.current = view.mask;
    paint();
  }, [view.mask, paint]);

  const at = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * pic.width, ((e.clientY - r.top) / r.height) * pic.height] as const;
  };
  const stroke = (e: React.PointerEvent) => {
    const [x, y] = at(e);
    const r = (size / canvas.current!.getBoundingClientRect().width) * pic.width;
    brush(mask.current, pic.width, pic.height, x, y, r, keep);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
  };

  return (
    <div className="mp__editor">
      <canvas
        ref={canvas}
        width={pic.width}
        height={pic.height}
        className="mp__canvas"
        style={{ aspectRatio: `${pic.width} / ${pic.height}`, cursor: 'crosshair' }}
        onPointerDown={(e) => {
          drawing.current = true;
          mask.current = mask.current.slice();
          (e.target as Element).setPointerCapture(e.pointerId);
          stroke(e);
        }}
        onPointerMove={(e) => drawing.current && stroke(e)}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          onChange(mask.current);
        }}
      />
      <div className="mp__tools">
        <div className="segmented" role="group" aria-label="Brush">
          <button className={!keep ? 'is-active' : ''} onClick={() => setKeep(false)} title="Paint over background that was left in">
            Remove
          </button>
          <button className={keep ? 'is-active' : ''} onClick={() => setKeep(true)} title="Paint back parts of the prop that were cut away">
            Keep
          </button>
        </div>
        <label className="mp__range" title="Brush size">
          Brush
          <input type="range" min={6} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
        {!view.clear && (
          <label className="mp__range" title="How much of the background to remove">
            Background
            <input type="range" min={0} max={1} step={0.05} value={view.strength} onChange={(e) => onStrength(Number(e.target.value))} />
          </label>
        )}
      </div>
    </div>
  );
}

/** The prop as it will look, turning slowly. */
function Preview({ front, depth, side, back, mode, size }: { front: View; depth: Uint8Array | null; side?: View; back?: View; mode: PropMode; size: [number, number, number] }) {
  const [model, setModel] = useState<{ geometry: THREE.BufferGeometry; mats: THREE.Material[] } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const f = crop(front.pic, front.mask, depth);
      if (!f) return setModel(null);
      const s = side ? crop(side.pic, side.mask) : null;
      const b = back ? crop(back.pic, back.mask) : null;
      const geometry = buildPropGeometry({ width: f.w, height: f.h, alpha: f.alpha }, f.depth, s ? { width: s.w, height: s.h, alpha: s.alpha } : null, mode);
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
    }, 250);
    return () => clearTimeout(t);
  }, [front, depth, side, back, mode]);
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
