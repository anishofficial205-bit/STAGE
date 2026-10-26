import { useEffect, useRef } from 'react';
import { Field } from '../fields';
import { useActiveLighting, useProjectStore } from '../../store/useProjectStore';
import { FIXTURES, GELS, kelvinToHex, type Fixture, type FixtureType, type HangPosition, type Vec3 } from '../../lighting/types';
import { lightActions } from '../../lighting/actions';
import { useLightsUI } from '../../lighting/ui';
import { GOBOS, drawGobo, uploadGobo } from '../../lighting/gobos';
import { currentStage } from '../../objects/actions';
import { floorHeightAt } from '../../helpers/stageInfo';
import type { ParamDef } from '../../types';
import { MAX_REAL, MAX_SHADOWS, lightBudget } from './budget';
import { LooksSection, GroupsSection } from './LooksPanel';
import { Plain } from '../../glossary/Plain';
import { MoreOptions } from '../MoreOptions';
import { MOODS, SIMPLE_LIGHTS, applyMood, useLightPlacing } from '../../lighting/moods';
import { removePick } from '../layers/ops';
import { Drill, Group, ListHead, Row, RowPlus, RowSwitch, type PageDef } from '../SettingsList';
import { create } from 'zustand';

export const LIGHT_DRAG_TYPE = 'application/x-stage-light';

export const ICONS: Record<FixtureType, string> = { profile: '◢', fresnel: '◉', par: '⬤', follow: '➹', cyc: '▬', moving: '◍', uplight: '▲', practical: '♨', house: '☼' };

