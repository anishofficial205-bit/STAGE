import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { UNIT_LABEL, fit, guessUnits, loadModel, snapshot, toGlb, type FileUnits, type LoadedModel } from '../../photoProps/modelImport';
import { newPropId, saveProp } from '../../photoProps/store';
import { usePlacing } from '../../objects/placing';
import { PHOTO_PROP } from '../../objects/photoProp';
import { useProjectStore } from '../../store/useProjectStore';
import { Field } from '../fields';

const len = (key: string, label: string, help?: string) => ({ key, label, group: '', type: 'number' as const, unit: 'length' as const, default: 1, min: 0.02, max: 60, step: 0.01, help });
const fmt = (m: number, units: string) => (units === 'ft' ? `${(m / 0.3048).toFixed(1)} ft` : `${m.toFixed(2)} m`);

/** Import a 3D model (OBJ with its colours and pictures, or glTF) as one of My props. */
export function ImportModel({ onClose }: { onClose: () => void }) {
  const units = useProjectStore((s) => s.units);
  const [loaded, setLoaded] = useState<LoadedModel | null>(null);
  const [fileUnits, setFileUnits] = useState<FileUnits>('m');
  const [zUp, setZUp] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const read = async (files: File[]) => {
    if (!files.length) return;
    setError('');
    setBusy(true);
    try {
      const m = await loadModel(files);
      // Most programs that work with Z up (SketchUp, Rhino, 3ds Max) still write OBJ with Y up, so Y up is the default.
      setLoaded(m);
      setZUp(false);
      setFileUnits(guessUnits(m, false));
      setHeight(null);
      setName(m.name.slice(0, 40));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That model couldn’t be read.');
    }
    setBusy(false);
  };

  const fitted = useMemo(() => (loaded ? fit(loaded, fileUnits, zUp) : null), [loaded, fileUnits, zUp]);
  // Typing a height scales the whole model evenly.
  const k = fitted && height ? height / fitted.size[1] : 1;
  const size: [number, number, number] | null = fitted ? [fitted.size[0] * k, fitted.size[1] * k, fitted.size[2] * k] : null;
  const odd = size && (Math.max(...size) > 25 || Math.max(...size) < 0.05);

  const save = async () => {
    if (!fitted || !size) return;
    setBusy(true);
    try {
      const id = newPropId();
      const prop = { id, kind: 'model' as const, name: name.trim() || 'My model', savedAt: Date.now(), thumbnail: snapshot(fitted.model, size), mode: 'solid' as const, width: size[0], height: size[1], depth: size[2], model: await toGlb(fitted.model) };
      await saveProp(prop);
      onClose();
      const st = useProjectStore.getState();
      if (st.mode !== 'set') st.setMode('set');
      usePlacing.getState().start(PHOTO_PROP, { params: { source: id, width: size[0], height: size[1], depth: size[2] }, name: prop.name, key: id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The model couldn’t be saved.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal modal--wide im" role="dialog" aria-modal="true" aria-label="Import a 3D model">
        <h2 className="modal__title">Import a 3D model</h2>
        {!loaded ? (
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
              void read([...e.dataTransfer.files]);
            }}
          >
            <b>{busy ? 'Reading the model…' : 'Drop the model here, or click to choose it'}</b>
            <span>An .obj file — pick its .mtl (colours) and pictures with it, or put them all in a .zip. A .glb or .gltf works too. Exported from SketchUp, Blender, Rhino, 3ds Max or a model website.</span>
          </button>
        ) : (
          <div className="im__body">
            <div className="im__preview">{fitted && size && <ModelPreview model={fitted.model} size={size} />}</div>
            <div className="im__side">
              <label className="field">
                <span className="field__label">Name</span>
                <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">The file is in</span>
                <select className="field__select" value={fileUnits} onChange={(e) => (setFileUnits(e.target.value as FileUnits), setHeight(null))}>
                  {(Object.keys(UNIT_LABEL) as FileUnits[]).map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="segmented segmented--wide2" role="group" aria-label="Which way is up">
                <button className={!zUp ? 'is-active' : ''} onClick={() => setZUp(false)} title="Most files">
                  Y is up
                </button>
                <button className={zUp ? 'is-active' : ''} onClick={() => setZUp(true)} title="Lying on its back? Try this">
                  Z is up
                </button>
              </div>
              <p className="hint">Lying on its back in the preview? Switch to “Z is up”.</p>
              {size && (
                <>
                  <Field def={len('height', 'Real height', 'Change it and the whole model scales evenly.')} value={size[1]} units={units} onChange={(v) => setHeight(v as number)} />
                  <p className="hint">
                    {fmt(size[0], units)} wide × {fmt(size[2], units)} deep · {Math.round(loaded.triangles).toLocaleString()} triangles
                  </p>
                </>
              )}
              {odd && <p className="panel-msg panel-msg--warning">That’s an unusual size for a prop. Check “The file is in”, or type the real height.</p>}
              {loaded.notes.map((n) => (
                <p key={n} className="panel-msg panel-msg--warning">
                  {n}
                </p>
              ))}
            </div>
          </div>
        )}
        {error && <p className="panel-msg panel-msg--warning">{error}</p>}
        <input
          ref={input}
          type="file"
          multiple
          accept=".obj,.mtl,.zip,.glb,.gltf,.bin,image/*"
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            void read(files);
          }}
        />
        <div className="modal__actions">
          {loaded && (
            <button className="btn btn--ghost" onClick={() => setLoaded(null)} disabled={busy}>
              Choose other files
            </button>
          )}
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {loaded && (
            <button className="btn btn--primary" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save to My props and place it'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelPreview({ model, size }: { model: THREE.Object3D; size: [number, number, number] }) {
  const k = 1.6 / Math.max(...size);
  return (
    <Canvas className="mp__canvas3d" camera={{ position: [1.6, 1.1, 2.4], fov: 35 }} dpr={[1, 2]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 3, 3]} intensity={1.6} />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} />
      <group scale={[size[0] * k, size[1] * k, size[2] * k]} position={[0, -(size[1] * k) / 2, 0]}>
        <primitive object={model} />
      </group>
      <OrbitControls autoRotate autoRotateSpeed={1.4} enablePan={false} />
    </Canvas>
  );
}
