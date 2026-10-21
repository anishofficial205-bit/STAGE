/** pdf.js helpers, loaded only when a PDF is imported. */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(file: File) {
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/** Render a page so its long side is `size` pixels, on a white background. */
export async function renderPage(doc: pdfjs.PDFDocumentProxy, n: number, size: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: size / Math.max(base.width, base.height) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}
