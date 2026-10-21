import { useProjectStore } from '../../store/useProjectStore';
import { getObjectType } from '../../objects/registry';
import { ALL_FACES } from '../../objects/faceMaterial';
import { SURFACE, useObjectUI } from '../../objects/ui';
import { getTemplate } from '../../templates/registry';
import { formatLength } from '../../units';
import type { FaceStyle } from '../../objects/materials';
import type { SetObject } from '../../objects/types';
import { Collapsible } from '../Collapsible';
import { StyleEditor, Swatch } from './StyleEditor';

interface Row {
  id: string;
  name: string;
  size?: string;
}

/**
 * List of faces (or surfaces) with a colour swatch each. Hover highlights the
 * face in the view; click opens the editor. `target` is an object id or SURFACE.
 */
function FaceList({ target, rows, styles, setStyle, allFaces }: { target: string; rows: Row[]; styles: Record<string, FaceStyle>; setStyle: (face: string, s: FaceStyle | null, key?: string) => void; allFaces?: boolean }) {
  const { setHoverFace, setSelectedFace } = useObjectUI.getState();
  const selected = useObjectUI((s) => (s.selectedFace?.objectId === target ? s.selectedFace.face : null));
  const list: Row[] = allFaces ? [{ id: ALL_FACES, name: 'All faces' }, ...rows] : rows;
  return (
    <ul className="faces" onMouseLeave={() => setHoverFace(null)}>
      {list.map((r) => {
        const open = selected === r.id;
        return (
          <li key={r.id} className={`face ${open ? 'is-open' : ''}`}>
            <button
              className="face__row"
              onMouseEnter={() => setHoverFace({ objectId: target, face: r.id })}
              onClick={() => setSelectedFace(open ? null : { objectId: target, face: r.id })}
            >
              <Swatch style={styles[r.id] ?? (r.id !== ALL_FACES ? styles[ALL_FACES] : undefined)} />
              <span className="face__name">{r.name}</span>
              {r.size && <span className="face__size">{r.size}</span>}
            </button>
            {open && (
              <div className="face__editor">
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
                          Reset
                        </button>
                      )}
                    </div>
                  }
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const sizeLabel = (w: number, h: number, units: 'm' | 'ft') => `${formatLength(w, units)} × ${formatLength(h, units)}`;

/** "Faces" section for the selected object. Alt/Option-click a face in the view to jump to it. */
export function FacesSection({ o }: { o: SetObject }) {
  const units = useProjectStore((s) => s.units);
  const setFaceStyle = useProjectStore((s) => s.setFaceStyle);
  const type = getObjectType(o.type);
  const faces = type?.faces(o.params) ?? [];
  if (!type) return null;
  return (
    <Collapsible id="faces" title="Faces">
      <p className="hint">Colour, material and graphics per face. Tip: Alt/Option-click a face in the view to pick it.</p>
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
    <Collapsible id="surfaces" title="Stage surfaces" defaultOpen={false}>
      <FaceList
        target={SURFACE}
        rows={surfaces.map((s) => ({ id: s.id, name: s.label, size: sizeLabel(s.width, s.height, units) }))}
        styles={styles}
        setStyle={(id, s, key) => setSurfaceStyle(id, s, key)}
      />
    </Collapsible>
  );
}
