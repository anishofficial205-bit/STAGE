/**
 * Spec sheet for printers and vendors: every face with a graphic, its
 * finished size in both unit systems, the pixels needed, fit mode, the
 * resolution check and the substrate. As a PDF (with thumbnails) or CSV.
 */
import { jsPDF } from 'jspdf';
import { useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { getBlob } from './db';
import { graphicUses, requiredPixels, type GraphicUse } from './printCheck';

const M_PER_IN = 0.0254;
const FT = 0.3048;
const FIT: Record<string, string> = { fit: 'Fit', fill: 'Fill', stretch: 'Stretch', tile: 'Tile' };

export function rowsFor(uses: GraphicUse[]) {
  return uses.map((u) => {
    const { w, h } = u.size;
    const p100 = requiredPixels(u.size, 100);
    const p150 = requiredPixels(u.size, 150);
    return {
      use: u,
      object: u.owner,
      face: u.faceName,
      graphic: u.meta?.name ?? '(missing)',
      mm: `${Math.round(w * 1000)} × ${Math.round(h * 1000)} mm`,
      inches: `${(w / M_PER_IN).toFixed(1)} × ${(h / M_PER_IN).toFixed(1)} in`,
      metres: `${w.toFixed(2)} × ${h.toFixed(2)} m`,
      feet: `${(w / FT).toFixed(2)} × ${(h / FT).toFixed(2)} ft`,
      px100: u.screen ? `${u.screen[0]} × ${u.screen[1]} px (screen)` : `${p100[0]} × ${p100[1]} px`,
      px150: u.screen ? '—' : `${p150[0]} × ${p150[1]} px`,
      fit: FIT[u.graphic.fit] + (u.graphic.fit === 'tile' ? ` (${u.graphic.tileSize} m tiles)` : ''),
      status: u.result?.label ?? 'Graphic file missing',
      substrate: u.graphic.substrate ?? '',
    };
  });
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function specCsv(): string {
  const head = ['Object', 'Face', 'Graphic', 'Size (mm)', 'Size (in)', 'Size (m)', 'Size (ft)', 'Pixels needed @100 DPI', 'Pixels needed @150 DPI', 'Fit', 'Resolution check', 'Material / substrate'];
  const rows = rowsFor(graphicUses()).map((r) => [r.object, r.face, r.graphic, r.mm, r.inches, r.metres, r.feet, r.px100, r.px150, r.fit, r.status, r.substrate]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** A small JPEG of a graphic for the PDF (white behind transparency). */
async function thumbnail(id: string, size = 160): Promise<string | null> {
  const blob = await getBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = size / Math.max(img.naturalWidth || size, img.naturalHeight || size);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || size) * k));
    c.height = Math.max(1, Math.round((img.naturalHeight || size) * k));
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const STATUS_COLOUR: Record<string, [number, number, number]> = { good: [32, 140, 70], ok: [196, 128, 0], low: [196, 40, 46] };

/** Draw the spec table onto `doc` starting at `top` (used by the spec sheet and the presentation sheet). */
export async function drawSpecTable(doc: jsPDF, top: number, margin = 14) {
  const rows = rowsFor(graphicUses());
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cols = [
    { title: '', w: 22 },
    { title: 'Object / face', w: 48 },
    { title: 'Finished size', w: 46 },
    { title: 'Pixels needed', w: 46 },
    { title: 'Fit', w: 24 },
    { title: 'Resolution check', w: 48 },
    { title: 'Material / substrate', w: 0 },
  ];
  cols[cols.length - 1].w = pageW - 2 * margin - cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
  const header = (y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(110);
    let x = margin;
    for (const c of cols) {
      doc.text(c.title.toUpperCase(), x + 1, y);
      x += c.w;
    }
    doc.setDrawColor(220);
    doc.line(margin, y + 2, pageW - margin, y + 2);
    return y + 6;
  };
  let y = header(top);
  if (!rows.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('No graphics placed on this stage yet.', margin, y + 6);
    return;
  }
  const ROW = 24;
  for (const r of rows) {
    if (y + ROW > pageH - margin) {
      doc.addPage();
      y = header(margin + 6);
    }
    let x = margin;
    const thumb = r.use.meta ? await thumbnail(r.use.meta.id) : null;
    if (thumb) {
      const props = doc.getImageProperties(thumb);
      const k = Math.min(18 / props.width, 18 / props.height);
      doc.addImage(thumb, 'JPEG', x + 1, y + 1, props.width * k, props.height * k);
    }
    x += cols[0].w;
    const cell = (lines: string[], w: number, bold = false, colour?: [number, number, number]) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...(colour ?? [30, 34, 40]));
      lines.forEach((t, i) => doc.text(doc.splitTextToSize(t, w - 3)[0], x + 1, y + 5 + i * 4.2));
      x += w;
    };
    cell([r.object, r.face, `“${r.graphic}”`], cols[1].w, true);
    cell([r.mm, r.inches, r.metres, r.feet], cols[2].w);
    cell([`@100 DPI: ${r.px100}`, ...(r.use.screen ? [] : [`@150 DPI: ${r.px150}`])], cols[3].w);
    cell([r.fit], cols[4].w);
    cell([r.status], cols[5].w, true, STATUS_COLOUR[r.use.result?.status ?? 'low']);
    cell([r.substrate || '—'], cols[6].w);
    doc.setDrawColor(235);
    doc.line(margin, y + ROW - 1, pageW - margin, y + ROW - 1);
    y += ROW;
  }
}

export async function specSheetPdf(): Promise<Blob> {
  const s = useProjectStore.getState();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(s.projectName, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Graphics spec sheet · ${getTemplate(s.templateId)!.name} · ${new Date().toLocaleDateString()}`, 14, 25);
  await drawSpecTable(doc, 36);
  return doc.output('blob');
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSlug = () => useProjectStore.getState().projectName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'stage';

// Dev-only hooks for automated checks; stripped from production builds.
if (import.meta.env.DEV) Object.assign(window, { __spec: { specSheetPdf, specCsv } });
