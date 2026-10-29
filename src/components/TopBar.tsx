import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { MODE_TOUR_EVENT, TOUR_EVENT, hasModeTour } from './Tour';
import { resetTips, showTip } from './Tips';
import { exportZip, importZip } from '../graphics/library';
import { PrintCheckDialog } from './graphics/PrintCheck';
import { ExportDialog } from './export/ExportDialog';
import { ModelDialog } from './export/ModelDialog';
import { SHORTCUTS_EVENT } from './ShortcutsSheet';
import { useDismiss } from './useDismiss';
import { useObjectUI } from '../objects/ui';
import { useLabelPrefs } from '../helpers/labels';
import { useLightsUI } from '../lighting/ui';
import { blockingPdf } from '../blocking/sheets';
import { exportName } from '../export/exports';
import { useShell } from './shell';
import { recordWithPicture } from '../projects/library';
import { useActiveBlocking, useActiveLighting } from '../store/useProjectStore';
import { SaveStatus } from './Autosave';
import { SeatsSwitch } from './PropertiesPanel';
import { PdfPreview } from './export/PdfPreview';

export function TopBar() {
  const s = useProjectStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [printCheck, setPrintCheck] = useState(false);
  const [render, setRender] = useState(false);
  const [sheets, setSheets] = useState(false);
  const [model, setModel] = useState(false);
  const [menu, setMenu] = useState<'view' | 'help' | 'file' | null>(null);
  const allDims = useLabelPrefs((l) => l.allDimensions);
  const toggleAllDims = useLabelPrefs((l) => l.toggleAllDimensions);
  const menus = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMenu(null), []);
  useDismiss(menu !== null, close, menus);
  const lightCount = useActiveLighting().fixtures.length;
  const performerCount = useActiveBlocking().performers.length;
  const panels = useShell((x) => x.panels);
  const toggle = (m: 'view' | 'help' | 'file') => {
    useObjectUI.getState().setMenu(null);
    setMenu(menu === m ? null : m);
  };
  // The first time the Export menu opens, a word about what crews get.
  useEffect(() => {
    if (menu === 'file') showTip('export', { selector: '.topbar__share' });
  }, [menu]);

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
      <div className="glass project-chip">
        <button
          className="round"
          onClick={() => {
            void recordWithPicture();
            useShell.getState().setHome(true);
          }}
          title="Home: your projects and new ones"
          aria-label="Back to home"
        >
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <input
          className="project-chip__name"
          value={s.projectName}
          onChange={(e) => s.setProjectName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Project name"
          spellCheck={false}
          size={Math.max(6, Math.min(28, s.projectName.length + 1))}
        />
        <span className={`project-chip__dot ${s.dirty ? 'is-dirty' : ''}`} title={s.dirty ? 'Saving…' : 'Saved in this browser'} aria-label={s.dirty ? 'Saving' : 'Saved'} />
        <SaveStatus />
      </div>

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
          <button className="round glass" onClick={() => toggle('view')} title="Settings: units, labels, snapping, focus mode" aria-label="Settings" aria-expanded={menu === 'view'}>
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
              <SeatsSwitch />
              <span className="menu__row" title="Hide the panels to see the whole stage (F)">
                Focus mode <kbd>F</kbd>
                <button className={`switch ${panels ? '' : 'is-on'}`} role="switch" aria-checked={!panels} onClick={() => useShell.getState().togglePanels()} aria-label="Focus mode">
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
                Take a tour
              </button>
              {hasModeTour(s.mode) && (
                <button role="menuitem" onClick={() => { close(); window.dispatchEvent(new Event(MODE_TOUR_EVENT)); }}>
                  Tour of this mode
                </button>
              )}
              <button role="menuitem" onClick={() => { close(); resetTips(); flash('Tips will show again'); }} title="Show the one-time tips again">
                Reset tips
              </button>
            </span>
          )}
        </span>
        <span className="menu">
          <button className="glass topbar__share" onClick={() => toggle('file')} aria-expanded={menu === 'file'}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12M7 10l5 5 5-5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
            Download
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {menu === 'file' && (
            <span className="menu__list" role="menu">
              <button role="menuitem" onClick={() => { close(); void recordWithPicture(); useShell.getState().setHome(true); }}>
                New project…
              </button>
              <button role="menuitem" onClick={() => { close(); const st = useProjectStore.getState(); st.setMode('set'); st.selectStage(true); }} title="Change the stage's size or type">
                Stage settings
              </button>
              <button role="menuitem" onClick={() => { close(); setRender(true); }} title="Export images, all views, a presentation sheet or a turntable video">
                Render images and video…
              </button>
              <button role="menuitem" onClick={() => { close(); setModel(true); }} title="The stage, seating and set as a 3D model for SketchUp, Blender, Rhino or any program that reads OBJ">
                3D model (SketchUp, Blender, Rhino)…
              </button>
              <button role="menuitem" onClick={() => { close(); setPrintCheck(true); }} title="Check graphics resolution and export the spec sheet">
                Print check…
              </button>
              <button role="menuitem" disabled={!lightCount} onClick={() => { close(); useLightsUI.getState().setPlotOpen(true); }} title={lightCount ? 'The light plot with a hookup list, for the crew' : 'Add some lights first'}>
                Lighting plan…
              </button>
              <button role="menuitem" disabled={!performerCount} onClick={() => { close(); setSheets(true); }} title={performerCount ? 'One page per scene, for the stage manager and cast: preview, then download or print' : 'Add performers in Blocking first'}>
                Blocking sheets…
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
      {model && <ModelDialog onClose={() => setModel(false)} />}
      {sheets && <PdfPreview title="Blocking sheets" make={() => blockingPdf()} fileName={exportName('blocking.pdf')} onClose={() => setSheets(false)} />}
    </header>
  );
}
