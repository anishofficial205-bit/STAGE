import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useViews } from './useViews';
import { TOUR_EVENT } from './Tour';
import { exportZip, importZip } from '../graphics/library';
import { PrintCheckDialog } from './graphics/PrintCheck';
import { ExportDialog } from './export/ExportDialog';

export function TopBar() {
  const s = useProjectStore();
  const views = useViews();
  const fileInput = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [printCheck, setPrintCheck] = useState(false);
  const [render, setRender] = useState(false);

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

  /** Export as a .zip: the project plus every image it uses. */
  const exportZipFile = async () => {
    flash('Preparing export…');
    const blob = await exportZip();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = s.projectName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'stage';
    a.href = url;
    a.download = `${slug}.stage.zip`;
    a.click();
    URL.revokeObjectURL(url);
    flash('Exported');
  };

  /** Import a .zip export (with images) or an older .json export. */
  const importFile = async (file: File) => {
    try {
      if (/\.zip$/i.test(file.name) || file.type.includes('zip')) await importZip(file);
      else s.loadFile(JSON.parse(await file.text()));
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
        {views.map((v) =>
          v.id.startsWith('saved-') ? (
            <span key={v.id} className="saved-view">
              <button className="btn btn--ghost" onClick={() => s.requestView(v)}>
                {v.label}
              </button>
              <button className="saved-view__x" onClick={() => s.deleteView(v.id)} title="Remove this saved view" aria-label={`Remove ${v.label}`}>
                ×
              </button>
            </span>
          ) : (
            <button key={v.id} className={`btn btn--ghost ${v.id === 'reset' ? 'btn--muted' : ''}`} onClick={() => s.requestView(v)}>
              {v.label}
            </button>
          ),
        )}
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
        <button className="btn" onClick={() => setRender(true)} title="Export images, all views, a presentation sheet or a turntable video">
          Render
        </button>
        <button className="btn" onClick={() => setPrintCheck(true)} title="Check graphics resolution and export the spec sheet">
          Print check
        </button>
        <button className="btn" onClick={() => void exportZipFile()} title="Download the project and its images as a .zip">
          Export
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {toast && <div className="toast">{toast}</div>}
      {printCheck && <PrintCheckDialog onClose={() => setPrintCheck(false)} />}
      {render && <ExportDialog onClose={() => setRender(false)} />}
    </header>
  );
}
