import type { ReactNode } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { getObjectType } from '../../objects/registry';
import { ALL_FACES } from '../../objects/faceMaterial';
import { SURFACE, useObjectUI } from '../../objects/ui';
import { getTemplate } from '../../templates/registry';
import type { FaceStyle } from '../../objects/materials';
import type { SetObject } from '../../objects/types';
import { Collapsible } from '../Collapsible';
import { StyleEditor, Swatch } from './StyleEditor';
import { GraphicControls } from '../graphics/GraphicControls';
import { assignGraphic, importOnto } from '../../graphics/library';
import { FLOOR_DECAL, GRAPHIC_DRAG_TYPE } from '../../objects/ui';
import { addObjectAt } from '../../objects/actions';
import { TILE, Tile, TileIcon } from '../ActionTile';

interface Row {
  id: string;
  name: string;
  size?: string;
}

/**
 * List of faces (or surfaces) with a colour swatch each. Hover highlights the
 * face in the view; click opens the editor. `target` is an object id or SURFACE.
 */
function FaceList({ target, rows, styles, setStyle, allFaces, children }: { children?: ReactNode;  target: string; rows: Row[]; styles: Record<string, FaceStyle>; setStyle: (face: string, s: FaceStyle | null, key?: string) => void; allFaces?: boolean }) {
  const { setHoverFace, setSelectedFace } = useObjectUI.getState();
  const selected = useObjectUI((s) => (s.selectedFace?.objectId === target ? s.selectedFace.face : null));
  const list: Row[] = allFaces ? [{ id: ALL_FACES, name: 'All faces' }, ...rows] : rows;
  const current = list.find((r) => r.id === selected);
  return (
    <>
    <div className="action-tiles" onMouseLeave={() => setHoverFace(null)}>
      {list.map((r) => {
        const open = selected === r.id;
        const style = styles[r.id] ?? (r.id !== ALL_FACES ? styles[ALL_FACES] : undefined);
        return (
            <button
              key={r.id}
              className={`action-tile ${open ? 'is-active' : ''}`}
              aria-pressed={open}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(GRAPHIC_DRAG_TYPE) || e.dataTransfer.types.includes('Files')) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData(GRAPHIC_DRAG_TYPE);
                if (id) assignGraphic({ objectId: target, face: r.id }, id);
                else if (e.dataTransfer.files.length) void importOnto({ objectId: target, face: r.id }, [...e.dataTransfer.files]);
              }}
              title={r.size ? `${r.name}, ${r.size}. Drop a picture here to put it on.` : 'Drop a picture here to put it on.'}
              onMouseEnter={() => setHoverFace({ objectId: target, face: r.id })}
              onClick={() => setSelectedFace(open ? null : { objectId: target, face: r.id })}
            >
              {style ? <Swatch style={style} /> : <TileIcon d={faceIcon(r.name)} />}
              <span>{r.name}</span>
            </button>
        );
      })}
      {children}
    </div>
    {current && (() => {
      const r = current;
      return (
              <div className="face__editor">
                <h4 className="face__title">
                  {r.name}
                  {r.size && <small>{r.size}</small>}
                </h4>
                <GraphicControls target={{ objectId: target, face: r.id }} graphic={(styles[r.id] ?? styles[ALL_FACES])?.graphic} />
                <h4 className="subhead">Colour and material</h4>
                <StyleEditor
                  style={styles[r.id] ?? styles[ALL_FACES]}
                  onChange={(s, key) => setStyle(r.id, s, key && `${key}:${target}:${r.id}`)}
                  extra={
                    <div className="btn-row">
                      {allFaces && r.id !== ALL_FACES && styles[r.id] && (
                        <button
                          className="btn"
                          onClick={() => {
                            // One undo step: set "all faces", then clear the individual ones.
                            setStyle(ALL_FACES, styles[r.id]);
                            for (const f of Object.keys(styles)) if (f !== ALL_FACES) setStyle(f, null, '@merge');
                          }}
                        >
                          Apply to all faces
                        </button>
                      )}
                      {styles[r.id] && (
                        <button className="btn btn--link" onClick={() => setStyle(r.id, null)}>
                          Reset face
                        </button>
                      )}
                    </div>
                  }
                />
              </div>
      );
    })()}
    </>
  );
}

/** A surface's kind, from its name, for its tile. */
function faceIcon(name: string) {
  const n = name.toLowerCase();
  if (/floor|top|deck|seat/.test(n)) return TILE.floor;
  if (/edge|skirt|front edge|riser/.test(n)) return TILE.edge;
  if (/grid|overhead|ceiling/.test(n)) return TILE.grid;
  if (/arch|frame/.test(n)) return TILE.arch;
  if (/wall|back|screen|panel|front|side/.test(n)) return TILE.wall;
  return TILE.face;
}

/** Sizes to read at a glance: whole numbers once they're big, in one unit: 26 × 26 ft. */
function sizeLabel(w: number, h: number, units: 'm' | 'ft') {
  const tidy = (m: number) => {
    const v = units === 'ft' ? m / 0.3048 : m;
    return v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
  };
  return `${tidy(w)} × ${tidy(h)} ${units}`;
}

/** "Faces" section for the selected object. Alt/Option-click a face in the view to jump to it. */
export function FacesSection({ o }: { o: SetObject }) {
  const units = useProjectStore((s) => s.units);
  const setFaceStyle = useProjectStore((s) => s.setFaceStyle);
  const type = getObjectType(o.type);
  const faces = type?.faces(o.params) ?? [];
  if (!type) return null;
  return (
    <Collapsible id="faces" title="Faces">
      <p className="hint">Pick a face to colour it, or Alt-click it on the stage.</p>
      <FaceList
        target={o.id}
        allFaces
        rows={faces.map((f) => ({ id: f.id, name: f.name, size: sizeLabel(f.width, f.height, units) }))}
        styles={o.faces ?? {}}
        setStyle={(face, s, key) => setFaceStyle(o.id, face, s, key)}
      />
    </Collapsible>
  );
}

/** "Stage surfaces" section (shown when nothing is selected). */
export function SurfacesSection() {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useProjectStore((s) => s.paramsByTemplate[s.templateId]);
  const data = useProjectStore((s) => s.dataByTemplate[s.templateId]);
  const units = useProjectStore((s) => s.units);
  const styles = useProjectStore((s) => s.surfaceStylesByTemplate[s.templateId]) ?? {};
  const setSurfaceStyle = useProjectStore((s) => s.setSurfaceStyle);
  const surfaces = getTemplate(templateId)!.surfaces(params, data).filter((s) => s.width > 0.01 && s.height > 0.01);
  return (
    <Collapsible id="surfaces" title="Surfaces">
      <p className="hint">Drop a picture onto the stage, or pick a surface to colour.</p>
      <FaceList
        target={SURFACE}
        rows={surfaces.map((s) => ({ id: s.id, name: s.label, size: sizeLabel(s.width, s.height, units) }))}
        styles={styles}
        setStyle={(id, s, key) => setSurfaceStyle(id, s, key)}
      >
        <Tile
          icon={TILE.picture}
          label="Add a floor picture"
          title="A picture on the floor, at any size and position"
          onClick={() => {
            addObjectAt(FLOOR_DECAL);
            const id = useProjectStore.getState().selectedIds[0];
            if (id) useObjectUI.getState().setSelectedFace({ objectId: id, face: 'graphic' });
          }}
        />
      </FaceList>
    </Collapsible>
  );
}
