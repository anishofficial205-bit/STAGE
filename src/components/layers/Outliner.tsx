import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useActiveBlocking, useActiveLighting, useActiveObjects, useProjectStore } from '../../store/useProjectStore';
import { getTemplate } from '../../templates/registry';
import { getObjectType } from '../../objects/registry';
import { isGroup, leafIds } from '../../objects/groups';
import { CURTAINS } from '../../objects/curtains/mainCurtain';
import { FIXTURES, type Fixture } from '../../lighting/types';
import { ROOM_TYPES } from '../../venue/types';
import { FURNITURE } from '../../venue/furniture';
import { solveRoute } from '../../venue/routes';
import { useBlockingUI } from '../../blocking/ui';
import { lookup } from '../../glossary/terms';
import { ICONS as LIGHT_ICONS } from '../lights/LightsPanels';
import { ModeIcon } from '../ModeBar';
import { useOffStageIds } from '../../objects/offStage';
import { useTallWarnings } from '../sightlines/useTallWarnings';
import { useItemMenu } from './ItemMenu';
import { DOMAIN_MODE, pick, useSelections, type Domain, type Pick } from './selection';
import { can, isHidden, isLocked, rename, toggleHidden, toggleLocked, type Item } from './ops';
import type { OtherLayers } from '../../modes';
import type { SetObject } from '../../objects/types';

/** One row of the tree. Folders have children; `ids` is what clicking selects. */
interface Node extends Item {
  key: string;
  name: string;
  /** The technical term, shown in grey where it differs from the name. */
  tech?: string;
  /** The name as stored (what renaming edits), when `name` is its plain-words version. */
  raw?: string;
  icon: ReactNode;
  /** What a click selects (a folder selects everything inside). Absent: the row only opens and closes. */
  select?: Pick;
  warning?: string;
  children?: Node[];
  /** Set pieces: their folder, for drag-and-drop. */
  parent?: string;
  /** A heading made by the list itself (e.g. "Floor"), not something the user can rename or delete. */
  virtual?: boolean;
}

const DOMAINS: { id: Domain; label: string }[] = [
  { id: 'set', label: 'Set' },
  { id: 'lights', label: 'Lights' },
  { id: 'performers', label: 'Performers' },
  { id: 'venue', label: 'Backstage & venue' },
];

const Eye = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);
const Lock = ({ on }: { on?: boolean }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d={on ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2'} />
  </svg>
);
const Folder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M3 6h6l2 2h10v11H3z" />
  </svg>
);
const Dot = ({ color }: { color?: string }) => <span className="layer__dot" style={{ background: color }} />;
const Glyph = ({ c }: { c: string }) => <span className="layer__glyph">{c}</span>;

/** Plain name plus the technical term when they differ. */
function words(text: string): { name: string; tech?: string } {
  const t = lookup(text);
  if (t && t.plain !== t.tech) return { name: t.plain, tech: t.tech };
  // Numbered names: "Fresnel 1" → "Soft light 1" · Fresnel 1.
  const m = text.match(/^(.+?)( \d+)$/);
  const base = m && lookup(m[1]);
  return base && base.plain !== base.tech ? { name: `${base.plain}${m![2]}`, tech: text } : { name: text };
}

const setNodes = (objects: SetObject[], offStage: Set<string>, tall: Map<string, string>): Node[] => {
  const ids = new Set(objects.map((o) => o.id));
  const make = (o: SetObject): Node => {
    const group = isGroup(o);
    const type = getObjectType(o.type);
    const own = words(o.name);
    const term = type ? words(type.name) : null;
    const tech = own.tech ?? (term?.tech && !o.name.toLowerCase().includes(term.tech.toLowerCase()) ? term.tech : undefined);
    const leaves = group ? leafIds(o.id, objects) : [o.id];
    const warn = leaves.map((id) => (offStage.has(id) ? 'Partly off the stage' : tall.get(id))).find(Boolean);
    return {
      key: `set:${o.id}`,
      domain: 'set',
      kind: group ? 'folder' : 'object',
      id: o.id,
      name: own.name,
      raw: o.name,
      tech,
      icon: group ? <Folder /> : type?.icon,
      select: { domain: 'set', kind: 'object', ids: leaves },
      warning: warn,
      parent: o.parent && ids.has(o.parent) ? o.parent : undefined,
      children: group ? childrenOf(o.id) : undefined,
    };
  };
  const childrenOf = (parent: string | undefined) =>
    objects
      .filter((o) => (parent ? o.parent === parent : !o.parent || !ids.has(o.parent)))
      .reverse() // newest on top
      .map(make);
  const top = childrenOf(undefined);
  // Curtains & drapes sit in their own heading.
  const curtains = top.filter((n) => n.kind === 'object' && getObjectType(objects.find((o) => o.id === n.id)!.type)?.category === CURTAINS);
  if (!curtains.length) return top;
  const rest = top.filter((n) => !curtains.includes(n));
  return [...rest, { key: 'set:curtains', domain: 'set', kind: 'heading', id: 'curtains', name: CURTAINS, icon: <Folder />, virtual: true, children: curtains, select: { domain: 'set', kind: 'object', ids: curtains.map((c) => c.id) } }];
};

