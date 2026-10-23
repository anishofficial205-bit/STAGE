import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useViews } from './useViews';
import { TOUR_EVENT } from './Tour';
import { exportZip, importZip } from '../graphics/library';
import { PrintCheckDialog } from './graphics/PrintCheck';
import { ExportDialog } from './export/ExportDialog';
import { SaveStatus } from './Autosave';
import { SHORTCUTS_EVENT } from './ShortcutsSheet';
import { useDismiss } from './useDismiss';
import { useObjectUI } from '../objects/ui';
import { useLabelPrefs } from '../helpers/labels';
import { OPEN_EXPORT_EVENT } from './NextStep';
import { useLightsUI } from '../lighting/ui';
import { blockingPdf } from '../blocking/sheets';
import { download } from '../graphics/specSheet';
import { exportName } from '../export/exports';
import { ProgressTracker } from './ProgressTracker';
import { useShell } from './shell';
import { recordWithPicture } from '../projects/library';
import { useActiveBlocking, useActiveLighting } from '../store/useProjectStore';
import { Plain } from '../glossary/Plain';

export function TopBar() {
  const s = useProjectStore();
  const views = useViews();
  const fileInput = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [printCheck, setPrintCheck] = useState(false);
  const [render, setRender] = useState(false);
  const [menu, setMenu] = useState<'view' | 'help' | 'file' | null>(null);
  const allDims = useLabelPrefs((l) => l.allDimensions);
  const toggleAllDims = useLabelPrefs((l) => l.toggleAllDimensions);
  const menus = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMenu(null), []);
  useDismiss(menu !== null, close, menus);
  const lightCount = useActiveLighting().fixtures.length;
  const performerCount = useActiveBlocking().performers.length;
  useEffect(() => {
    const open = () => setMenu('file');
    window.addEventListener(OPEN_EXPORT_EVENT, open);
    return () => window.removeEventListener(OPEN_EXPORT_EVENT, open);
  }, []);
  const toggle = (m: 'view' | 'help' | 'file') => {
    useObjectUI.getState().setMenu(null);
    setMenu(menu === m ? null : m);
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
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

  const exportSheets = async () => {
    flash('Preparing blocking sheets…');
    download(await blockingPdf(), exportName('blocking.pdf'));
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
      <div className="topbar__title">
        <input
          className="project-name"
          value={s.projectName}
          onChange={(e) => s.setProjectName(e.target.value)}
          aria-label="Project name"
          spellCheck={false}
        />
        <span className="topbar__mode">
          <ProgressTracker />
          <SaveStatus />
        </span>
      </div>

      <nav className="topbar__views glass" aria-label="Camera views" data-tour="views">
        {views.map((v) =>
          v.id.startsWith('saved-') ? (
            <span key={v.id} className="saved-view">
              <button className="pill" onClick={() => s.requestView(v)}>
                <Plain text={v.label} />
              </button>
              <button className="saved-view__x" onClick={() => s.deleteView(v.id)} title="Remove this saved view" aria-label={`Remove ${v.label}`}>
                ×
              </button>
            </span>
          ) : (
            <button key={v.id} className={`pill ${v.id === 'reset' ? 'pill--muted' : ''}`} onClick={() => s.requestView(v)}>
              <Plain text={v.label} />
            </button>
          ),
        )}
      </nav>

      <div className="topbar__right" ref={menus}>
        <span className="glass topbar__group">
          <button className="round" onClick={s.undo} disabled={!s.past.length} title="Undo (⌘Z)" aria-label="Undo">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
          </button>
          <button className="round" onClick={s.redo} disabled={!s.future.length} title="Redo (⇧⌘Z)" aria-label="Redo">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
          </button>
        </span>
        <span className="menu">
          <button className="round glass" onClick={() => toggle('view')} title="Units, labels and snapping" aria-label="View settings" aria-expanded={menu === 'view'}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
          </button>
          {menu === 'view' && (
            <span className="menu__list menu__list--settings" role="menu">
              <span className="menu__row">
                Units
                <span className="segmented" role="group" aria-label="Units">
                  <button className={s.units === 'm' ? 'is-active' : ''} onClick={() => s.setUnits('m')}>
                    m
                  </button>
                  <button className={s.units === 'ft' ? 'is-active' : ''} onClick={() => s.setUnits('ft')}>
                    ft
                  </button>
                </span>
              </span>
              <span className="menu__row" title="Each mode shows only its own labels. Turn this on to see every dimension in every mode.">
                All dimension labels
                <button className={`switch ${allDims ? 'is-on' : ''}`} role="switch" aria-checked={allDims} onClick={toggleAllDims} aria-label="All dimension labels">
                  <span className="switch__knob" />
                </button>
              </span>
              <span className="menu__row" title="Snap objects to the grid, stage edges and each other (hold ⌘/Ctrl while dragging to place freely)">
                Snapping
                <button className={`switch ${s.snapping ? 'is-on' : ''}`} role="switch" aria-checked={s.snapping} onClick={s.toggleSnapping} aria-label="Snapping">
                  <span className="switch__knob" />
                </button>
              </span>
            </span>
          )}
        </span>
        <span className="menu">
          <button className="round glass" onClick={() => toggle('help')} title="Help" aria-label="Help" aria-expanded={menu === 'help'}>
            ?
          </button>
          {menu === 'help' && (
            <span className="menu__list" role="menu">
              <button role="menuitem" onClick={() => { close(); window.dispatchEvent(new Event(SHORTCUTS_EVENT)); }}>
                Keyboard shortcuts <kbd>?</kbd>
              </button>
              <button role="menuitem" onClick={() => { close(); window.dispatchEvent(new Event(TOUR_EVENT)); }}>
                Quick tour
              </button>
            </span>
          )}
        </span>
        <span className="menu">
          <button className="glass topbar__share" onClick={() => toggle('file')} aria-expanded={menu === 'file'}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
            Export
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {menu === 'file' && (
            <span className="menu__list" role="menu">
              <button role="menuitem" onClick={() => { close(); void recordWithPicture(); useShell.getState().setHome(true); }}>
                New project…
              </button>
              <button role="menuitem" onClick={() => { close(); setRender(true); }} title="Export images, all views, a presentation sheet or a turntable video">
                Render images and video…
              </button>
              <button role="menuitem" onClick={() => { close(); setPrintCheck(true); }} title="Check graphics resolution and export the spec sheet">
                Print check…
              </button>
              <button role="menuitem" disabled={!lightCount} onClick={() => { close(); useLightsUI.getState().setPlotOpen(true); }} title={lightCount ? 'The light plot with a hookup list, for the crew' : 'Add some lights first'}>
                Lighting plan…
              </button>
              <button role="menuitem" disabled={!performerCount} onClick={() => { close(); void exportSheets(); }} title={performerCount ? 'One page per scene, for the stage manager and cast' : 'Add performers in Blocking first'}>
                Blocking sheets (PDF)
              </button>
              <button role="menuitem" onClick={() => { close(); void exportZipFile(); }} title="Download the project and its images as a .zip">
                Download project (.zip)
              </button>
              <button role="menuitem" onClick={() => { close(); fileInput.current?.click(); }}>
                Open a project file…
              </button>
            </span>
          )}
        </span>
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
