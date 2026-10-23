import { useEffect, useMemo, useRef, useState } from 'react';
import { useShell } from './shell';
import { STARTER_SCENES, loadStarterScene } from '../starters/scenes';
import { deleteProject, duplicateProject, recordCurrentProject, recordWithPicture, refreshRecent, renameProject, useRecentProjects, type ProjectRecord } from '../projects/library';
import { savedDefaultUnits, setDefaultUnits, useProjectStore } from '../store/useProjectStore';
import { importZip } from '../graphics/library';
import { getTemplate } from '../templates/registry';
import { useThumbnails } from './Thumbnails';
import { lookup } from '../glossary/terms';
import { Modal } from './Modal';
import { useDismiss } from './useDismiss';
import { ModeIcon } from './ModeBar';
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

/** First launch only: one question before anything else. */
function UnitsQuestion({ onDone }: { onDone: () => void }) {
  const pick = (u: Units) => {
    setDefaultUnits(u);
    useProjectStore.getState().setUnits(u);
    onDone();
  };
  return (
    <div className="start__units">
      <h1 className="start__title">Do you measure in feet or metres?</h1>
      <p className="start__lead">We’ll use it for every new project. You can change it any time on this page or in settings.</p>
      <div className="start__unit-buttons">
        <button className="start__unit" onClick={() => pick('ft')} autoFocus>
          <b>Feet</b>
          <span>12 ft 6 in</span>
        </button>
        <button className="start__unit" onClick={() => pick('m')}>
          <b>Metres</b>
          <span>3.80 m</span>
        </button>
      </div>
    </div>
  );
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

function ProjectCard({ p, current, onOpen }: { p: ProjectRecord; current: boolean; onOpen: () => void }) {
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
    <div className={`home__project ${current ? 'is-continue' : ''}`} ref={ref}>
      <button className="home__project-open" onClick={onOpen} title={`Open “${p.name}”`}>
        <span className="home__pic">
          <ProjectPicture p={p} />
        </span>
        {current && <span className="home__continue">Continue where you left off</span>}
      </button>
      <div className="home__project-meta">
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
          <span className="home__project-name">{p.name}</span>
        )}
        <span className="home__project-when">
          {stageOf(p).name} · {ago(p.savedAt)}
        </span>
      </div>
      <button className="home__more" onClick={() => setMenu(!menu)} aria-label={`More for “${p.name}”`} aria-expanded={menu}>
        ⋯
      </button>
      {menu && (
        <span className="menu__list home__menu" role="menu">
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
          <p className="modal__text">It will be removed from this browser. If you might want it later, open it and use Export → Download project first.</p>
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

/** Home: what to build today — new project, recent projects and templates. */
export function StartScreen() {
  const home = useShell((s) => s.home);
  const setHome = useShell((s) => s.setHome);
  const recent = useRecentProjects((s) => s.list);
  const [asking, setAsking] = useState(() => savedDefaultUnits() === null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const file = useRef<HTMLInputElement>(null);
  const currentId = useProjectStore((s) => s.projectId);
  const units = useProjectStore((s) => s.units);

  useEffect(() => {
    if (!home) return;
    // The open project goes in the list too (so "Continue" can offer it), then refresh.
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

  const start = (id: string) => {
    loadStarterScene(id);
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

  return (
    <div className="start home" role="dialog" aria-modal="true" aria-label="Home">
      <div className="start__inner">
        <header className="start__head">
          <span className="rail__logo" aria-hidden>
            <span />
          </span>
          <span className="start__brand">Stage Builder</span>
          {!asking && (
            <span className="home__settings">
              <span className="hint">Units</span>
              <span className="segmented" role="group" aria-label="Units">
                <button className={units === 'm' ? 'is-active' : ''} onClick={() => setUnits('m')}>
                  Metres
                </button>
                <button className={units === 'ft' ? 'is-active' : ''} onClick={() => setUnits('ft')}>
                  Feet
                </button>
              </span>
            </span>
          )}
        </header>
        {asking ? (
          <UnitsQuestion onDone={() => setAsking(false)} />
        ) : (
          <>
            <section className="home__hero">
              <h1 className="start__title">What will you build today?</h1>
              <p className="start__lead">Plan stages, sets, lights and blocking in 3D.</p>
              <label className="home__search">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
                </svg>
                <input type="search" placeholder="Search your projects and templates" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects and templates" />
              </label>
            </section>

            <div className="start__row">
              <h2 className="start__h2">Your projects</h2>
              {all && (
                <select className="field__select" value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')} aria-label="Sort projects">
                  <option value="recent">Most recent</option>
                  <option value="name">Name</option>
                </select>
              )}
              {recent.length > 4 && (
                <button className="btn btn--link" onClick={() => setAll(!all)}>
                  {all ? 'Show fewer' : 'See all'}
                </button>
              )}
              <button className="btn btn--small" onClick={() => file.current?.click()}>
                Open a file…
              </button>
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
            </div>
            {error && <p className="panel-msg panel-msg--warning">{error}</p>}
            <div className={all ? 'home__grid' : 'home__strip'}>
              <button className="home__new" onClick={() => useShell.getState().setNewProject(true)} data-tip-anchor="new-project">
                <span className="home__plus" aria-hidden>
                  +
                </span>
                New project
              </button>
              {(all ? projects : projects.slice(0, 5)).map((p) => (
                <ProjectCard key={p.id} p={p} current={p.id === currentId && sort === 'recent' && !query} onOpen={() => reopen(p)} />
              ))}
            </div>
            {query && projects.length === 0 && <p className="start__empty">No projects called “{q}”.</p>}

            {!all && templates.length > 0 && (
              <>
                <h2 className="start__h2 home__h2">Start from a template</h2>
                <div className="start__cards">
                  {templates.map((s) => (
                    <button key={s.id} className="start__card" onClick={() => start(s.id)}>
                      <span className="start__pic">
                        <img src={s.image} alt="" loading="lazy" />
                      </span>
                      <span className="start__card-title">{s.title}</span>
                      <span className="start__card-blurb">{s.blurb}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