function lightNodes(fixtures: Fixture[], positions: { id: string; name: string; kind: string }[]): Node[] {
  const row = (f: Fixture): Node => ({
    key: `lights:${f.id}`,
    domain: 'lights',
    kind: 'fixture',
    id: f.id,
    ...words(f.name),
    raw: f.name,
    icon: <Glyph c={LIGHT_ICONS[f.type]} />,
    select: { domain: 'lights', kind: 'fixture', ids: [f.id] },
  });
  const posIds = new Set(positions.map((p) => p.id));
  const out: Node[] = positions.map((p) => {
    const w = words(p.name);
    const inside = fixtures.filter((f) => f.mount === p.id);
    return { key: `lights:${p.id}`, domain: 'lights', kind: 'position', id: p.id, name: w.name, tech: w.tech, raw: p.name, icon: <Glyph c="━" />, select: { domain: 'lights', kind: 'position', ids: [p.id] }, children: inside.map(row) };
  });
  const loose = fixtures.filter((f) => !f.mount || !posIds.has(f.mount));
  const heading = (id: string, name: string, list: Fixture[]): Node[] =>
    list.length ? [{ key: `lights:${id}`, domain: 'lights', kind: 'heading', id, name, icon: <Folder />, virtual: true, children: list.map(row), select: { domain: 'lights', kind: 'fixture', ids: list.map((f) => f.id) } }] : [];
  return [
    ...out,
    ...heading('floor', 'Floor', loose.filter((f) => FIXTURES[f.type].mount === 'floor')),
    ...heading('audience', 'In the audience', loose.filter((f) => FIXTURES[f.type].mount === 'audience')),
    ...heading('rig', 'Other rigging', loose.filter((f) => FIXTURES[f.type].mount === 'rig')),
  ];
}

