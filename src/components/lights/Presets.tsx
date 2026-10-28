import { useRef, useState } from 'react';
import { presetActions, useLightPresets, type LightPreset, type MoodPreset, type RigPreset } from '../../lighting/presets';
import { useLightPlacing } from '../../lighting/moods';
import { FIXTURES, type Fixture } from '../../lighting/types';
import { lightActions } from '../../lighting/actions';
import { Group, Row, RowPlus } from '../SettingsList';
import { Modal } from '../Modal';
import { ICONS } from './LightsPanels';

/** A button that turns into a name box and a Save button. */
export function SaveAs({ label, placeholder, onSave, primary = false }: { label: string; placeholder: string; onSave: (name: string) => unknown; primary?: boolean }) {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (name === null)
    return (
      <button className={`btn ${primary ? 'btn--primary' : ''}`} onClick={() => setName('')}>
        {label}
      </button>
    );
  const save = async () => {
    setBusy(true);
    await onSave(name || placeholder);
    setBusy(false);
    setName(null);
  };
  return (
    <span className="save-as">
      <input
        className="field__input"
        autoFocus
        value={name}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') setName(null);
        }}
        aria-label="Name"
      />
      <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>
        Save
      </button>
    </span>
  );
}

/** "Save as my light" on a selected light. */
export function SaveLightPreset({ f }: { f: Fixture }) {
  const [done, setDone] = useState(false);
  if (done) return <span className="hint save-as__done">Saved to My lights</span>;
  return (
    <SaveAs
      label="Save as my light…"
      placeholder={f.name}
      onSave={(name) => {
        if (presetActions.saveLight(f, name)) setDone(true);
      }}
    />
  );
}

const lights = (l: ReturnType<typeof useLightPresets.getState>['list']) => l.filter((p): p is LightPreset => p.kind === 'light');
const moods = (l: ReturnType<typeof useLightPresets.getState>['list']) => l.filter((p): p is MoodPreset => p.kind === 'mood');
const rigs = (l: ReturnType<typeof useLightPresets.getState>['list']) => l.filter((p): p is RigPreset => p.kind === 'rig');

/** Rows for the lights saved in My lights, in the “Add a light” list. */
export function MyLightRows() {
  const list = lights(useLightPresets((s) => s.list));
  const placing = useLightPlacing((s) => s.preset?.id);
  return (
    <>
      {list.map((p) => (
        <Row
          key={p.id}
          icon={
            <span className="sl-glyph sl-glyph--light" style={{ ['--tone' as string]: p.color }}>
              {ICONS[p.type]}
            </span>
          }
          label={p.name}
          value={placing === p.id ? 'Click the stage…' : 'Mine'}
          accent={placing === p.id}
          action={<RowPlus />}
          onClick={() => {
            const pl = useLightPlacing.getState();
            if (FIXTURES[p.type].mount !== 'rig') {
              const f = lightActions.addFixture(p.type);
              return void lightActions.patch([f.id], presetActions.lightPatch(p));
            }
            if (pl.preset?.id === p.id) pl.cancel();
            else pl.start(p.type, p);
          }}
          title={`${FIXTURES[p.type].label} · ${p.intensity}% · click it, then click on stage`}
        />
      ))}
    </>
  );
}

