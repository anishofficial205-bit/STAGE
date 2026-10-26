import { getTemplate } from '../templates/registry';
import { useActiveData, useActiveObjects, useActiveParams, useProjectStore } from '../store/useProjectStore';
import { useRef, useState } from 'react';
import { Outliner } from './layers/Outliner';
import { DOMAIN_MODE, editIn, modeLabel, useForeign, type Pick } from './layers/selection';
import { can, isHidden, isLocked, remove, toggleHidden, toggleLocked } from './layers/ops';
import { getObjectType } from '../objects/registry';
import { FIXTURES } from '../lighting/types';
import { ObjectProperties } from './objects/ObjectProperties';
import { SurfacesSection } from './objects/FacesSection';
import { SightlineWarnings } from './sightlines/SightlineWarnings';
import { VenueProperties } from './venue/VenuePanels';
import { LightsProperties } from './lights/LightsPanels';
import { BlockingProperties } from './blocking/BlockingPanels';
import type { ParamDef, ParamValue } from '../types';
import { Field } from './fields';
import { formatLength } from '../units';
import type { Units } from '../units';

const formatSize = (w: number, d: number, units: Units) => `${formatLength(w, units)} × ${formatLength(d, units)}`;

/** A tiny plan of the stage at a preset's proportions. */
function PresetPlan({ w, d }: { w: number; d: number }) {
  const ok = Number.isFinite(w) && Number.isFinite(d) && w > 0 && d > 0;
  const k = ok ? Math.min(64 / w, 26 / d) : 1;
  const W = ok ? w * k : 50;
  const D = ok ? d * k : 24;
  return (
    <svg className="preset-card__plan" viewBox="0 0 80 56" aria-hidden>
      <rect x={40 - W / 2} y={6} width={W} height={D} rx={1.5} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${40 - W / 2 - 4 + i * 2} ${D + 12 + i * 5} Q 40 ${D + 16 + i * 5} ${40 + W / 2 + 4 - i * 2} ${D + 12 + i * 5}`} />
      ))}
    </svg>
  );
}
import { lookup, plainText } from '../glossary/terms';
import { usePlacing } from '../objects/placing';
import { useShell } from './shell';
import { MyTemplates } from './ToolsPanel';
import { Drill, Group, ListHead, Row, type PageDef } from './SettingsList';

/**
 * Generated entirely from the active template's params schema — templates never
 * need to touch this file. Params are grouped by their `group` field in order.
 */
/** A setting's value in a few words, for the right of a row. */
export function describeValue(def: ParamDef, value: ParamValue | undefined, units: Units): string {
  if (value === undefined) return '';
  if (def.type === 'number') {
    if (def.unit !== 'none') return formatLength(Number(value), units);
    // Counts read as words: "15 rows", not a bare "15".
    const n = Math.round(Number(value) * 100) / 100;
    return `${n} ${def.label.replace(/^number of /i, '').toLowerCase()}`;
  }
  if (def.type === 'boolean') return value ? 'On' : 'Off';
  if (def.type === 'select') return plainText(def.options.find((o) => o.value === value)?.label ?? String(value));
  return '';
}

/** The stage's settings, as a list: type, size and height, then everything around it, one page each. */
function TemplateProperties() {
  const templateId = useProjectStore((s) => s.templateId);
  const units = useProjectStore((s) => s.units);
  const setParam = useProjectStore((s) => s.setParam);
  const applyPreset = useProjectStore((s) => s.applyPreset);
  const resetToDefaults = useProjectStore((s) => s.resetToDefaults);
  const params = useActiveParams();
  const data = useActiveData();
  const template = getTemplate(templateId)!;
  const selectStage = useProjectStore((s) => s.selectStage);

  const dims = template.dimensions;
  const def = (k?: string) => (k ? template.params.find((d) => d.key === k && (!d.visible || d.visible(params))) : undefined);
  const width = def(dims?.width);
  const depth = def(dims?.depth);
  const height = def(dims?.height);
  const mainKeys = [dims?.width, dims?.depth, dims?.height].filter(Boolean) as string[];
  const groups: { name: string; defs: ParamDef[] }[] = [];
  for (const d of template.params) {
    if (d.visible && !d.visible(params)) continue;
    if (mainKeys.includes(d.key)) continue;
    let g = groups.find((x) => x.name === d.group);
    if (!g) groups.push((g = { name: d.group, defs: [] }));
    g.defs.push(d);
  }
  const messages = template.messages?.(params, data) ?? [];
  const Extra = template.Panel;
  const field = (d: ParamDef) => <Field key={d.key} def={d} value={params[d.key]} units={units} onChange={(v) => setParam(d.key, v as ParamValue)} />;
  const name = lookup(template.name)?.plain ?? template.name;
  const size = width && depth ? formatSize(Number(params[width.key]), Number(params[depth.key]), units) : '';

  const sizePage = () => (
    <>
      {[width, depth].filter((d): d is ParamDef => !!d).map(field)}
      {template.presets && template.presets.length > 0 && (
        <>
          <p className="sl-gt">Or pick a common size</p>
          <div className="sl-sizes">
            {template.presets.map((preset, i) => {
              const active = Object.entries(preset.params).every(([k, v]) => params[k] === v);
              const w = dims?.width ? Number(preset.params[dims.width] ?? params[dims.width]) : NaN;
              const d = dims?.depth ? Number(preset.params[dims.depth] ?? params[dims.depth]) : NaN;
              return (
                <button key={preset.name} className={`sl-size ${active ? 'is-active' : ''}`} onClick={() => applyPreset(i)} title={preset.description}>
                  <PresetPlan w={w} d={d} />
                  <span>
                    <b>{preset.name}</b>
                    {Number.isFinite(w) && Number.isFinite(d) && <small>{formatSize(w, d, units)}</small>}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <p className="sl-note">You can also drag the round handles on the stage.</p>
    </>
  );

  const pages: Record<string, PageDef | null> = {
    size: { title: 'Size', render: sizePage },
    height: height ? { title: 'Height', render: () => field(height) } : null,
    saved: { title: 'My saved stages', render: () => <MyTemplates /> },
  };
  const plainName = (t: string) => lookup(t)?.plain ?? t;
  for (const g of groups) pages[`g:${g.name}`] = { title: plainName(g.name), render: () => <>{g.defs.map(field)}</> };

  return (
    <Drill resetKey={templateId} pages={pages}>
      <ListHead
        title="Stage"
        action={
          <button className="btn btn--small" onClick={() => selectStage(false)} title="Stop editing the stage (Esc)">
            Done
          </button>
        }
      />
      {messages.map((m, i) => (
        <p key={i} className={`panel-msg panel-msg--${m.kind}`}>
          {m.text}
        </p>
      ))}
      {Extra && <Extra />}
      <Group>
        <Row label="Type" value={name} onClick={() => useShell.getState().setNewProject(true, true)} action={<span className="sl-row__chev-text">Change</span>} />
        {width && depth && <Row label="Size" value={size} page="size" />}
        {height && <Row label="Height" value={describeValue(height, params[height.key], units)} page="height" />}
      </Group>
      {groups.length > 0 && (
        <Group title="Around the stage">
          {groups.map((g) => (
            <Row key={g.name} label={plainName(g.name)} value={describeValue(g.defs[0], params[g.defs[0].key], units)} page={`g:${g.name}`} />
          ))}
        </Group>
      )}
      <Group>
        <Row label="My saved stages" page="saved" />
      </Group>
      <Group>
        <Row label="Reset the stage" accent onClick={resetToDefaults} title="Put every setting of this stage back to its default" />
      </Group>
    </Drill>
  );
}

/** Set mode with nothing selected: starter sets and the stage's own surfaces. */
function SetProperties() {
  const empty = useActiveObjects().length === 0;
  return (
    <>
      <div className="panel-head">
        <h2 className="panel-title">Set</h2>
      </div>
      {empty ? (
        <div className="empty-state">
          <p>Add your first piece of scenery, then click on the stage to place it.</p>
          <button className="btn btn--primary btn--big" onClick={() => usePlacing.getState().start('flat')}>
            + Add a wall panel
          </button>
        </div>
      ) : (
        <p className="sidebar__empty">Click a piece to edit it, or add pieces from the library on the left.</p>
      )}
      <SurfacesSection />
    </>
  );
}

/** The selection's properties, by mode (each mode's own panels): the Edit part under Layers. */
export function ModeProperties() {
  const mode = useProjectStore((s) => s.mode);
  const hasSelection = useProjectStore((s) => s.selectedIds.length > 0);
  const stageSelected = useProjectStore((s) => s.stageSelected);
  const foreign = useForeign((s) => s.sel);
  if (foreign) return <ForeignProperties sel={foreign} />;
  if (mode === 'set' && stageSelected)
    return (
      <div className="props stage-props">
        <TemplateProperties />
      </div>
    );
  if (mode === 'venue') return <VenueProperties />;
  if (mode === 'lights') return <LightsProperties />;
  if (mode === 'blocking') return <BlockingProperties />;
  return (
    <>
      <SightlineWarnings />
      <div className="props">{hasSelection ? <ObjectProperties /> : <SetProperties />}</div>
    </>
  );
}

const SPLIT_KEY = 'stage-builder:layers-split';
const readSplit = () => {
  try {
    const v = Number(localStorage.getItem(SPLIT_KEY));
    return v >= 0.15 && v <= 0.85 ? v : 0.42;
  } catch {
    return 0.42;
  }
};

/**
 * The right-hand panel, always there (Focus mode aside): Layers on top, and
 * below it Edit — what's picked, or the mode's own settings when nothing is —
 * with a divider you can drag between them.
 */
export function LayersSide() {
  const [split, setSplit] = useState(readSplit);
  const ref = useRef<HTMLElement>(null);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const box = ref.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => setSplit(Math.min(0.85, Math.max(0.15, (ev.clientY - box.top) / box.height)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setSplit((v) => {
        try {
          localStorage.setItem(SPLIT_KEY, String(v));
        } catch {
          /* not remembered */
        }
        return v;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <aside className="layers-side" aria-label="Layers and edit" data-tour="layers" ref={ref}>
      <div className="split__top" style={{ flexBasis: `${split * 100}%` }}>
        <Outliner />
      </div>
      <div
        className="split__divider"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Drag to resize Layers and Edit"
        tabIndex={0}
        onPointerDown={onDown}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') setSplit((v) => Math.max(0.15, v - 0.05));
          if (e.key === 'ArrowDown') setSplit((v) => Math.min(0.85, v + 0.05));
        }}
      />
      <div className="split__bottom" data-tour="panel">
        <ModeProperties />
      </div>
    </aside>
  );
}

/** Something from another mode, picked in Layers: a short view with "Edit in [mode]". */
function ForeignProperties({ sel }: { sel: Pick }) {
  const s = useProjectStore();
  const target = DOMAIN_MODE[sel.domain];
  const items = sel.ids.map((id) => ({ domain: sel.domain, kind: sel.kind, id }));
  const first = items[0];
  const name = describe(s, sel);
  const caps = can(first);
  return (
    <div className="props foreign-props">
      <div className="panel-head">
        <h2 className="panel-title">{name.title}</h2>
      </div>
      <p className="hint">
        {name.type} · from {modeLabel(target)}
      </p>
      <div className="foreign-props__actions">
        <button className="btn btn--primary" onClick={() => editIn(sel)}>
          Edit in {modeLabel(target)}
        </button>
        {sel.domain === 'stage' ? (
          <button className="btn" onClick={() => useShell.getState().setNewProject(true, true)}>
            Change stage type…
          </button>
        ) : (
          <>
            {items.length === 1 && caps.hide && (
              <button className="btn" onClick={() => toggleHidden(first)}>
                {isHidden(first) ? 'Show' : 'Hide'}
              </button>
            )}
            {items.length === 1 && caps.lock && (
              <button className="btn" onClick={() => toggleLocked(first)}>
                {isLocked(first) ? 'Unlock' : 'Lock'}
              </button>
            )}
            <button
              className="btn btn--danger"
              onClick={() => {
                remove(items);
                useForeign.getState().set(null);
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Name and type of a picked item, in plain words. */
function describe(s: ReturnType<typeof useProjectStore.getState>, sel: Pick): { title: string; type: string } {
  const n = sel.ids.length;
  if (sel.domain === 'stage') return { title: `Stage — ${getTemplate(s.templateId)?.name ?? ''}`, type: 'Stage' };
  if (sel.domain === 'set') {
    const list = s.objectsByTemplate[s.templateId] ?? [];
    const o = list.find((x) => x.id === sel.ids[0]);
    return n > 1 ? { title: `${n} set pieces`, type: 'Set pieces' } : { title: o?.name ?? 'Set piece', type: plainText(getObjectType(o?.type ?? '')?.name ?? 'Set piece') };
  }
  if (sel.domain === 'lights') {
    const l = s.lightingByTemplate[s.templateId];
    if (sel.kind === 'position') return { title: plainText(l?.positions.find((p) => p.id === sel.ids[0])?.name ?? 'Light bar'), type: 'Hanging position' };
    const f = l?.fixtures.find((x) => x.id === sel.ids[0]);
    return n > 1 ? { title: `${n} lights`, type: 'Lights' } : { title: f?.name ?? 'Light', type: f ? FIXTURES[f.type].label : 'Light' };
  }
  if (sel.domain === 'performers') {
    const p = s.blockingByTemplate[s.templateId]?.performers.find((x) => x.id === sel.ids[0]);
    return n > 1 ? { title: `${n} performers`, type: 'Performers' } : { title: p?.name ?? 'Performer', type: 'Performer' };
  }
  const v = s.venue;
  const kind = sel.kind;
  const id = sel.ids[0];
  if (kind === 'room') {
    const r = v.rooms.find((x) => x.id === id);
    return { title: r?.name ?? 'Room', type: 'Room' };
  }
  if (kind === 'route') return { title: v.routes.find((x) => x.id === id)?.name ?? 'Route', type: 'Route' };
  if (kind === 'door') return { title: v.doors.find((x) => x.id === id)?.entrance ?? 'Door', type: 'Door' };
  if (kind === 'furniture') return { title: 'Furniture', type: 'Furniture' };
  return { title: kind, type: kind };
}
