import { useState } from 'react';
import { Modal } from '../Modal';
import { useExportState } from '../../export/state';
import { exportAllViews, exportCurrentView, exportName, presentationPdf, turntableVideo } from '../../export/exports';
import { download } from '../../graphics/specSheet';

const SIZES: Record<string, [number, number]> = { hd: [1920, 1080], '4k': [3840, 2160] };

/** Renders and presentation exports. */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [size, setSize] = useState<'hd' | '4k' | 'custom'>('hd');
  const [custom, setCustom] = useState<[number, number]>([2560, 1440]);
  const [labels, setLabels] = useState(false);
  const presentation = useExportState((s) => s.presentation);
  const [busy, setBusy] = useState<string | null>(null);
  const [w, h] = size === 'custom' ? custom : SIZES[size];

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Export images and presentation" onClose={() => !busy && onClose()}>
      <div className="export-form">
        <label className="field">
          <span className="field__label">Image size</span>
          <div className="segmented segmented--wide segmented--3">
            <button className={size === 'hd' ? 'is-active' : ''} onClick={() => setSize('hd')}>1920 × 1080</button>
            <button className={size === '4k' ? 'is-active' : ''} onClick={() => setSize('4k')}>3840 × 2160</button>
            <button className={size === 'custom' ? 'is-active' : ''} onClick={() => setSize('custom')}>Custom</button>
          </div>
        </label>
        {size === 'custom' && (
          <div className="export-custom">
            <input type="number" min={320} max={8192} value={custom[0]} onChange={(e) => setCustom([Math.min(8192, Math.max(320, Number(e.target.value))), custom[1]])} aria-label="Width in pixels" />
            ×
            <input type="number" min={240} max={8192} value={custom[1]} onChange={(e) => setCustom([custom[0], Math.min(8192, Math.max(240, Number(e.target.value)))])} aria-label="Height in pixels" />
            px
          </div>
        )}
        <label className="field field--inline">
          <span className="field__label">Keep dimension labels</span>
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
        </label>
        <label className="field field--inline">
          <span className="field__label">Presentation lighting (softer, warmer)</span>
          <input type="checkbox" checked={presentation} onChange={(e) => useExportState.getState().set({ presentation: e.target.checked })} />
        </label>
        <p className="hint">Handles, grid and selection outlines are always left out.</p>
      </div>
      <div className="export-actions">
        <button className="btn btn--primary" disabled={!!busy} onClick={() => run('view', async () => download(await exportCurrentView(w, h, labels), exportName('view.png')))}>
          {busy === 'view' ? 'Rendering…' : 'Export this view (PNG)'}
        </button>
        <button
          className="btn"
          disabled={!!busy}
          onClick={() =>
            run('all', async () => {
              download(await exportAllViews(w, h, labels, (d, t) => setBusy(`all ${d}/${t}`)), exportName('views.zip'));
            })
          }
        >
          {busy?.startsWith('all') ? `Rendering ${busy.slice(4)}…` : 'Export all views (.zip)'}
        </button>
        <button className="btn" disabled={!!busy} onClick={() => run('pdf', async () => download(await presentationPdf((m) => setBusy(`pdf ${m}`)), exportName('presentation.pdf')))}>
          {busy?.startsWith('pdf') ? busy.slice(4) : 'Presentation sheet (PDF)'}
        </button>
        <button className="btn" disabled={!!busy} onClick={() => run('video', async () => download(await turntableVideo(8), exportName('turntable.webm')))}>
          {busy === 'video' ? 'Recording 8 s…' : 'Turntable video (8 s)'}
        </button>
      </div>
    </Modal>
  );
}
