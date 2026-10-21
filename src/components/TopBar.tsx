import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useViews } from './useViews';
import { TOUR_EVENT } from './Tour';

export function TopBar() {
  const s = useProjectStore();
  const views = useViews();
  const fileInput = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const save = () => {
    s.save();
    flash('Saved');
  };

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        useProjectStore.getState().save();
        flash('Saved');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(s.toFile(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = s.projectName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'stage';
    a.href = url;
    a.download = `${slug}.stage.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      s.loadFile(JSON.parse(await file.text()));
      flash(`Imported “${file.name}” — press Save to keep it`);
    } catch (err) {
      flash(err instanceof Error && !(err instanceof SyntaxError) ? err.message : 'Could not read that file.');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <span className="brand">Stage Builder</span>
        <input
          className="project-name"
          value={s.projectName}
          onChange={(e) => s.setProjectName(e.target.value)}
          aria-label="Project name"
          spellCheck={false}
        />
        <button className="btn btn--icon" onClick={s.undo} disabled={!s.past.length} title="Undo (⌘Z)" aria-label="Undo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
        </button>
        <button className="btn btn--icon" onClick={s.redo} disabled={!s.future.length} title="Redo (⇧⌘Z)" aria-label="Redo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
        </button>
      </div>

      <nav className="topbar__views" aria-label="Camera views" data-tour="views">
        {views.map((v) => (
          <button key={v.id} className={`btn btn--ghost ${v.id === 'reset' ? 'btn--muted' : ''}`} onClick={() => s.requestView(v)}>
            {v.label}
          </button>
        ))}
      </nav>

      <div className="topbar__right">
        <div className="segmented" role="group" aria-label="Units">
          <button className={s.units === 'm' ? 'is-active' : ''} onClick={() => s.setUnits('m')}>
            m
          </button>
          <button className={s.units === 'ft' ? 'is-active' : ''} onClick={() => s.setUnits('ft')}>
            ft
          </button>
        </div>
        <button className={`btn ${s.showLabels ? 'is-active' : ''}`} onClick={s.toggleLabels} title="Show or hide dimension labels">
          Labels
        </button>
        <button className={`btn ${s.snapping ? 'is-active' : ''}`} onClick={s.toggleSnapping} title="Snap objects to the grid, stage edges and each other (hold ⌘/Ctrl while dragging to place freely)">
          Snap
        </button>
        <button className="btn btn--icon" onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))} title="Show the quick tour" aria-label="Help">
          ?
        </button>
        <span className="divider" />
        <button className="btn btn--primary" onClick={save} title="Save (⌘S)">
          {s.dirty ? 'Save •' : 'Save'}
        </button>
        <button className="btn" onClick={exportJson}>
          Export
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
            e.target.value = '';
          }}
        />
      </div>
      {toast && <div className="toast">{toast}</div>}
    </header>
  );
}
