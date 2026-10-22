/**
 * Light plot data and exports: the hookup list (CSV and in the PDF), and
 * turning the plot drawing (an SVG) into PNG and PDF files.
 */
import { jsPDF } from 'jspdf';
import { FIXTURES, type Fixture, type Lighting } from './types';
import { GOBOS } from './gobos';

export interface HookupRow {
  channel: number;
  type: string;
  position: string;
  beam: string;
  colour: string;
  gobo: string;
  group: string;
  purpose: string;
}

export const colourName = (f: Fixture) => f.gel ?? (f.kelvin ? `${f.kelvin} K` : f.color.toUpperCase());

export function hookup(l: Lighting): HookupRow[] {
  const custom = new Map(l.gobos.map((g) => [g.id, g.name]));
  return [...l.fixtures]
    .sort((a, b) => a.channel - b.channel)
    .map((f) => ({
      channel: f.channel,
      type: FIXTURES[f.type].label,
      position: f.mount === 'floor' ? 'Floor' : f.mount === 'rig' ? 'Rigging / truss' : l.positions.find((p) => p.id === f.mount)?.name ?? '—',
      beam: FIXTURES[f.type].point ? '—' : `${Math.round(f.beam)}°`,
      colour: colourName(f),
      gobo: f.gobo ? GOBOS.find((g) => g.id === f.gobo)?.name ?? custom.get(f.gobo) ?? 'Custom' : '',
      group: l.groups.filter((g) => g.ids.includes(f.id)).map((g) => g.name).join(', '),
      purpose: f.purpose ?? '',
    }));
}

const HEAD = ['Channel', 'Type', 'Position', 'Beam angle', 'Colour', 'Gobo', 'Group', 'Purpose'];

/** Spreadsheet-friendly CSV (quoted where needed, with a BOM so Excel reads UTF-8). */
export function hookupCsv(rows: HookupRow[]) {
  const q = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [HEAD, ...rows.map((r) => [r.channel, r.type, r.position, r.beam, r.colour, r.gobo, r.group, r.purpose])].map((r) => r.map(q).join(','));
  return new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}

/** Draw an SVG element onto a canvas at `scale` × its size. */
export async function svgToCanvas(svg: SVGSVGElement, scale = 2): Promise<HTMLCanvasElement> {
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export async function plotPng(svg: SVGSVGElement) {
  const c = await svgToCanvas(svg, 3);
  return new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
}

/** A3 landscape: the plot on page 1, then the hookup list. */
export async function plotPdf(svg: SVGSVGElement, rows: HookupRow[], title: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const c = await svgToCanvas(svg, 2.2);
  const k = Math.min((pw - 20) / c.width, (ph - 20) / c.height);
  doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', (pw - c.width * k) / 2, (ph - c.height * k) / 2, c.width * k, c.height * k);
  // Hookup list.
  doc.addPage('a3', 'landscape');
  const cols = [22, 52, 50, 26, 50, 32, 50, 108];
  const x0 = 14;
  let y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${title} — channel hookup`, x0, y);
  y += 10;
  const row = (cells: (string | number)[], bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    let x = x0;
    cells.forEach((v, i) => {
      doc.text(doc.splitTextToSize(String(v), cols[i] - 3)[0] ?? '', x, y);
      x += cols[i];
    });
    y += 7;
    doc.setDrawColor(220);
    doc.line(x0, y - 4.5, x0 + cols.reduce((a, b) => a + b, 0), y - 4.5);
  };
  row(HEAD, true);
  for (const r of rows) {
    if (y > ph - 14) {
      doc.addPage('a3', 'landscape');
      y = 20;
      row(HEAD, true);
    }
    row([r.channel, r.type, r.position, r.beam, r.colour, r.gobo, r.group, r.purpose]);
  }
  return doc.output('blob');
}
