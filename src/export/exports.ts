/**
 * Exports for presenting a design: a view as PNG, every view as a zip, a
 * presentation sheet PDF and a turntable video.
 */
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { resetView, topView } from '../helpers/views';
import { formatLength } from '../units';
import { num } from '../helpers/params';
import { drawSpecTable, fileSlug } from '../graphics/specSheet';
import type { PresetView } from '../types';
import { exporter } from './state';

/** The same list the views bar shows: template views, saved seat views, Top, Reset. */
export function allViews(): PresetView[] {
  const s = useProjectStore.getState();
  const t = getTemplate(s.templateId)!;
  const params = s.paramsByTemplate[s.templateId];
  const data = s.dataByTemplate[s.templateId];
  const b = t.bounds(params, data);
  return [...t.presetViews(params, data), ...(s.savedViewsByTemplate[s.templateId] ?? []), topView(b, 16 / 9), resetView(b, 16 / 9)];
}

const dataUrlToBlob = async (url: string) => (await fetch(url)).blob();
const slug = (s: string) => s.replace(/★/g, '').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'view';

function capture(width: number, height: number, view: PresetView | undefined, labels: boolean, type: 'image/png' | 'image/jpeg' = 'image/png') {
  if (!exporter.capture) throw new Error('The 3D view is not ready yet.');
  return exporter.capture({ width, height, view, labels, type });
}

/** The current camera view as a PNG. */
export async function exportCurrentView(width: number, height: number, labels: boolean): Promise<Blob> {
  return dataUrlToBlob(await capture(width, height, undefined, labels));
}

/** Every preset and saved view, numbered and named, in a zip. */
export async function exportAllViews(width: number, height: number, labels: boolean, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const views = allViews();
  const zip = new JSZip();
  for (let i = 0; i < views.length; i++) {
    onProgress?.(i, views.length);
    const url = await capture(width, height, views[i], labels);
    zip.file(`${String(i + 1).padStart(2, '0')}-${slug(views[i].label)}.png`, await dataUrlToBlob(url));
  }
  onProgress?.(views.length, views.length);
  return zip.generateAsync({ type: 'blob' });
}

/** Key dimensions of the stage, as "label: value" lines. */
function dimensionLines(): string[] {
  const s = useProjectStore.getState();
  const t = getTemplate(s.templateId)!;
  const p = s.paramsByTemplate[s.templateId];
  const lines: string[] = [];
  const labelOf = (key: string) => t.params.find((d) => d.key === key)?.label ?? key;
  for (const key of Object.values(t.dimensions ?? {})) {
    if (key && key in p) lines.push(`${labelOf(key)}: ${formatLength(num(p, key), s.units)}`);
  }
  // A few more stage-defining numbers when they exist.
  for (const key of ['archWidth', 'archHeight', 'rows', 'roomWidth', 'roomLength', 'sections', 'trussHeight']) {
    if (key in p && !lines.some((l) => l.startsWith(labelOf(key)))) {
      const def = t.params.find((d) => d.key === key);
      if (def?.type === 'number') lines.push(`${def.label}: ${def.unit === 'none' ? num(p, key) : formatLength(num(p, key), s.units)}`);
    }
  }
  const objects = (s.objectsByTemplate[s.templateId] ?? []).filter((o) => o.type !== '@group').length;
  if (objects) lines.push(`Set pieces: ${objects}`);
  return lines.slice(0, 9);
}

/**
 * Presentation sheet: page 1 with a hero view, a labelled top view and four
 * audience views; page 2 with the graphics specification.
 */
export async function presentationPdf(onProgress?: (msg: string) => void): Promise<Blob> {
  const s = useProjectStore.getState();
  const t = getTemplate(s.templateId)!;
  const views = allViews();
  const reset = views.find((v) => v.id === 'reset')!;
  const top = views.find((v) => v.id === 'top')!;
  const audience = views.filter((v) => v.id !== 'reset' && v.id !== 'top').slice(0, 4);

  onProgress?.('Rendering hero view…');
  const hero = await capture(1920, 1080, reset, false, 'image/jpeg');
  onProgress?.('Rendering top view…');
  const plan = await capture(1600, 900, top, true, 'image/jpeg');
  const shots: string[] = [];
  for (const v of audience) {
    onProgress?.(`Rendering ${v.label}…`);
    shots.push(await capture(1280, 720, v, false, 'image/jpeg'));
  }

  onProgress?.('Laying out the sheet…');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const M = 14;
  const W = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text(s.projectName, M, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${t.name} · ${t.description} · ${new Date().toLocaleDateString()}`, M, 24.5);

  // Hero (left), 16:9.
  const heroW = 176;
  const heroH = (heroW * 9) / 16;
  doc.addImage(hero, 'JPEG', M, 30, heroW, heroH);
  // Right column: labelled top view and the key dimensions.
  const colX = M + heroW + 7;
  const colW = W - colX - M;
  const planH = (colW * 9) / 16;
  doc.addImage(plan, 'JPEG', colX, 30, colW, planH);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('TOP VIEW', colX, 30 + planH + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text('Main dimensions', colX, 30 + planH + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60);
  dimensionLines().forEach((l, i) => doc.text(l, colX, 30 + planH + 19 + i * 5));

  // Audience views along the bottom.
  const rowY = 30 + heroH + 7;
  const gap = 5;
  const shotW = (W - 2 * M - gap * 3) / 4;
  const shotH = (shotW * 9) / 16;
  shots.forEach((img, i) => {
    const x = M + i * (shotW + gap);
    doc.addImage(img, 'JPEG', x, rowY, shotW, shotH);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(audience[i].label.replace('★ ', '').toUpperCase(), x, rowY + shotH + 4.5);
  });

  // Page 2: graphics spec.
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text('Graphics specification', M, 18);
  onProgress?.('Adding the graphics table…');
  await drawSpecTable(doc, 28, M);
  return doc.output('blob');
}

export async function turntableVideo(seconds = 8): Promise<Blob> {
  if (!exporter.turntable) throw new Error('The 3D view is not ready yet.');
  return exporter.turntable(seconds, [1280, 720]);
}

export const exportName = (suffix: string) => `${fileSlug()}-${suffix}`;

// Dev-only hooks for automated checks; stripped from production builds.
if (import.meta.env.DEV) Object.assign(window, { __export: { exportCurrentView, exportAllViews, presentationPdf, turntableVideo } });
