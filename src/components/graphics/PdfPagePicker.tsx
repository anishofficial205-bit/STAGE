import { usePdfPicker } from '../../graphics/library';
import { Modal } from '../Modal';

/** "Which page?" dialog shown when importing a multi-page PDF. */
export function PdfPagePicker() {
  const request = usePdfPicker((s) => s.request);
  if (!request) return null;
  return (
    <Modal title={`Pick a page from “${request.name}”`} onClose={() => request.resolve(null)}>
      <p className="modal__text">
        {request.pages} pages{request.pages > request.thumbs.length ? ` (showing the first ${request.thumbs.length})` : ''}. The page is imported at high resolution.
      </p>
      <div className="pdf-pages">
        {request.thumbs.map((src, i) => (
          <button key={i} className="pdf-page" onClick={() => request.resolve(i + 1)}>
            <img src={src} alt={`Page ${i + 1}`} />
            <span>Page {i + 1}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
