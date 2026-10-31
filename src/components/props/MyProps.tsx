import { useEffect, useState, type ReactNode } from 'react';
import { TILE, Tile, Tiles } from '../ActionTile';
import { createPortal } from 'react-dom';
import { deleteProp, refreshMyProps, useMyProps, type PhotoProp } from '../../photoProps/store';
import { usePlacing } from '../../objects/placing';
import { PHOTO_PROP } from '../../objects/photoProp';
import { MakeProp } from './MakeProp';
import { ImportModel } from './ImportModel';
import { Modal } from '../Modal';

/** My props in the Add panel: make one from photos, import a 3D model, or place one you made before (in any project). */
export function MyProps({ lead }: { lead?: ReactNode }) {
  const list = useMyProps((s) => s.list);
  const [making, setMaking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<PhotoProp | null>(null);
  const placing = usePlacing((s) => (s.typeId === PHOTO_PROP ? s.init?.key : null));
  useEffect(() => {
    void refreshMyProps();
  }, []);
  const place = (p: PhotoProp) => {
    const pl = usePlacing.getState();
    if (placing === p.id) return pl.cancel();
    pl.start(PHOTO_PROP, { params: { source: p.id, width: p.width, height: p.height, depth: p.depth }, name: p.name, key: p.id });
  };
  return (
    <section className="my-props">
      <Tiles>
        {lead}
        <Tile icon={TILE.photo} label="Prop from photos" onClick={() => setMaking(true)} />
        <Tile icon={TILE.face} label="Import a 3D model" onClick={() => setImporting(true)} title="OBJ (with its colours and pictures), or glTF — from SketchUp, Blender, Rhino or a model website" />
      </Tiles>
      {list.length > 0 && (
        <>
          <h3 className="group__title">My props</h3>
          <div className="library__grid">
            {list.map((p) => (
              <span key={p.id} className="my-prop">
                <button className={`tile ${placing === p.id ? 'is-active' : ''}`} onClick={() => place(p)} title={`${p.name} — click, then click on the stage to place it`}>
                  <img className="my-prop__pic" src={p.thumbnail} alt="" />
                  <span className="tile__name">{p.name}</span>
                </button>
                <button className="my-prop__x" onClick={() => setRemoving(p)} aria-label={`Delete ${p.name} from My props`} title="Delete from My props">
                  ×
                </button>
              </span>
            ))}
          </div>
        </>
      )}
      {/* On the page itself, not inside the panel (which would clip it). */}
      {making && createPortal(<MakeProp onClose={() => setMaking(false)} />, document.body)}
      {importing && createPortal(<ImportModel onClose={() => setImporting(false)} />, document.body)}
      {removing &&
        createPortal(
        <Modal title={`Delete “${removing.name}” from My props?`} onClose={() => setRemoving(null)}>
          <p className="modal__text">It won’t be offered in the Add list any more. Pieces already placed in a project show as a grey box until you remove them.</p>
          <div className="modal__actions">
            <button className="btn" onClick={() => setRemoving(null)}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              onClick={() => {
                void deleteProp(removing.id);
                setRemoving(null);
              }}
            >
              Delete
            </button>
          </div>
        </Modal>,
          document.body,
        )}
    </section>
  );
}