/** The single layers list: Stage, Set, Lights, Performers and Backstage & venue. */
export function Outliner() {
  const mode = useProjectStore((s) => s.mode);
  const templateId = useProjectStore((s) => s.templateId);
  const otherLayers = useProjectStore((s) => s.otherLayers);
  const objects = useActiveObjects();
  const lighting = useActiveLighting();
  const blocking = useActiveBlocking();
  const venue = useProjectStore((s) => s.venue);
  const warnings = useBlockingUI((s) => s.warnings);
  const offStage = useOffStageIds();
  const tallList = useTallWarnings();
  const { own, foreign } = useSelections();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<Domain>>(() => new Set([domainOf(mode)]));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<Node | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Collapsed by default except the current mode's group.
  useEffect(() => setOpen(new Set([domainOf(mode)])), [mode]);

  const tall = useMemo(() => new Map(tallList.map((w) => [w.objectId, `Blocks views from ${w.blocks.join(', ')}`])), [tallList]);
  const tree = useMemo<Record<Domain, Node[]>>(() => {
    const perfWarn = new Map<string, string>();
    for (const w of warnings ?? []) for (const id of w.performerIds) if (!perfWarn.has(id)) perfWarn.set(id, w.text);
    const perfRow = (p: (typeof blocking.performers)[number], inGroup?: string): Node => ({
      key: `performers:${inGroup ?? ''}${p.id}`,
      domain: 'performers',
      kind: 'performer',
      id: p.id,
      name: p.name,
      icon: <Dot color={p.color} />,
      select: { domain: 'performers', kind: 'performer', ids: [p.id] },
      warning: perfWarn.get(p.id),
    });
    const grouped = new Set(blocking.groups.flatMap((g) => g.ids));
    const performers: Node[] = [
      ...blocking.groups.map((g) => ({
        key: `performers:${g.id}`,
        domain: 'performers' as const,
        kind: 'group',
        id: g.id,
        name: g.name,
        icon: <Folder />,
        select: { domain: 'performers' as const, kind: 'performer', ids: g.ids },
        children: blocking.performers.filter((p) => g.ids.includes(p.id)).map((p) => perfRow(p, `${g.id}/`)),
      })),
      ...blocking.performers.filter((p) => !grouped.has(p.id)).map((p) => perfRow(p)),
    ];
    const v = (kind: string, id: string, name: string, icon: ReactNode, extra: Partial<Node> = {}): Node => ({ key: `venue:${id}`, domain: 'venue', kind, id, name, icon, select: { domain: 'venue', kind, ids: [id] }, ...extra });
    const heading = (id: string, name: string, children: Node[]): Node[] => (children.length ? [{ key: `venue:${id}`, domain: 'venue', kind: 'heading', id, name, icon: <Folder />, virtual: true, children }] : []);
    const doorName = (i: number) => `Door ${i + 1}`;
    const venueNodes = [
      ...heading('rooms', 'Rooms', venue.rooms.map((r) => v('room', r.id, r.name, <Dot color={ROOM_TYPES[r.type]?.color} />, { tech: ROOM_TYPES[r.type]?.label !== r.name ? ROOM_TYPES[r.type]?.label : undefined }))),
      ...heading('doors', 'Doors', venue.doors.map((d, i) => v('door', d.id, d.entrance ? `★ ${d.entrance}` : doorName(i), <Glyph c="⊓" />))),
      ...heading('furniture', 'Furniture', venue.furniture.map((f, i) => v('furniture', f.id, FURNITURE.find((t) => t.id === f.type)?.label ?? `Furniture ${i + 1}`, <Glyph c="▭" />))),
      ...heading(
        'routes',
        'Routes',
        venue.routes.map((r) => v('route', r.id, r.name, <Glyph c="↝" />, { warning: solveRoute(venue, r).audience.length ? 'Passes through an audience area' : undefined })),
      ),
    ];
    return { stage: [], set: setNodes(objects, offStage, tall), lights: lightNodes(lighting.fixtures, lighting.positions), performers, venue: venueNodes };
  }, [objects, offStage, tall, lighting, blocking, venue, warnings]);

  // What's selected, as row keys (own selection, or the one picked from another mode).
  const sel = foreign ?? own;
  const isSel = (n: Node) => !!sel && !!n.select && sel.domain === n.domain && sel.kind === n.select.kind && n.select.ids.length > 0 && n.select.ids.every((id) => sel.ids.includes(id)) && (n.kind !== 'heading' || n.select.ids.length === sel.ids.length);
  const contains = (n: Node): boolean => !!sel && (n.children ?? []).some((c) => isSel(c) || contains(c));

  // Selecting in the view opens its group and scrolls its row into view.
  const selKey = sel ? `${sel.domain}:${sel.kind}:${sel.ids.join()}` : '';
  useEffect(() => {
    if (!sel) return;
    setOpen((o) => (o.has(sel.domain) ? o : new Set([...o, sel.domain])));
    const walk = (list: Node[], out: string[]) => list.forEach((n) => (contains(n) && out.push(n.key), walk(n.children ?? [], out)));
    const keys: string[] = [];
    walk(tree[sel.domain] ?? [], keys);
    if (keys.some((k) => collapsed.has(k))) setCollapsed((c) => new Set([...c].filter((k) => !keys.includes(k))));
    requestAnimationFrame(() => listRef.current?.querySelector('.layer.is-selected')?.scrollIntoView({ block: 'nearest' }));
  }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = q.trim().toLowerCase();
  const matches = (n: Node): boolean => !query || `${n.name} ${n.tech ?? ''} ${n.raw ?? ''}`.toLowerCase().includes(query) || (n.children ?? []).some(matches);

  const onDrop = (target: Node) => {
    const d = drag;
    setDrag(null);
    if (!d || d === target || d.domain !== target.domain) return;
    if (d.domain === 'set' && !target.virtual) {
      const store = useProjectStore.getState();
      const list = store.objectsByTemplate[store.templateId] ?? [];
      store.updateObjects((cur) => {
        const item = cur.find((o) => o.id === d.id);
        if (!item) return cur;
        // Onto a folder: move into it. Onto a piece: next to it, in its folder.
        if (target.kind === 'folder' && !leafIds(d.id, list).includes(target.id) && d.id !== target.id && item.parent !== target.id) return cur.map((o) => (o.id === d.id ? { ...o, parent: target.id } : o));
        const rest = cur.filter((o) => o.id !== d.id);
        const at = rest.findIndex((o) => o.id === target.id);
        if (at < 0) return cur;
        rest.splice(at + 1, 0, { ...item, parent: target.parent });
        return rest;
      });
    } else if (d.kind === 'performer' && target.domain === 'performers' && target.kind === 'group') {
      useProjectStore.getState().setBlocking((b) => ({ ...b, groups: b.groups.map((g) => (g.id === target.id && !g.ids.includes(d.id) ? { ...g, ids: [...g.ids, d.id] } : g)) }));
    }
  };

  const row = (n: Node, depth: number): ReactNode => {
    if (!matches(n)) return null;
    const folder = !!n.children;
    const isOpen = folder && (!!query || !collapsed.has(n.key));
    const selected = isSel(n);
    const caps = n.virtual ? null : can(n);
    const hidden = caps?.hide && isHidden(n);
    const locked = caps?.lock && isLocked(n);
    const draggable = !n.virtual && editing !== n.key && (n.domain === 'set' || n.kind === 'performer');
    return (
      <li key={n.key}>
        <div
          className={`layer ${selected ? 'is-selected' : ''} ${hidden ? 'is-hidden' : ''} ${drag === n ? 'is-dragging' : ''} ${DOMAIN_MODE[n.domain] !== mode ? 'is-foreign' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          role="treeitem"
          aria-selected={selected}
          aria-expanded={folder ? isOpen : undefined}
          data-layer={n.key}
          draggable={draggable}
          onDragStart={(e) => {
            setDrag(n);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => drag && drag.domain === n.domain && e.preventDefault()}
          onDrop={() => onDrop(n)}
          onDragEnd={() => setDrag(null)}
          onClick={(e) => n.select && pick(n.select, e.shiftKey || e.metaKey || e.ctrlKey)}
          onDoubleClick={() => caps?.rename && setEditing(n.key)}
          onContextMenu={(e) => {
            if (n.virtual) return;
            e.preventDefault();
            openMenu(n, e.clientX, e.clientY);
          }}
        >
          {folder ? (
            <button
              className={`layer__chevron ${isOpen ? 'is-open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                const next = new Set(collapsed);
                if (isOpen) next.add(n.key);
                else next.delete(n.key);
                setCollapsed(next);
              }}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
            >
              ▸
            </button>
          ) : (
            <span className="layer__chevron-space" />
          )}
          <span className="layer__icon">{n.icon}</span>
          {editing === n.key ? (
            <input
              className="layer__input"
              autoFocus
              defaultValue={n.raw ?? n.name.replace(/^★ /, '')}
              onFocus={(e) => e.target.select()}
              onBlur={(e) => {
                rename(n, e.target.value);
                setEditing(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditing(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="layer__name">
              {n.name}
              {n.tech && <span className="layer__tech"> {n.tech}</span>}
              {folder && <span className="layer__tech"> · {countLeaves(n)}</span>}
            </span>
          )}
          {n.warning && (
            <span className="layer__warn" title={n.warning} aria-label={n.warning}>
              !
            </span>
          )}
          {caps?.hide && (
            <button
              className={`layer__btn ${hidden ? 'is-on' : ''}`}
              title={hidden ? 'Show' : 'Hide'}
              aria-label={hidden ? `Show ${n.name}` : `Hide ${n.name}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleHidden(n);
              }}
            >
              <Eye off={hidden} />
            </button>
          )}
          {caps?.lock && (
            <button
              className={`layer__btn ${locked ? 'is-on' : ''}`}
              title={locked ? 'Unlock' : 'Lock (can’t be moved in the view)'}
              aria-label={locked ? `Unlock ${n.name}` : `Lock ${n.name}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleLocked(n);
              }}
            >
              <Lock on={locked} />
            </button>
          )}
          {!n.virtual && (
            <button
              className="layer__btn layer__more"
              title="More"
              aria-label={`More for ${n.name}`}
              onClick={(e) => {
                e.stopPropagation();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                openMenu(n, r.right, r.bottom);
              }}
            >
              ⋯
            </button>
          )}
        </div>
        {folder && isOpen && <ul className="layers__children">{n.children!.map((c) => row(c, depth + 1))}</ul>}
      </li>
    );
  };

  const openMenu = (n: Node, x: number, y: number) =>
    useItemMenu.getState().open({ item: n, pick: n.select ?? { domain: n.domain, kind: n.kind, ids: [n.id] }, x, y, onRename: () => setEditing(n.key) });

  const template = getTemplate(templateId);
  const stageNode: Node = { key: 'stage', domain: 'stage', kind: 'stage', id: 'stage', name: `Stage — ${template?.name ?? 'Stage'}`, icon: <StageIcon />, select: { domain: 'stage', kind: 'stage', ids: ['stage'] } };
  const counts: Record<Domain, number> = { stage: 1, set: objects.filter((o) => !isGroup(o)).length, lights: lighting.fixtures.length, performers: blocking.performers.length, venue: venue.rooms.length + venue.doors.length + venue.furniture.length + venue.routes.length };

  return (
    <div className="outliner" ref={listRef}>
      <div className="outliner__head">
        <h2 className="outliner__title">Layers</h2>
        <OtherLayersToggle value={otherLayers} />
      </div>
      <input className="field__input outliner__search" type="search" placeholder="Filter layers" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter layers" />
      <ul className="layers outliner__tree" role="tree" aria-multiselectable>
        {matches(stageNode) && row(stageNode, 0)}
        {DOMAINS.map((d) => {
          const nodes = tree[d.id].filter(matches);
          if (query && !nodes.length) return null;
          const isOpen = !!query || open.has(d.id);
          return (
            <li key={d.id} className="outliner__domain">
              <button
                className={`outliner__domain-head ${DOMAIN_MODE[d.id] === mode ? 'is-current' : ''}`}
                onClick={() => setOpen((o) => (o.has(d.id) ? new Set([...o].filter((x) => x !== d.id)) : new Set([...o, d.id])))}
                aria-expanded={isOpen}
              >
                <span className={`layer__chevron ${isOpen ? 'is-open' : ''}`}>▸</span>
                <ModeIcon mode={DOMAIN_MODE[d.id]} size={15} />
                <span className="outliner__domain-name">{d.label}</span>
                <span className="outliner__count">{counts[d.id] || ''}</span>
              </button>
              {isOpen && (nodes.length ? <ul className="layers__children">{nodes.map((n) => row(n, 1))}</ul> : <p className="hint outliner__empty">{EMPTY[d.id]}</p>)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const EMPTY: Record<Domain, string> = {
  stage: '',
  set: 'No set pieces yet.',
  lights: 'No lights yet.',
  performers: 'No performers yet.',
  venue: 'Nothing drawn yet.',
};

const domainOf = (mode: string): Domain => (mode === 'lights' ? 'lights' : mode === 'blocking' ? 'performers' : mode === 'venue' ? 'venue' : 'set');
const countLeaves = (n: Node): number => (n.children ? n.children.reduce((t, c) => t + countLeaves(c), 0) : 1);

const StageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M3 15l9-5 9 5-9 5z" />
  </svg>
);

const LAYER_LABEL: Record<OtherLayers, string> = { show: 'Other modes: shown', dim: 'Other modes: dimmed', hide: 'Other modes: hidden' };
const NEXT: Record<OtherLayers, OtherLayers> = { show: 'dim', dim: 'hide', hide: 'show' };

/** Show, dim or hide things from other modes in the 3D view. */
function OtherLayersToggle({ value }: { value: OtherLayers }) {
  return (
    <button className={`icon-btn outliner__others is-${value}`} onClick={() => useProjectStore.getState().setOtherLayers(NEXT[value])} title={`${LAYER_LABEL[value]} — click to change`} aria-label={LAYER_LABEL[value]}>
      <Eye off={value === 'hide'} />
      <span>{value === 'show' ? 'Others' : value === 'dim' ? 'Dimmed' : 'Hidden'}</span>
    </button>
  );
}