/** Saved moods as cards under the built-in ones, and a button to save the stage as a mood. */
export function MyMoods({ onPick }: { onPick: (name: string) => void }) {
  const list = moods(useLightPresets((s) => s.list));
  return (
    <>
      <p className="sl-gt">My moods</p>
      {list.length > 0 && (
        <div className="mood-cards">
          {list.map((m) => (
            <span key={m.id} className="mood-card mood-card--mine">
              <button
                className="mood-card__pick"
                onClick={() => {
                  presetActions.applyMood(m);
                  onPick(m.name);
                }}
                title={`${m.lights.length} lights · works on any stage`}
              >
                {m.thumbnail ? <img src={m.thumbnail} alt="" /> : <span className="mood-card__blank" />}
                <span className="mood-card__name">{m.name}</span>
              </button>
              <button className="mood-card__x" onClick={() => presetActions.remove(m.id)} aria-label={`Delete ${m.name}`} title="Delete this mood">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <SaveAs label="Save this lighting as my mood…" placeholder="My mood" onSave={(name) => presetActions.saveMood(name)} />
      <p className="sl-note">Your moods work on any stage in any project: lights are matched to the ones there, added where missing and sized to fit.</p>
    </>
  );
}

/** The My presets page: moods, rigs and lights you saved, plus moving them to another computer. */
export function PresetsPage() {
  const list = useLightPresets((s) => s.list);
  const [confirm, setConfirm] = useState<RigPreset | null>(null);
  const [msg, setMsg] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(presetActions.exportFile());
    a.download = 'my-lighting-presets.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <>
      <Group title="My moods">
        {moods(list).map((m) => (
          <Row key={m.id} label={m.name} value={`${m.lights.length} lights`} onClick={() => presetActions.applyMood(m)} action={<span className="sl-row__chev-text">Use</span>} />
        ))}
        {!moods(list).length && <p className="sl-note sl-note--in">None yet. Light the stage the way you like, then save it from Mood.</p>}
      </Group>
      <MyMoodsSave />
      <Group title="My rigs">
        {rigs(list).map((r) => (
          <Row key={r.id} label={r.name} value={`${r.positions.length} places · ${r.lights.length} lights`} onClick={() => setConfirm(r)} action={<span className="sl-row__chev-text">Use</span>} />
        ))}
        {!rigs(list).length && <p className="sl-note sl-note--in">A rig is where lights hang and which lights are there — e.g. your venue’s standard rig.</p>}
      </Group>
      <SaveAs label="Save these lights as my rig…" placeholder="My rig" onSave={(name) => presetActions.saveRig(name)} />
      <Group title="My lights">
        {lights(list).map((p) => (
          <Row
            key={p.id}
            icon={
              <span className="sl-glyph sl-glyph--light" style={{ ['--tone' as string]: p.color }}>
                {ICONS[p.type]}
              </span>
            }
            label={p.name}
            value={`${FIXTURES[p.type].label.split(' /')[0]} · ${p.intensity}%`}
            action={<span className="sl-row__chev-text">Delete</span>}
            onClick={() => presetActions.remove(p.id)}
          />
        ))}
        {!lights(list).length && <p className="sl-note sl-note--in">Pick a light and choose “Save as my light…”. It then appears under Add a light.</p>}
      </Group>
      {(moods(list).length > 0 || rigs(list).length > 0) && (
        <Group title="Remove a mood or rig">
          {[...moods(list), ...rigs(list)].map((p) => (
            <Row key={p.id} label={p.name} value={p.kind === 'mood' ? 'Mood' : 'Rig'} action={<span className="sl-row__chev-text sl-danger">Delete</span>} onClick={() => presetActions.remove(p.id)} />
          ))}
        </Group>
      )}
      <Group title="Another computer">
        <Row label="Save my presets to a file" disabled={!list.length} onClick={download} action={<span className="sl-row__chev-text">Download</span>} />
        <Row label="Add presets from a file" onClick={() => input.current?.click()} action={<span className="sl-row__chev-text">Open</span>} />
      </Group>
      {msg && <p className="sl-note">{msg}</p>}
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const n = await presetActions.importFile(file);
            setMsg(`Added ${n} preset${n === 1 ? '' : 's'}.`);
          } catch (err) {
            setMsg(err instanceof Error && err.message.startsWith('That file') ? err.message : 'That file isn’t a lighting presets file.');
          }
        }}
      />
      <p className="sl-note">Presets are kept in this browser and work in every project.</p>
      {confirm && (
        <Modal title={`Use the rig “${confirm.name}”?`} onClose={() => setConfirm(null)}>
          <p className="modal__text">This replaces every light and place to hang lights on this stage with the rig, sized to fit. Saved looks and groups for the old lights are removed. You can undo it.</p>
          <div className="modal__actions">
            <button className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={() => {
                presetActions.applyRig(confirm);
                setConfirm(null);
              }}
            >
              Replace the lights
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function MyMoodsSave() {
  return <SaveAs label="Save this lighting as my mood…" placeholder="My mood" onSave={(name) => presetActions.saveMood(name)} />;
}
