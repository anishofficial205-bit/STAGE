import { useState } from 'react';
import { Collapsible } from '../Collapsible';
import { Field } from '../fields';
import { useActiveLighting } from '../../store/useProjectStore';
import { PRESET_LOOKS, groupActions, lookActions } from '../../lighting/looks';
import { lightActions } from '../../lighting/actions';
import { useLightsUI } from '../../lighting/ui';

/** Save, recall (with a fade), duplicate and update lighting looks. */
export function LooksSection() {
  const looks = useActiveLighting().looks;
  const fixtures = useActiveLighting().fixtures.length;
  const [fade, setFade] = useState(2);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [presets, setPresets] = useState(false);
  return (
    <Collapsible id="light-looks" title={`Looks${looks.length ? ` (${looks.length})` : ''}`}>
      <div className="look-save">
        <input className="field__input" placeholder="Name, e.g. Sunset" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (lookActions.save(name), setName(''))} />
        <button className="btn btn--small" onClick={() => (lookActions.save(name), setName(''))} disabled={!fixtures} title="Store every light’s state and the haze">
          Save look
        </button>
      </div>
      <Field def={{ key: 'fade', label: 'Fade time (s)', group: '', type: 'number', unit: 'none', default: 2, min: 0, max: 15, step: 0.5 }} value={fade} units="m" onChange={(v) => setFade(v as number)} />
      <ul className="look-list">
        {looks.map((k) => (
          <li key={k.id} className="look-row">
            {editing === k.id ? (
              <input className="field__input" autoFocus value={k.name} onChange={(e) => lookActions.rename(k.id, e.target.value)} onBlur={() => setEditing(null)} onKeyDown={(e) => e.key === 'Enter' && setEditing(null)} />
            ) : (
              <button className="look-row__go" onClick={() => lookActions.recall(k.id, fade)} title={`Fade to “${k.name}” over ${fade} s`}>
                ▶ {k.name}
              </button>
            )}
            <span className="look-row__tools">
              <button onClick={() => lookActions.overwrite(k.id)} title="Update: store the current lighting in this look">⟳</button>
              <button onClick={() => setEditing(k.id)} title="Rename">✎</button>
              <button onClick={() => lookActions.duplicate(k.id)} title="Duplicate">⧉</button>
              <button onClick={() => lookActions.remove(k.id)} title="Delete">×</button>
            </span>
          </li>
        ))}
      </ul>
      <button className="btn btn--link" onClick={() => setPresets(!presets)} aria-expanded={presets} disabled={!fixtures}>
        {presets ? '▾' : '▸'} Start from a preset
      </button>
      {presets && (
        <div className="chips">
          {PRESET_LOOKS.map((p) => (
            <button key={p.name} className="chip" onClick={() => lookActions.fromPreset(p, fade)}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      <p className="hint">Click a look to fade to it. To change one, recall it, adjust the lights, then ⟳ to update it.</p>
    </Collapsible>
  );
}

/** Groups of lights (e.g. Front wash, Cyc, Specials) with a shared level and colour. */
export function GroupsSection() {
  const { groups, fixtures } = useActiveLighting();
  const selected = useLightsUI((s) => (s.selected?.kind === 'fixture' ? s.selected.ids : []));
  const [name, setName] = useState('');
  const make = () => {
    if (!selected.length) return;
    groupActions.create(name, selected);
    setName('');
  };
  return (
    <Collapsible id="light-groups" title={`Groups${groups.length ? ` (${groups.length})` : ''}`}>
      <div className="look-save">
        <input className="field__input" placeholder="Name, e.g. Front wash" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && make()} />
        <button className="btn btn--small" onClick={make} disabled={!selected.length} title="Group the selected lights (Shift-click lights to select several)">
          Group {selected.length || ''}
        </button>
      </div>
      {groups.map((g) => {
        const members = fixtures.filter((f) => g.ids.includes(f.id));
        const level = members.length ? Math.round(members.reduce((t, f) => t + (f.on ? f.intensity : 0), 0) / members.length) : 0;
        return (
          <div key={g.id} className="group-card">
            <div className="group-card__head">
              <button className="btn btn--ghost" onClick={() => useLightsUI.getState().select({ kind: 'fixture', ids: g.ids })} title="Select these lights">
                {g.name} <span className="hint">· {members.length}</span>
              </button>
              <input type="color" className="color-field__picker" value={members[0]?.color ?? '#ffffff'} onChange={(e) => lightActions.patch(g.ids, { color: e.target.value, gel: undefined, kelvin: undefined }, `gcolor:${g.id}`)} title="Colour of every light in the group" aria-label={`${g.name} colour`} />
              <button className="look-row__x" onClick={() => groupActions.remove(g.id)} title="Delete group (the lights stay)">
                ×
              </button>
            </div>
            <Field def={{ key: 'lvl', label: 'Level (%)', group: '', type: 'number', unit: 'none', default: 0, min: 0, max: 100, step: 1 }} value={level} units="m" onChange={(v) => lightActions.patch(g.ids, { intensity: v as number, on: (v as number) > 0 }, `glevel:${g.id}`)} />
            {selected.length > 0 && (
              <div className="btn-row">
                <button className="btn btn--small" onClick={() => groupActions.setMembers(g.id, [...new Set([...g.ids, ...selected])])}>
                  + Add selected
                </button>
                <button className="btn btn--small" onClick={() => groupActions.setMembers(g.id, g.ids.filter((id) => !selected.includes(id)))}>
                  − Remove selected
                </button>
              </div>
            )}
          </div>
        );
      })}
      {!groups.length && <p className="hint">Shift-click lights to select several, then group them.</p>}
    </Collapsible>
  );
}
