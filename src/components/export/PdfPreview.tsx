import { useEffect, useRef, useState } from 'react';
import { Modal } from '../Modal';
import { download } from '../../graphics/specSheet';

/** Print a PDF without showing it: a hidden frame loads it and opens the print dialog. */
export function printPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Some browsers won't print a PDF from a frame: open it so it can be printed from there.
      window.open(url, '_blank');
    }
    setTimeout(() => (frame.remove(), URL.revokeObjectURL(url)), 60_000);
  };
  document.body.appendChild(frame);
}

/**
 * A PDF as it will come out, with Download and Print. `make` builds it once
 * when the preview opens.
 */
export function PdfPreview({ title, make, fileName, onClose }: { title: string; make: () => Promise<Blob>; fileName: string; onClose: () => void }) {
  const [pdf, setPdf] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let url = '';
    let live = true;
    make()
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setPdf({ blob, url });
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not make the PDF.'));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const print = () => {
    if (!pdf) return;
    try {
      frame.current?.contentWindow?.focus();
      frame.current?.contentWindow?.print();
    } catch {
      printPdf(pdf.blob);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="pdf-preview">
        {pdf ? <iframe ref={frame} src={`${pdf.url}#navpanes=0&view=FitH`} title={`${title} preview`} /> : <p className="pdf-preview__wait">{error ?? 'Making the pages…'}</p>}
      </div>
      <div className="modal__actions">
        <button className="btn" onClick={onClose}>
          Close
        </button>
        <button className="btn" disabled={!pdf} onClick={print}>
          Print…
        </button>
        <button className="btn btn--primary" disabled={!pdf} onClick={() => pdf && download(pdf.blob, fileName)}>
          Download PDF
        </button>
      </div>
    </Modal>
  );
}
