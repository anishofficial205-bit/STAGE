import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteProp, refreshMyProps, useMyProps, type PhotoProp } from '../../photoProps/store';
import { usePlacing } from '../../objects/placing';
import { PHOTO_PROP } from '../../objects/photoProp';
import { MakeProp } from './MakeProp';
import { Modal } from '../Modal';

/** My props in the Add panel: make one from photos, or place one you made before (in any project). */
export function MyProps() {
  const list = useMyProps((s) => s.list);
  const [making, setMaking] = useState(false);
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
      <button className="btn btn--wide my-props__make" onClick={() => setMaking(true)}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        Make a prop from photos…
      </button>
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
