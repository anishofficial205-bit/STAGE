import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useShell } from './shell';
import { STARTER_SCENES, loadStarterScene } from '../starters/scenes';
import { deleteProject, deleteProjects, duplicateProject, recordCurrentProject, recordWithPicture, refreshRecent, renameProject, useRecentProjects, type ProjectRecord } from '../projects/library';
import { setDefaultUnits, useProjectStore } from '../store/useProjectStore';
import { importZip } from '../graphics/library';
import { getTemplate } from '../templates/registry';
import { useThumbnails } from './Thumbnails';
import { lookup } from '../glossary/terms';
import { Modal } from './Modal';
import { useDismiss } from './useDismiss';
import { ModeIcon } from './ModeBar';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './theme';
import type { Units } from '../units';

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'edited just now';
  if (m < 60) return `edited ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `edited ${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `edited ${d} day${d === 1 ? '' : 's'} ago` : `edited ${new Date(t).toLocaleDateString()}`;
};

/** The stage type of a saved project, in plain words. */
function stageOf(p: ProjectRecord) {
  const id = (p.file as { templateId?: string })?.templateId;
  const t = id ? getTemplate(id) : undefined;
  return { id, name: t ? (lookup(t.name)?.plain ?? t.name) : 'Stage' };
}

/** Picture of a project, or its stage type when there's no picture yet — never a blank box. */
function ProjectPicture({ p }: { p: ProjectRecord }) {
  const images = useThumbnails((s) => s.images);
  const stage = stageOf(p);
  if (p.thumbnail) return <img src={p.thumbnail} alt="" />;
  const img = stage.id ? images[stage.id] : undefined;
  return (
    <span className="home__placeholder">
      {img ? <img src={img} alt="" /> : <ModeIcon mode="set" size={30} />}
      <span>{stage.name}</span>
    </span>
  );
}

interface Picking {
  on: boolean;
  picked: boolean;
  toggle: () => void;
}

