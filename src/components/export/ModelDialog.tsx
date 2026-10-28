import { useState } from 'react';
import { Modal } from '../Modal';
import { exportModel, type ModelFormat } from '../../export/model';
import { fileSlug } from '../../graphics/specSheet';

const FORMATS: { id: ModelFormat; app: string; file: string; how: string }[] = [
  { id: 'sketchup', app: 'SketchUp', file: '.dae (Collada)', how: 'In SketchUp: File › Import, choose COLLADA (*.dae).' },
  { id: 'blender', app: 'Blender', file: '.glb (glTF)', how: 'In Blender: File › Import › glTF 2.0. Keeps colours and pictures.' },
  { id: 'rhino', app: 'Rhino', file: '.obj + .mtl', how: 'In Rhino: File › Import the .obj; keep “Map OBJ Y to Rhino Z” on and units in metres.' },
  { id: 'obj', app: 'Anything else', file: '.obj + .mtl', how: 'OBJ opens in almost every 3D program (3ds Max, Cinema 4D, Maya, Vectorworks…).' },
];

/** Export the stage as a 3D model for SketchUp, Blender, Rhino or anything that reads OBJ. */
export function ModelDialog({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<ModelFormat>('sketchup');
  const [lights, setLights] = useState(true);
  const [performers, setPerformers] = useState(false);
  const [backstage, setBackstage] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const f = FORMATS.find((x) => x.id === format)!;

  const go = async () => {
    setBusy(true);
    setMsg('');
    try {
      const { blob, name, pieces } = await exportModel(format, { lights, performers, backstage }, fileSlug());
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setMsg(`Saved ${name} — ${pieces} pieces.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'The model couldn’t be exported.');
    }
    setBusy(false);
  };

  const check = (label: string, on: boolean, set: (v: boolean) => void) => (
    <label className="field field--inline">
      <span className="field__label">{label}</span>
      <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'is-on' : ''}`} onClick={() => set(!on)}>
        <span className="switch__knob" />
      </button>
    </label>
  );

  return (
    <Modal title="Export a 3D model" onClose={onClose}>
      <p className="modal__text">The stage, seating and set as a 3D model, in metres, to open in other software.</p>
      <div className="model-formats" role="radiogroup" aria-label="Open it in">
        {FORMATS.map((x) => (
          <button key={x.id} role="radio" aria-checked={format === x.id} className={`model-format ${format === x.id ? 'is-active' : ''}`} onClick={() => setFormat(x.id)}>
            <b>{x.app}</b>
            <small>{x.file}</small>
          </button>
        ))}
      </div>
      <p className="hint">{f.how}</p>
      <div className="model-options">
        {check('Light fixtures and bars', lights, setLights)}
        {check('Performers', performers, setPerformers)}
        {check('Backstage (walls, rooms, furniture)', backstage, setBackstage)}
      </div>
      {msg && <p className="panel-msg panel-msg--info">{msg}</p>}
      <div className="modal__actions">
        <button className="btn" onClick={onClose}>
          {msg.startsWith('Saved') ? 'Done' : 'Cancel'}
        </button>
        <button className="btn btn--primary" disabled={busy} onClick={() => void go()}>
          {busy ? 'Exporting…' : `Export for ${f.app}`}
        </button>
      </div>
    </Modal>
  );
}