/** One fixture tile. Click: choose it, then click on stage where you want light (lights that stand on the floor are placed straight away). Drag: place it by hand. */
function LightTile({ t, name }: { t: FixtureType; name?: string }) {
  const choosing = useLightPlacing((s) => s.type === t);
  const spec = FIXTURES[t];
  return (
    <button
      className={`tile ${choosing ? 'is-active' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(LIGHT_DRAG_TYPE, t);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => {
        if (spec.mount !== 'rig') return void lightActions.addFixture(t);
        const p = useLightPlacing.getState();
        if (p.type === t) p.cancel();
        else p.start(t);
      }}
      title={`${name ?? spec.label} — ${spec.help} Click it, then click where you want light on stage. Or drag it onto a bar to place it by hand.`}
    >
      <span className="tile__icon tile__icon--light">{ICONS[t]}</span>
      <span className="tile__name">{name ? <span className="term term--stacked"><span className="term__plain">{name}</span><small className="term__tech" title={spec.help}>{spec.label}</small></span> : <Plain text={spec.label} stacked />}</span>
    </button>
  );
}

function Library() {
  const simple = SIMPLE_LIGHTS.map((x) => x.type);
  return (
    <>
      <div className="library__grid">
        {(Object.keys(FIXTURES) as FixtureType[])
          .filter((t) => !simple.includes(t))
          .map((t) => (
            <LightTile key={t} t={t} />
          ))}
      </div>
      <p className="sl-note">Click one, then click on stage — or drag it onto a light bar, a side pole or the floor.</p>
    </>
  );
}

function Positions() {
  return (
    <>
      <div className="btn-row">
        <button className="btn btn--small" onClick={() => lightActions.addPosition('electric')}>
          + Bar over the stage
        </button>
        <button className="btn btn--small" onClick={() => lightActions.addPosition('foh')}>
          + Bar over the audience
        </button>
        <button className="btn btn--small" onClick={() => lightActions.addPosition('boom')}>
          + Side pole
        </button>
      </div>
      <p className="sl-note">Lights snap to these, to frames from the set, or to the floor.</p>
    </>
  );
}

/**
 * Lights mode's keys and setup, mounted all the time (the panels can be tucked
 * away): Delete removes, ⌘/Ctrl+D duplicates, A aims, Esc deselects.
 */
export function useLightsMode() {
  const templateId = useProjectStore((s) => s.templateId);
  const mode = useProjectStore((s) => s.mode);
  useEffect(() => {
    if (mode === 'lights') lightActions.ensureReady();
  }, [templateId, mode]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useProjectStore.getState().mode !== 'lights') return;
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const ui = useLightsUI.getState();
      const sel = ui.selected;
      if (e.key === 'Escape') {
        if (ui.focusMode) ui.setFocusMode(false);
        else ui.select(null);
        return;
      }
      if (!sel) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removePick({ domain: 'lights', kind: sel.kind, ids: sel.ids });
      } else if (sel.kind === 'fixture' && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        lightActions.duplicate(sel.ids);
      } else if (sel.kind === 'fixture' && e.key.toLowerCase() === 'a' && !e.metaKey && !e.ctrlKey) ui.setFocusMode(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Start placing a light (or add it straight away when it stands on the floor). */
function chooseLight(t: FixtureType) {
  if (FIXTURES[t].mount !== 'rig') return void lightActions.addFixture(t);
  const p = useLightPlacing.getState();
  if (p.type === t) p.cancel();
  else p.start(t);
}

/** “Add a light” rows: the three everyday lights, and a page with the other kinds. */
function AddLightRows() {
  const choosing = useLightPlacing((s) => s.type);
  return (
    <>
      {SIMPLE_LIGHTS.map((x) => (
        <Row key={x.type} icon={<span className="sl-glyph">{ICONS[x.type]}</span>} label={x.name} value={choosing === x.type ? 'Click the stage…' : undefined} accent={choosing === x.type} action={<RowPlus />} onClick={() => chooseLight(x.type)} title={x.help} />
      ))}
      <Row label="More kinds" value={String(Object.keys(FIXTURES).length - SIMPLE_LIGHTS.length)} page="more-kinds" />
    </>
  );
}

const moreKindsPage: PageDef = { title: 'More kinds of light', render: () => <Library /> };
const placesPage: PageDef = { title: 'Places to hang lights', render: () => <Positions /> };

/** The left panel in Lights mode: adding lights and places to hang them. */
export function LightsLeft() {
  const positions = useActiveLighting().positions.length;
  return (
    <Drill pages={{ 'more-kinds': moreKindsPage, places: placesPage }}>
      <Group>
        <AddLightRows />
      </Group>
      <Group>
        <Row label="Places to hang lights" value={String(positions)} page="places" />
      </Group>
      <p className="sl-note">Pick a light, then click on stage where you want it.</p>
    </Drill>
  );
}

const num = (key: string, label: string, min: number, max: number, step: number, help?: string): ParamDef => ({ key, label, group: '', type: 'number', unit: 'none', default: min, min, max, step, help });

/** Pan (about the vertical, 0 = towards the audience) and tilt (0 = straight down) of a light's aim. */
export function panTilt(f: Fixture) {
  const [dx, dy, dz] = [f.target[0] - f.pos[0], f.target[1] - f.pos[1], f.target[2] - f.pos[2]];
  const h = Math.hypot(dx, dz);
  return { pan: Math.round((Math.atan2(dx, dz) * 180) / Math.PI), tilt: Math.round((Math.atan2(h, -dy) * 180) / Math.PI) };
}

/** Aim from pan/tilt: the beam lands where it meets the floor (or 10 m out). */
function aimFrom(f: Fixture, pan: number, tilt: number): Vec3 {
  const p = (pan * Math.PI) / 180;
  const t = (tilt * Math.PI) / 180;
  const d: Vec3 = [Math.sin(t) * Math.sin(p), -Math.cos(t), Math.sin(t) * Math.cos(p)];
  const { info } = currentStage();
  if (d[1] < -0.05) {
    let k = (f.pos[1] - 0) / -d[1];
    const h = floorHeightAt(info, f.pos[0] + d[0] * k, f.pos[2] + d[2] * k);
    k = (f.pos[1] - h) / -d[1];
    if (k > 0 && k < 80) return [f.pos[0] + d[0] * k, f.pos[1] + d[1] * k, f.pos[2] + d[2] * k];
  }
  return [f.pos[0] + d[0] * 10, f.pos[1] + d[1] * 10, f.pos[2] + d[2] * 10];
}

function ColourControls({ fixtures }: { fixtures: Fixture[] }) {
  const ids = fixtures.map((f) => f.id);
  const f = fixtures[0];
  return (
    <section className="group">
      <h3 className="group__title">Colour</h3>
      <div className="color-field">
        {GELS.map((g) => (
          <button key={g.name} type="button" className={`swatch ${f.gel === g.name ? 'is-active' : ''}`} style={{ background: g.color }} title={g.name} aria-label={g.name} onClick={() => lightActions.patch(ids, { color: g.color, gel: g.name, kelvin: undefined })} />
        ))}
      </div>
      <div className="field__row light-hex">
        <input type="color" className="color-field__picker" value={f.color} onChange={(e) => lightActions.patch(ids, { color: e.target.value, gel: undefined, kelvin: undefined }, `color:${ids.join()}`)} aria-label="Custom colour" />
        <input
          className="field__input"
          value={f.color}
          onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && lightActions.patch(ids, { color: e.target.value.toLowerCase(), gel: undefined, kelvin: undefined }, `color:${ids.join()}`)}
          aria-label="Colour hex"
          spellCheck={false}
        />
      </div>
      <p className="hint">{f.gel ? `Gel: ${f.gel}` : f.kelvin ? `White ${f.kelvin} K` : 'Custom colour'}</p>
      <Field
        def={num('kelvin', 'White: colour temperature (K)', 2700, 6500, 100, 'Warm tungsten (2700 K) to cool daylight (6500 K).')}
        value={f.kelvin ?? 3200}
        units="m"
        onChange={(v) => lightActions.patch(ids, { kelvin: v as number, color: kelvinToHex(v as number), gel: undefined }, `kelvin:${ids.join()}`)}
      />
    </section>
  );
}

function GoboControls({ fixtures }: { fixtures: Fixture[] }) {
  const ids = fixtures.map((f) => f.id);
  const custom = useActiveLighting().gobos;
  const input = useRef<HTMLInputElement>(null);
  const current = fixtures[0].gobo;
  const pick = (gobo: string | undefined) => lightActions.patch(ids, { gobo });
  return (
    <section className="group">
      <h3 className="group__title">Gobo</h3>
      <div className="gobos">
        <button className={`gobo ${!current ? 'is-active' : ''}`} onClick={() => pick(undefined)} title="No gobo">
          <span className="gobo__none">none</span>
        </button>
        {GOBOS.map((g) => (
          <button key={g.id} className={`gobo ${current === g.id ? 'is-active' : ''}`} onClick={() => pick(g.id)} title={g.name}>
            <img src={drawGobo(g.id, 48).toDataURL()} alt={g.name} />
          </button>
        ))}
        {custom.map((g) => (
          <button key={g.id} className={`gobo ${current === g.id ? 'is-active' : ''}`} onClick={() => pick(g.id)} title={g.name}>
            <span className="gobo__none">{g.name.slice(0, 6)}</span>
          </button>
        ))}
        <button className="gobo" onClick={() => input.current?.click()} title="Upload a black-and-white image">
          <span className="gobo__none">+ upload</span>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const g = await uploadGobo(file);
          useProjectStore.getState().setLighting((l) => ({ ...l, gobos: [...l.gobos, g] }));
          pick(g.id);
        }}
      />
      {current && <p className="hint">Gobo lights project with a shadow map (they count towards the {MAX_SHADOWS} shadow lights).</p>}
    </section>
  );
}

const QUICK_LIGHT_COLOURS: [string, string][] = [
  ['White', '#ffffff'],
  ['Warm white', '#ffd7a1'],
  ['Amber', '#ffb36b'],
  ['Red', '#ff4a3d'],
  ['Pink', '#ff6ec7'],
  ['Blue', '#4a7dff'],
  ['Cyan', '#5fd4ff'],
  ['Green', '#5ee07a'],
];

function FixtureProps({ fixtures }: { fixtures: Fixture[] }) {
  const units = useProjectStore((s) => s.units);
  const positions = useActiveLighting().positions;
  const focusMode = useLightsUI((s) => s.focusMode);
  const ids = fixtures.map((f) => f.id);
  const f = fixtures[0];
  const one = fixtures.length === 1;
  const spec = FIXTURES[f.type];
  const sameType = fixtures.every((x) => x.type === f.type);
  const mount = f.mount === 'floor' ? 'Floor' : f.mount === 'rig' ? 'Rigging / truss' : positions.find((p: HangPosition) => p.id === f.mount)?.name ?? 'Free';
  const pt = panTilt(f);
  return (
    <div className="props">
      <div className="panel-head">
        {one ? (
          <input className="obj-props__name" value={f.name} onChange={(e) => lightActions.patch(ids, { name: e.target.value }, `name:${f.id}`)} aria-label="Light name" />
        ) : (
          <h2 className="panel-title">{fixtures.length} lights</h2>
        )}
        <button className="btn btn--link" onClick={() => useLightsUI.getState().select(null)}>
          Done
        </button>
      </div>
      <p className="hint">
        {sameType ? spec.label : 'Mixed types'}
        {one ? ` · on ${mount}` : ''}
      </p>
      <section className="group">
        <h3 className="group__title">Colour</h3>
        <div className="color-field">
          {QUICK_LIGHT_COLOURS.map(([name, hex]) => (
            <button
              key={hex}
              type="button"
              className={`swatch ${f.color.toLowerCase() === hex ? 'is-active' : ''}`}
              style={{ background: hex }}
              title={name}
              aria-label={name}
              onClick={() => lightActions.patch(ids, { color: hex, gel: undefined, kelvin: undefined, on: true })}
            />
          ))}
          <input type="color" className="color-field__picker" value={f.color} onChange={(e) => lightActions.patch(ids, { color: e.target.value, gel: undefined, kelvin: undefined }, `color:${ids.join()}`)} title="Any colour" aria-label="Any colour" />
        </div>
      </section>
      <Field def={num('intensity', 'Brightness (%)', 0, 100, 1)} value={f.intensity} units={units} onChange={(v) => lightActions.patch(ids, { intensity: v as number, on: (v as number) > 0 }, `int:${ids.join()}`)} />
      {!spec.point && sameType && (
        <Field def={num('sharp', 'Softer ↔ Sharper', 0, 100, 1, 'How hard the edge of the pool of light is.')} value={100 - Math.round(f.soft * 100)} units={units} onChange={(v) => lightActions.patch(ids, { soft: (100 - (v as number)) / 100 }, `soft:${ids.join()}`)} />
      )}
      <MoreOptions id="light">
        {one && <Field def={num('channel', 'Channel', 1, 999, 1)} value={f.channel} units={units} onChange={(v) => lightActions.patch(ids, { channel: v as number }, `ch:${f.id}`)} />}
        <label className="field field--inline">
          <span className="field__label">On</span>
          <button type="button" role="switch" aria-checked={f.on} className={`switch ${f.on ? 'is-on' : ''}`} onClick={() => lightActions.patch(ids, { on: !f.on })}>
            <span className="switch__knob" />
          </button>
        </label>
        {!spec.point && sameType && (
          <>
            <Field def={num('beam', 'Beam angle (°)', spec.beam[0], spec.beam[1], 1)} value={f.beam} units={units} onChange={(v) => lightActions.patch(ids, { beam: v as number }, `beam:${ids.join()}`)} />
          </>
        )}
        {!spec.point && (
          <section className="group">
            <h3 className="group__title">Focus</h3>
            <div className="btn-row">
              <button className={`btn ${focusMode ? 'is-active' : ''}`} onClick={() => useLightsUI.getState().setFocusMode(!focusMode)} title="Then click a point on stage (A)">
                ⌖ Click to focus{fixtures.length > 1 ? ' all' : ''}
              </button>
            </div>
            {focusMode && <p className="panel-msg panel-msg--info">Click a point on the stage to aim {fixtures.length > 1 ? 'these lights' : 'this light'} there.</p>}
            <p className="hint">Or drag the blue target marker in the view.</p>
            {one && (f.type === 'moving' || f.type === 'follow') && (
              <>
                <Field def={num('pan', 'Pan (°)', -180, 180, 1)} value={pt.pan} units={units} onChange={(v) => lightActions.focus(ids, aimFrom(f, v as number, pt.tilt), `pan:${f.id}`)} />
                <Field def={num('tilt', 'Tilt (°)', 0, 135, 1, '0° points straight down.')} value={pt.tilt} units={units} onChange={(v) => lightActions.focus(ids, aimFrom(f, pt.pan, v as number), `tilt:${f.id}`)} />
              </>
            )}
          </section>
        )}
        <ColourControls fixtures={fixtures} />
        {sameType && (f.type === 'profile' || f.type === 'moving' || f.type === 'follow') && <GoboControls fixtures={fixtures} />}
        {!spec.point && f.type !== 'house' && (
          <label className="field field--inline">
            <span className="field__label">Cast shadows</span>
            <button type="button" role="switch" aria-checked={f.castShadow} className={`switch ${f.castShadow ? 'is-on' : ''}`} onClick={() => lightActions.patch(ids, { castShadow: !f.castShadow })}>
              <span className="switch__knob" />
            </button>
          </label>
        )}
        {one && (
          <label className="field">
            <span className="field__label">Purpose (for the hookup list)</span>
            <input className="field__input" value={f.purpose ?? ''} placeholder="e.g. DSL special" onChange={(e) => lightActions.patch(ids, { purpose: e.target.value }, `purpose:${f.id}`)} />
          </label>
        )}
      </MoreOptions>
      <div className="btn-row">
        <button className="btn" onClick={() => lightActions.duplicate(ids)}>
          Duplicate
        </button>
        <button className="btn btn--danger" onClick={() => removePick({ domain: 'lights', kind: 'fixture', ids })}>
          Delete
        </button>
      </div>
    </div>
  );
}

function PositionProps({ p }: { p: HangPosition }) {
  const units = useProjectStore((s) => s.units);
  const len = (key: string, label: string, min: number, max: number): ParamDef => ({ key, label, group: '', type: 'number', default: 0, min, max, step: 0.05 });
  const count = useActiveLighting().fixtures.filter((f) => f.mount === p.id).length;
  return (
    <div className="props">
      <div className="panel-head">
        <input className="obj-props__name" value={p.name} onChange={(e) => lightActions.patchPosition(p.id, { name: e.target.value }, `pname:${p.id}`)} aria-label="Position name" />
        <button className="btn btn--link" onClick={() => useLightsUI.getState().select(null)}>
          Done
        </button>
      </div>
      <p className="hint">
        <Plain text={p.kind === 'boom' ? 'Boom' : p.kind === 'foh' ? 'Front-of-house truss' : 'Electric (lighting batten)'} /> · {count} light{count === 1 ? '' : 's'} on it
      </p>
      <div className="field-pair">
        <Field def={len('x', 'Left ↔ Right', -100, 100)} value={p.x} units={units} onChange={(v) => lightActions.patchPosition(p.id, { x: v as number })} />
        <Field def={len('z', 'Front ↔ Back', -100, 100)} value={p.z} units={units} onChange={(v) => lightActions.patchPosition(p.id, { z: v as number })} />
      </div>
      {p.kind !== 'boom' && <Field def={len('y', 'Height', 1, 40)} value={p.y} units={units} onChange={(v) => lightActions.patchPosition(p.id, { y: v as number })} />}
      <Field def={len('length', p.kind === 'boom' ? 'Height of the pole' : 'Length', 0.5, 60)} value={p.length} units={units} onChange={(v) => lightActions.patchPosition(p.id, { length: v as number })} />
      <p className="hint">Drag it in the view to move it; the lights on it move too.</p>
      <div className="btn-row">
        <button className="btn btn--danger" onClick={() => removePick({ domain: 'lights', kind: 'position', ids: [p.id] })}>
          Delete position
        </button>
      </div>
    </div>
  );
}

/** The mood last picked (shown on the Mood row until the lights are changed by hand). */
const useLastMood = create<{ name: string | null; set: (name: string | null) => void }>((set) => ({ name: null, set: (name) => set({ name }) }));
const pickMood = (id: string) => {
  applyMood(id);
  useLastMood.getState().set(MOODS.find((m) => m.id === id)?.name ?? null);
};

/** Lights with nothing picked: a list — mood, audience and work light, adding lights, then looks, groups, the plan and haze. */
function Overview() {
  const lighting = useActiveLighting();
  const quality = useProjectStore((s) => s.lightQuality);
  const workLight = useLightsUI((s) => s.workLight);
  const lastMood = useLastMood((s) => s.name);
  const house = lighting.fixtures.filter((f) => f.type === 'house');
  const houseLevel = house.length ? Math.round(house.reduce((t, f) => t + (f.on ? f.intensity : 0), 0) / house.length) : 0;
  const { real, approx, shadows } = lightBudget(lighting.fixtures, quality);
  const lit = real.size + approx.size;
  const mood = MOODS.find((m) => m.name === lastMood);
  const count = lighting.fixtures.length;

  const pages: Record<string, PageDef | null> = {
    mood: {
      title: 'Mood',
      render: () => (
        <div className="mood-cards">
          {MOODS.map((m) => (
            <button key={m.id} className={`mood-card ${m.name === lastMood ? 'is-active' : ''}`} onClick={() => pickMood(m.id)} title={m.blurb}>
              <img src={m.image} alt="" />
              <span className="mood-card__name">{m.name}</span>
            </button>
          ))}
        </div>
      ),
    },
    audience: {
      title: 'Audience lights',
      render: () =>
        house.length > 0 ? (
          <Field def={num('house', 'Brightness (%)', 0, 100, 1)} value={houseLevel} units="m" onChange={(v) => lightActions.patch(house.map((f) => f.id), { intensity: v as number, on: (v as number) > 0 }, 'house')} />
        ) : (
          <>
            <p className="sl-note">Soft light over the seats, set as one level.</p>
            <button className="btn btn--primary" onClick={() => lightActions.addFixture('house')}>
              + Add audience lights
            </button>
          </>
        ),
    },
    'more-kinds': moreKindsPage,
    places: placesPage,
    looks: { title: 'Saved looks', render: () => <LooksSection /> },
    groups: count >= 2 ? { title: 'Light groups', render: () => <GroupsSection /> } : null,
    atmosphere: {
      title: 'Haze and quality',
      render: () => (
        <>
          <label className="field field--inline">
            <span className="field__label">Haze (see the beams)</span>
            <button type="button" role="switch" aria-checked={lighting.haze.on} className={`switch ${lighting.haze.on ? 'is-on' : ''}`} onClick={() => lightActions.setHaze({ on: !lighting.haze.on })}>
              <span className="switch__knob" />
            </button>
          </label>
          {lighting.haze.on && <Field def={num('density', 'How thick (%)', 0, 100, 1)} value={lighting.haze.density} units="m" onChange={(v) => lightActions.setHaze({ density: v as number })} />}
          <p className="sl-gt">Quality</p>
          <div className="segmented segmented--wide2" role="group" aria-label="Lighting quality">
            <button className={quality === 'draft' ? 'is-active' : ''} onClick={() => useProjectStore.getState().setLightQuality('draft')} title="Fast: no shadows (gobos still project)">
              Fast
            </button>
            <button className={quality === 'presentation' ? 'is-active' : ''} onClick={() => useProjectStore.getState().setLightQuality('presentation')} title={`Shadows from up to ${MAX_SHADOWS} lights; exports always use this`}>
              With shadows
            </button>
          </div>
          <p className="sl-note">
            {count} lights · {lit} on · {shadows.size} casting shadows
          </p>
          {count > 0 && (
            <button className="btn" onClick={lightActions.renumber} title="Number channels from front of house to the back">
              Renumber the lights
            </button>
          )}
        </>
      ),
    },
  };

  return (
    <Drill pages={pages}>
      <ListHead title="Lights" />
      {count === 0 && (
        <div className="empty-state">
          <p>Pick a mood to light your stage.</p>
          <button className="btn btn--primary btn--big" onClick={() => pickMood('warm')}>
            Light the stage
          </button>
        </div>
      )}
      <Group>
        <Row icon={mood ? <img className="sl-thumb" src={mood.image} alt="" /> : undefined} label="Mood" value={lastMood ?? 'Pick one'} page="mood" />
        <Row label="Audience lights" value={house.length ? `${houseLevel}%` : 'None'} page="audience" />
        <Row label="Work light" title="Flat bright light while you build" action={<RowSwitch on={workLight} />} onClick={() => useLightsUI.getState().toggleWorkLight()} />
      </Group>
      <Group title="Add a light">
        <AddLightRows />
      </Group>
      <Group>
        <Row label="Places to hang lights" value={String(lighting.positions.length)} page="places" />
        <Row label="Saved looks" value={lighting.looks.length ? String(lighting.looks.length) : ''} page="looks" />
        {count >= 2 && <Row label="Light groups" value={lighting.groups.length ? String(lighting.groups.length) : ''} page="groups" />}
        <Row label="Plan for the crew" disabled={!count} onClick={() => useLightsUI.getState().setPlotOpen(true)} action={<span className="sl-row__chev-text">Open</span>} title="A drawing of where every light hangs" />
        <Row label="Haze and quality" value={lighting.haze.on ? 'Haze on' : ''} page="atmosphere" />
      </Group>
      {approx.size > 0 && (
        <p className="sl-note">
          {lit} lights are on. To keep things fast, the {MAX_REAL} brightest are real lights and the other {approx.size} are drawn as soft pools.
        </p>
      )}
    </Drill>
  );
}

/** Right side in Lights mode. */
export function LightsProperties() {
  const lighting = useActiveLighting();
  const selected = useLightsUI((s) => s.selected);
  if (selected?.kind === 'fixture') {
    const fx = lighting.fixtures.filter((f) => selected.ids.includes(f.id));
    if (fx.length) return <FixtureProps fixtures={fx} />;
  }
  if (selected?.kind === 'position') {
    const p = lighting.positions.find((x) => selected.ids.includes(x.id));
    if (p) return <PositionProps p={p} />;
  }
  return <Overview />;
}