function ProjectCard({ p, onOpen, badge, pick }: { p: ProjectRecord; onOpen: () => void; badge?: string; pick?: Picking }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState(p.name);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(menu, () => setMenu(false), ref);
  const commitName = () => {
    setRenaming(false);
    if (name.trim() && name.trim() !== p.name) void renameProject(p.id, name.trim());
    else setName(p.name);
  };
  return (
    <div className={`hm-card${pick?.picked ? ' is-picked' : ''}`} ref={ref}>
      <button
        className="hm-card__open"
        onClick={pick?.on ? pick.toggle : onOpen}
        title={pick?.on ? `Select “${p.name}”` : `Open “${p.name}”`}
        aria-pressed={pick?.on ? pick.picked : undefined}
      >
        <span className="hm-card__pic">
          <ProjectPicture p={p} />
          {badge && !pick?.on && <span className="hm-card__badge">{badge}</span>}
          {pick?.on && <span className="hm-card__check" aria-hidden>{pick.picked ? '✓' : ''}</span>}
        </span>
      </button>
      {!pick?.on && (
        <button className="hm-card__delete" onClick={() => setConfirm(true)} aria-label={`Delete “${p.name}”`} title="Delete">
          <Icon d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
        </button>
      )}
      <div className="hm-card__meta">
        {renaming ? (
          <input
            className="field__input"
            autoFocus
            onFocus={(e) => e.target.select()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') (setName(p.name), setRenaming(false));
            }}
            aria-label="Project name"
          />
        ) : (
          <b className="hm-card__name">{p.name}</b>
        )}
        <small>
          {stageOf(p).name} · {ago(p.savedAt).replace(/^edited /, '')}
        </small>
      </div>
      {!pick?.on && (
        <button className="hm-card__more" onClick={() => setMenu(!menu)} aria-label={`More for “${p.name}”`} aria-expanded={menu}>
          ⋯
        </button>
      )}
      {menu && (
        <span className="menu__list hm-card__menu" role="menu">
          <button role="menuitem" onClick={() => (setMenu(false), onOpen())}>
            Open
          </button>
          <button role="menuitem" onClick={() => (setMenu(false), setRenaming(true))}>
            Rename
          </button>
          <button role="menuitem" onClick={() => (setMenu(false), void duplicateProject(p.id))}>
            Duplicate
          </button>
          <button role="menuitem" className="is-danger" onClick={() => (setMenu(false), setConfirm(true))}>
            Delete…
          </button>
        </span>
      )}
      {confirm && (
        <Modal title={`Delete “${p.name}”?`} onClose={() => setConfirm(false)}>
          <p className="modal__text">It will be removed from this browser. If you might want it later, open it and use Share → Download project first.</p>
          <div className="modal__actions">
            <button className="btn" onClick={() => setConfirm(false)} autoFocus>
              Cancel
            </button>
            <button className="btn btn--danger" onClick={() => (setConfirm(false), void deleteProject(p.id))}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** What a saved project holds, for the “Jump back in” card. */
function contents(p: ProjectRecord) {
  const f = p.file as {
    templateId?: string;
    objectsByTemplate?: Record<string, { type: string }[]>;
    lightingByTemplate?: Record<string, { fixtures?: unknown[] }>;
    blockingByTemplate?: Record<string, { performers?: unknown[] }>;
  };
  const t = f?.templateId ?? '';
  const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;
  return [
    n((f?.objectsByTemplate?.[t] ?? []).filter((o) => o.type !== '@group').length, 'set piece', 'set pieces'),
    n(f?.lightingByTemplate?.[t]?.fixtures?.length ?? 0, 'light', 'lights'),
    n(f?.blockingByTemplate?.[t]?.performers?.length ?? 0, 'performer', 'performers'),
  ];
}

/** Stage types to start from, each drawn as a little plan. */
const TYPES: { id: string; name: string; sub: string; plan: ReactNode }[] = [
  {
    id: 'proscenium',
    name: 'Framed',
    sub: 'Proscenium',
    plan: (
      <>
        <path d="M12 8h56v24H12z" className="hm-plan__stage" />
        <path d="M6 4h68M6 4v28M74 4v28" className="hm-plan__frame" />
        <path d="M14 42q26 6 52 0M18 50q22 5 44 0" className="hm-plan__seats" />
      </>
    ),
  },
  {
    id: 'thrust',
    name: 'Thrust',
    sub: 'Audience on 3 sides',
    plan: (
      <>
        <path d="M14 4h52v16H52v20H28V20H14z" className="hm-plan__stage" />
        <path d="M8 24v20M72 24v20M18 48h44" className="hm-plan__seats" />
      </>
    ),
  },
  {
    id: 'in-the-round',
    name: 'In the round',
    sub: 'Audience all round',
    plan: (
      <>
        <circle cx="40" cy="27" r="13" className="hm-plan__stage" />
        <circle cx="40" cy="27" r="22" className="hm-plan__seats" strokeDasharray="4 4" />
      </>
    ),
  },
  {
    id: 'end-stage',
    name: 'End stage',
    sub: 'Events and talks',
    plan: (
      <>
        <path d="M10 6h60v20H10z" className="hm-plan__stage" />
        <path d="M14 34h52M14 41h52M14 48h52" className="hm-plan__seats" />
      </>
    ),
  },
  {
    id: 'traverse',
    name: 'Runway',
    sub: 'Audience both sides',
    plan: (
      <>
        <path d="M32 4h16v46H32z" className="hm-plan__stage" />
        <path d="M22 10v38M58 10v38M14 10v38M66 10v38" className="hm-plan__seats" />
      </>
    ),
  },
  {
    id: 'custom',
    name: 'Your own shape',
    sub: 'Draw it',
    plan: (
      <>
        <path d="M14 40l10-28 30 6 12 22z" className="hm-plan__draw" />
        <path d="M50 30l12-12 4 4-12 12h-4z" className="hm-plan__pen" />
      </>
    ),
  },
];

type View = 'home' | 'projects' | 'templates';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

/** Home: a sidebar to move around, the last project to jump back into, recent work and new stages. */
export function Home() {
  const home = useShell((s) => s.home);
  const setHome = useShell((s) => s.setHome);
  const recent = useRecentProjects((s) => s.list);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>('home');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmMany, setConfirmMany] = useState(false);
  const stopPicking = () => (setPicking(false), setPicked([]));
  const file = useRef<HTMLInputElement>(null);
  const currentId = useProjectStore((s) => s.projectId);
  const units = useProjectStore((s) => s.units);
  const theme = useTheme((s) => s.theme);

  useEffect(() => {
    if (!home) return;
    // Coming back always lands on Home itself.
    setView('home');
    setPicking(false);
    setPicked([]);
    setQ('');
    // The open project goes in the list too (so "Jump back in" can offer it), then refresh.
    void recordCurrentProject().then(refreshRecent);
  }, [home]);

  const query = q.trim().toLowerCase();
  const projects = useMemo(() => {
    const list = recent.filter((p) => !query || p.name.toLowerCase().includes(query));
    const sorted = sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
    // The project that was open last comes first.
    const cur = sorted.find((p) => p.id === currentId);
    return cur && sort === 'recent' ? [cur, ...sorted.filter((p) => p !== cur)] : sorted;
  }, [recent, query, sort, currentId]);
  const templates = STARTER_SCENES.filter((s) => s.id !== 'scratch' && (!query || `${s.title} ${s.blurb}`.toLowerCase().includes(query)));

  if (!home) return null;

  const start = async (id: string) => {
    await loadStarterScene(id);
    setHome(false);
    window.setTimeout(() => void recordWithPicture(), 2500);
  };
  const reopen = (p: ProjectRecord) => {
    if (p.id !== currentId) {
      const store = useProjectStore.getState();
      store.loadFile(p.file);
      store.save();
    }
    setHome(false);
  };
  const openFile = async (f: File) => {
    try {
      await importZip(f);
      useProjectStore.getState().save();
      setHome(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };
  const setUnits = (u: Units) => {
    setDefaultUnits(u);
    useProjectStore.getState().setUnits(u);
  };
  const newProject = (pick?: string) => useShell.getState().setNewProject(true, false, pick ?? null);

  const last = !query && sort === 'recent' ? projects[0] : undefined;
  const others = last ? projects.slice(1) : projects;

  return (
    <div className="hm" role="dialog" aria-modal="true" aria-label="Home">
      <aside className="hm-side">
        <div className="hm-brand">
          <span className="hm-logo" aria-hidden>
            <span />
          </span>
          Stage Builder
        </div>
        <button className="hm-new" onClick={() => newProject()} data-tip-anchor="new-project">
          <Icon d="M12 5v14M5 12h14" />
          New project
        </button>
        <nav className="hm-nav" aria-label="Sections">
          <button className={view === 'home' ? 'is-on' : ''} onClick={() => setView('home')}>
            <Icon d="M3 11l9-7 9 7v9H3z" />
            Home
          </button>
          <button className={view === 'projects' ? 'is-on' : ''} onClick={() => setView('projects')}>
            <Icon d="M3 4h7v7H3zM14 4h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
            My projects<span className="hm-nav__n">{recent.length || ''}</span>
          </button>
          <button className={view === 'templates' ? 'is-on' : ''} onClick={() => setView('templates')}>
            <Icon d="M4 5h16v14H4zM4 9h16" />
            Templates<span className="hm-nav__n">{STARTER_SCENES.length - 1}</span>
          </button>
          <button onClick={() => file.current?.click()}>
            <Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            Open a file
          </button>
        </nav>
        <input
          ref={file}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void openFile(f);
            e.target.value = '';
          }}
        />
        <div className="hm-side__foot">
          <span className="hm-side__row">
            <span className="hm-side__label">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
            <ThemeToggle />
          </span>
          <span className="hm-side__label">Measure in</span>
          <span className="segmented hm-units" role="group" aria-label="Units">
            <button className={units === 'm' ? 'is-active' : ''} onClick={() => setUnits('m')}>
              Metres
            </button>
            <button className={units === 'ft' ? 'is-active' : ''} onClick={() => setUnits('ft')}>
              Feet
            </button>
          </span>
        </div>
      </aside>

      <main className="hm-main">
        <div className="hm-top">
          <div>
            <h1 className="hm-title">{view === 'projects' ? 'My projects' : view === 'templates' ? 'Templates' : greeting()}</h1>
            <p className="hm-lead">{view === 'projects' ? 'Everything saved in this browser.' : view === 'templates' ? 'Finished examples to start from.' : 'Pick up where you left off, or start something new.'}</p>
          </div>
          <label className="hm-search">
            <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
            <input type="search" placeholder="Search projects and templates" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects and templates" />
          </label>
        </div>
        {error && <p className="panel-msg panel-msg--warning">{error}</p>}

        {view === 'home' && (
          <>
            {last ? (
              <section className="hm-jump">
                <button className="hm-jump__pic" onClick={() => reopen(last)} aria-label={`Open “${last.name}”`}>
                  <ProjectPicture p={last} />
                </button>
                <div className="hm-jump__body">
                  <span className="hm-eyebrow">Jump back in</span>
                  <h2 className="hm-jump__name">{last.name}</h2>
                  <p className="hm-jump__meta">
                    {stageOf(last).name} · {ago(last.savedAt)}
                  </p>
                  <div className="hm-jump__counts">
                    {contents(last).map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                  <div className="hm-jump__actions">
                    <button className="hm-btn hm-btn--pri" onClick={() => reopen(last)}>
                      Continue
                    </button>
                    <button className="hm-btn" onClick={() => void duplicateProject(last.id)}>
                      Duplicate
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              !query && (
                <section className="hm-welcome">
                  <div>
                    <span className="hm-eyebrow">Welcome</span>
                    <h2 className="hm-jump__name">Start your first stage</h2>
                    <p className="hm-jump__meta">Choose a stage type below, or open one of the templates.</p>
                  </div>
                  <button className="hm-btn hm-btn--pri" onClick={() => newProject()}>
                    New project
                  </button>
                </section>
              )
            )}

            {others.length > 0 && (
              <section className="hm-section">
                <div className="hm-section__head">
                  <h2>{query ? 'Projects' : 'Recent'}</h2>
                  {!query && others.length > 4 && (
                    <button className="hm-link" onClick={() => setView('projects')}>
                      See all ›
                    </button>
                  )}
                </div>
                <div className="hm-grid hm-grid--4">
                  {(query ? others : others.slice(0, 4)).map((p) => (
                    <ProjectCard key={p.id} p={p} onOpen={() => reopen(p)} />
                  ))}
                </div>
              </section>
            )}

            {query && templates.length > 0 && (
              <section className="hm-section">
                <div className="hm-section__head">
                  <h2>Templates</h2>
                </div>
                <TemplateGrid list={templates} onPick={start} />
              </section>
            )}
            {query && !projects.length && !templates.length && <p className="hm-empty">Nothing called “{q}”.</p>}

            {!query && (
              <section className="hm-section">
                <div className="hm-section__head">
                  <h2>Start a new stage</h2>
                </div>
                <div className="hm-types">
                  {TYPES.map((t) => (
                    <button key={t.id} className={`hm-type ${t.id === 'custom' ? 'is-draw' : ''}`} onClick={() => newProject(t.id)}>
                      <svg viewBox="0 0 80 54" width="80" height="54" className="hm-plan" aria-hidden>
                        {t.plan}
                      </svg>
                      <b>{t.name}</b>
                      <small>{t.sub}</small>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {!query && others.length < 4 && templates.length > 0 && (
              <section className="hm-section">
                <div className="hm-section__head">
                  <h2>Or start from a template</h2>
                  {templates.length > 3 && (
                    <button className="hm-link" onClick={() => setView('templates')}>
                      All {templates.length} ›
                    </button>
                  )}
                </div>
                <TemplateGrid list={templates.slice(0, 3)} onPick={start} />
              </section>
            )}
          </>
        )}

        {view === 'projects' && (
          <section className="hm-section">
            <div className="hm-section__head">
              <h2>
                {projects.length} project{projects.length === 1 ? '' : 's'}
              </h2>
              <div className="hm-section__tools">
                {picking ? (
                  <>
                    <span className="hm-picked">{picked.length ? `${picked.length} selected` : 'Pick projects'}</span>
                    <button className="btn" onClick={() => setPicked(picked.length === projects.length ? [] : projects.map((p) => p.id))}>
                      {picked.length === projects.length ? 'Select none' : 'Select all'}
                    </button>
                    <button className="btn btn--danger" onClick={() => picked.length && setConfirmMany(true)} aria-disabled={!picked.length}>
                      Delete
                    </button>
                    <button className="btn" onClick={stopPicking}>
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    {projects.length > 0 && (
                      <button className="btn" onClick={() => setPicking(true)}>
                        Select
                      </button>
                    )}
                    <select className="field__select hm-sort" value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')} aria-label="Sort projects">
                      <option value="recent">Most recent first</option>
                      <option value="name">By name</option>
                    </select>
                  </>
                )}
              </div>
            </div>
            {projects.length ? (
              <div className="hm-grid hm-grid--4">
                {projects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    p={p}
                    onOpen={() => reopen(p)}
                    badge={p.id === currentId ? 'Last opened' : undefined}
                    pick={{ on: picking, picked: picked.includes(p.id), toggle: () => setPicked((l) => (l.includes(p.id) ? l.filter((x) => x !== p.id) : [...l, p.id])) }}
                  />
                ))}
              </div>
            ) : (
              <p className="hm-empty">{query ? `No projects called “${q}”.` : 'No projects yet. Start one with New project.'}</p>
            )}
          </section>
        )}

        {confirmMany && (
          <Modal title={`Delete ${picked.length} project${picked.length === 1 ? '' : 's'}?`} onClose={() => setConfirmMany(false)}>
            <p className="modal__text">They will be removed from this browser. If you might want one later, open it and use Share → Download project first.</p>
            <div className="modal__actions">
              <button className="btn" onClick={() => setConfirmMany(false)} autoFocus>
                Cancel
              </button>
              <button className="btn btn--danger" onClick={() => (setConfirmMany(false), void deleteProjects(picked), stopPicking())}>
                Delete {picked.length}
              </button>
            </div>
          </Modal>
        )}

        {view === 'templates' && (
          <section className="hm-section">
            {templates.length ? <TemplateGrid list={templates} onPick={start} /> : <p className="hm-empty">No templates called “{q}”.</p>}
          </section>
        )}
      </main>
    </div>
  );
}

function TemplateGrid({ list, onPick }: { list: typeof STARTER_SCENES; onPick: (id: string) => void }) {
  return (
    <div className="hm-grid hm-grid--3">
      {list.map((s) => (
        <button key={s.id} className="hm-tpl" onClick={() => onPick(s.id)}>
          <span className="hm-tpl__pic">
            <img src={s.image} alt="" loading="lazy" />
            <span className="hm-tpl__use">Use this</span>
          </span>
          <b>{s.title}</b>
          <small>{s.blurb}</small>
        </button>
      ))}
    </div>
  );
}
