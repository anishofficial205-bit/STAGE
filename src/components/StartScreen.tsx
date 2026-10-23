import { useEffect, useRef, useState } from 'react';
import { useShell } from './shell';
import { STARTER_SCENES, loadStarterScene } from '../starters/scenes';
import { deleteProject, recordWithPicture, refreshRecent, useRecentProjects, type ProjectRecord } from '../projects/library';
import { savedDefaultUnits, setDefaultUnits, useProjectStore } from '../store/useProjectStore';
import { importZip } from '../graphics/library';
import type { Units } from '../units';

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString();
};

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
      <p className="start__lead">We’ll use it for every new project. You can change it any time in settings.</p>
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

/** "What are you making?": starter scenes, recent projects and opening a file. */
export function StartScreen() {
  const home = useShell((s) => s.home);
  const setHome = useShell((s) => s.setHome);
  const recent = useRecentProjects((s) => s.list);
  const [asking, setAsking] = useState(() => savedDefaultUnits() === null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const currentId = useProjectStore((s) => s.projectId);

  useEffect(() => {
    if (home) void refreshRecent();
  }, [home]);

  if (!home) return null;

  const start = (id: string) => {
    loadStarterScene(id);
    setHome(false);
    // Picture for the recent list once the scene has drawn.
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

  return (
    <div className="start" role="dialog" aria-modal="true" aria-label="Start">
      <div className="start__inner">
        <header className="start__head">
          <span className="rail__logo" aria-hidden>
            <span />
          </span>
          <span className="start__brand">Stage Builder</span>
          {!asking && recent.some((p) => p.id === currentId) && (
            <button className="btn start__back" onClick={() => setHome(false)}>
              Back to “{useProjectStore.getState().projectName}”
            </button>
          )}
        </header>
        {asking ? (
          <UnitsQuestion onDone={() => setAsking(false)} />
        ) : (
          <>
            <h1 className="start__title">What are you making?</h1>
            <p className="start__lead">Pick a ready-made scene to start from. Everything in it can be changed.</p>
            <div className="start__cards">
              {STARTER_SCENES.map((s) => (
                <button key={s.id} className={`start__card ${s.id === 'scratch' ? 'is-scratch' : ''}`} onClick={() => start(s.id)}>
                  <span className="start__pic">
                    <img src={s.image} alt="" loading="lazy" />
                  </span>
                  <span className="start__card-title">{s.title}</span>
                  <span className="start__card-blurb">{s.blurb}</span>
                </button>
              ))}
            </div>

            <div className="start__row">
              <h2 className="start__h2">Recent projects</h2>
              <button className="btn" onClick={() => file.current?.click()}>
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
            {recent.length === 0 ? (
              <p className="start__empty">Projects you work on appear here.</p>
            ) : (
              <div className="start__recent">
                {recent.map((p) => (
                  <div key={p.id} className="start__project">
                    <button className="start__project-open" onClick={() => reopen(p)} title={`Open “${p.name}”`}>
                      <span className="start__pic start__pic--small">{p.thumbnail ? <img src={p.thumbnail} alt="" /> : <span className="start__nopic" />}</span>
                      <span className="start__project-name">{p.name}</span>
                      <span className="start__project-meta">{ago(p.savedAt)}</span>
                    </button>
                    {p.id !== currentId && (
                      <button className="start__project-x" onClick={() => void deleteProject(p.id)} aria-label={`Remove “${p.name}” from this list`} title="Remove from this list">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
