import { useRef } from 'react';
import { Field } from '../fields';
import { useProjectStore } from '../../store/useProjectStore';
import { ACCEPT, assignGraphic, importOnto, removeFaceGraphic, updatePlacement, useGraphicUrl } from '../../graphics/library';
import { useObjectUI, type FaceRef } from '../../objects/ui';
import type { FitMode, GraphicPlacement } from '../../graphics/types';

const FITS: { id: FitMode; label: string; title: string }[] = [
  { id: 'fit', label: 'Fit', title: 'Whole image visible; empty space shows the background colour' },
  { id: 'fill', label: 'Fill', title: 'Covers the face; edges may be cropped — drag to reposition' },
  { id: 'stretch', label: 'Stretch', title: 'Stretched to the face (may distort)' },
  { id: 'tile', label: 'Tile', title: 'Repeats at a real-world tile size' },
];

/** The graphic section of a face's editor. */
export function GraphicControls({ target, graphic }: { target: FaceRef; graphic?: GraphicPlacement }) {
  const units = useProjectStore((s) => s.units);
  const meta = useProjectStore((s) => (graphic ? s.graphics[graphic.id] : undefined));
  const library = useProjectStore((s) => s.graphics);
  const url = useGraphicUrl(graphic?.id ?? '');
  const repositioning = useObjectUI((s) => s.repositioning);
  const fileInput = useRef<HTMLInputElement>(null);
  const k = (name: string) => `graphic:${target.objectId}:${target.face}:${name}`;
  const set = (change: Partial<GraphicPlacement>, name?: string) => updatePlacement(target, change, name && k(name));

  const picker = (
    <input
      ref={fileInput}
      type="file"
      accept={ACCEPT}
      hidden
      onChange={(e) => {
        void importOnto(target, [...(e.target.files ?? [])]);
        e.target.value = '';
      }}
    />
  );

  if (!graphic) {
    const existing = Object.values(library);
    return (
      <div className="graphic-controls">
        <h4 className="subhead">Graphic</h4>
        <div className="btn-row">
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Add graphic…
          </button>
          {existing.length > 0 && (
            <select className="field__select" value="" onChange={(e) => e.target.value && assignGraphic(target, e.target.value)} aria-label="Use a graphic from the library">
              <option value="">From library…</option>
              {existing.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="hint">Or drag an image file onto the face in the view.</p>
        {picker}
      </div>
    );
  }

  return (
    <div className="graphic-controls">
      <h4 className="subhead">Graphic</h4>
      <div className="graphic-current">
        <span className="graphic__thumb">{url && <img src={url} alt="" />}</span>
        <span className="graphic__info">
          <span className="graphic__name">{meta?.name ?? 'Missing graphic'}</span>
          <span className="graphic__meta">{meta ? (meta.vector ? 'Vector' : `${meta.width} × ${meta.height} px`) : 'The file is not in this browser'}</span>
        </span>
      </div>
      <div className="segmented segmented--wide" role="group" aria-label="Fit">
        {FITS.map((f) => (
          <button key={f.id} className={graphic.fit === f.id ? 'is-active' : ''} title={f.title} onClick={() => set({ fit: f.id })}>
            {f.label}
          </button>
        ))}
      </div>
      {graphic.fit === 'tile' && (
        <Field def={{ key: 'tileSize', label: 'Tile width', group: '', type: 'number', default: 0.5, min: 0.05, max: 20, step: 0.05 }} value={graphic.tileSize} units={units} onChange={(v) => set({ tileSize: v as number }, 'tile')} />
      )}
      {graphic.fit === 'fill' && (
        <Field def={{ key: 'scale', label: 'Zoom', group: '', type: 'number', unit: 'none', default: 1, min: 1, max: 8, step: 0.05 }} value={graphic.scale} units={units} onChange={(v) => set({ scale: v as number }, 'scale')} />
      )}
      {(graphic.fit === 'fill' || graphic.fit === 'tile') && (
        <>
          <div className="field-pair">
            <Field def={{ key: 'ox', label: 'Pan across', group: '', type: 'number', unit: 'none', default: 0, min: graphic.fit === 'fill' ? -0.5 : -10, max: graphic.fit === 'fill' ? 0.5 : 10, step: 0.01 }} value={graphic.offsetX} units={units} onChange={(v) => set({ offsetX: v as number }, 'ox')} />
            <Field def={{ key: 'oy', label: 'Pan up/down', group: '', type: 'number', unit: 'none', default: 0, min: graphic.fit === 'fill' ? -0.5 : -10, max: graphic.fit === 'fill' ? 0.5 : 10, step: 0.01 }} value={graphic.offsetY} units={units} onChange={(v) => set({ offsetY: v as number }, 'oy')} />
          </div>
          <button className={`btn ${repositioning ? 'is-active' : ''}`} onClick={() => useObjectUI.getState().setRepositioning(!repositioning)} title="While on, drag on this face in the view to move the image">
            {repositioning ? 'Done repositioning' : 'Drag to reposition in the view'}
          </button>
        </>
      )}
      {graphic.fit === 'fit' && (
        <label className="field field--inline">
          <span className="field__label">Background colour</span>
          <input type="color" value={graphic.background} onChange={(e) => set({ background: e.target.value }, 'bg')} />
        </label>
      )}
      <div className="btn-row">
        <button className="btn" onClick={() => set({ rotation: (graphic.rotation + 1) % 4 })} title="Rotate 90° clockwise">
          ⟳ 90°
        </button>
        <button className={`btn ${graphic.flipH ? 'is-active' : ''}`} onClick={() => set({ flipH: !graphic.flipH })}>
          Flip ↔
        </button>
        <button className={`btn ${graphic.flipV ? 'is-active' : ''}`} onClick={() => set({ flipV: !graphic.flipV })}>
          Flip ↕
        </button>
      </div>
      <Field def={{ key: 'opacity', label: 'Opacity', group: '', type: 'number', unit: 'none', default: 1, min: 0, max: 1, step: 0.05 }} value={graphic.opacity} units={units} onChange={(v) => set({ opacity: v as number }, 'opacity')} />
      <div className="btn-row">
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Replace on this face…
        </button>
        <button className="btn btn--danger" onClick={() => removeFaceGraphic(target)}>
          Remove graphic
        </button>
      </div>
      {picker}
    </div>
  );
}
