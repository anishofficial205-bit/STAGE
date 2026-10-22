/**
 * Blocking sheets: one page per scene with a clean top view — the stage, set
 * pieces as outlines, entrances and spike marks, every performer's starting
 * position and their paths as numbered arrows in their colour — plus a legend
 * and the scene's notes. Or one performer's track through every scene.
 */
import { jsPDF } from 'jspdf';
import { getTemplate } from '../templates/registry';
import { getStageInfo } from '../helpers/stageInfo';
import { placedAll } from '../objects/actions';
import { GROUP_TYPE } from '../objects/types';
import { useProjectStore } from '../store/useProjectStore';
import { computeEntrances, type Entrance } from './entrances';
import { poseAt, sceneTracks } from './motion';
import { actingCentre } from './actions';
import { initials, type Blocking, type Scene } from './types';

const W = 1200;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** SVG (as text) of one scene's blocking; `only` limits it to one performer's track. */
export function sceneSvg(scene: Scene, b: Blocking, only?: string): { svg: string; w: number; h: number } {
  const s = useProjectStore.getState();
  const t = getTemplate(s.templateId)!;
  const info = getStageInfo(t, s.paramsByTemplate[s.templateId], s.dataByTemplate[s.templateId]);
  const floors = info.floors.filter((f) => f.height > 0.01);
  const ents = computeEntrances(s, b);
  const map = new Map(ents.map((e) => [e.id, e] as [string, Entrance]));
  const tracks = sceneTracks(scene, b.performers, map, actingCentre());
  const pieces = placedAll().filter((p) => p.obj.type !== GROUP_TYPE && !p.obj.hidden);
  const pts = [...floors.flatMap((f) => f.outline), ...ents.map((e) => [e.x, e.z] as [number, number]), ...[...tracks.values()].flatMap((x) => x.tracks.flatMap((tr) => tr.samples))];
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const m = 1.5;
  const [x0, x1, z0, z1] = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...zs) - m, Math.max(...zs) + m];
  const k = W / (x1 - x0);
  const H = Math.round((z1 - z0) * k);
  const X = (x: number) => ((x - x0) * k).toFixed(1);
  const Z = (z: number) => ((z - z0) * k).toFixed(1);
  const out: string[] = [];
  for (const f of floors) out.push(`<polygon points="${f.outline.map(([x, z]) => `${X(x)},${Z(z)}`).join(' ')}" fill="#f5f5f2" stroke="#222" stroke-width="2"/>`);
  for (const p of pieces)
    out.push(`<rect x="${(-p.size.width / 2) * k}" y="${(-p.size.depth / 2) * k}" width="${p.size.width * k}" height="${Math.max(2, p.size.depth * k)}" transform="translate(${X(p.wx)} ${Z(p.wz)}) rotate(${-p.obj.rotation})" fill="none" stroke="#b5b8bd" stroke-width="1.5"/>`);
  for (const e of ents) {
    const a = e.facing;
    out.push(`<g transform="translate(${X(e.x)} ${Z(e.z)}) rotate(${-a + 90})"><path d="M10 0 L-6 -7 L-6 7 Z" fill="#e8590c"/></g><text x="${X(e.x)}" y="${(+Z(e.z) - 12).toFixed(1)}" font-size="11" text-anchor="middle" fill="#b2450a">${esc(e.name)}</text>`);
  }
  const counts = new Map<string, number>();
  for (const mk of b.marks) {
    if (only && mk.performerId !== only) continue;
    const p = b.performers.find((x) => x.id === mk.performerId);
    const n = (counts.get(mk.performerId) ?? 0) + 1;
    counts.set(mk.performerId, n);
    out.push(`<g transform="translate(${X(mk.x)} ${Z(mk.z)})" stroke="${p?.color}" stroke-width="3"><line x1="-6" y1="0" x2="6" y2="0"/><line x1="0" y1="-6" x2="0" y2="6"/></g><text x="${(+X(mk.x) + 8).toFixed(1)}" y="${(+Z(mk.z) + 12).toFixed(1)}" font-size="10" fill="${p?.color}">${esc(initials(p?.name ?? '') + n)}</text>`);
  }
  for (const p of b.performers) {
    if (p.hidden) continue;
    const faint = only && p.id !== only;
    const tr = tracks.get(p.id)!;
    if (!faint)
      tr.tracks.forEach((x, i) => {
        if (x.samples.length < 2) return;
        out.push(`<polyline points="${x.samples.map(([a, c]) => `${X(a)},${Z(c)}`).join(' ')}" fill="none" stroke="${p.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
        const [a, c] = [x.samples[x.samples.length - 2], x.samples[x.samples.length - 1]];
        const ang = (Math.atan2(c[1] - a[1], c[0] - a[0]) * 180) / Math.PI;
        out.push(`<g transform="translate(${X(c[0])} ${Z(c[1])}) rotate(${ang})"><path d="M2 0 L-12 -7 L-12 7 Z" fill="${p.color}"/></g>`);
        const s0 = x.samples[0];
        out.push(`<circle cx="${X(s0[0])}" cy="${Z(s0[1])}" r="8" fill="#fff" stroke="${p.color}" stroke-width="2"/><text x="${X(s0[0])}" y="${(+Z(s0[1]) + 4).toFixed(1)}" font-size="10" font-weight="bold" text-anchor="middle" fill="${p.color}">${i + 1}</text>`);
      });
    const st = poseAt(tr.start, [], map, 0);
    out.push(`<g opacity="${faint ? 0.25 : 1}"><circle cx="${X(st.x)}" cy="${Z(st.z)}" r="13" fill="${p.color}" stroke="#fff" stroke-width="2"/><text x="${X(st.x)}" y="${(+Z(st.z) + 4).toFixed(1)}" font-size="11" font-weight="bold" text-anchor="middle" fill="#fff">${esc(initials(p.name))}</text></g>`);
  }
  // Audience side marker.
  out.push(`<text x="${W / 2}" y="${H - 8}" font-size="12" text-anchor="middle" fill="#888">AUDIENCE ↓</text>`);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>${out.join('')}</svg>`, w: W, h: H };
}

async function svgImage(svg: string, w: number, h: number) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

/** PDF: one page per scene (or one performer's track through every scene). */
export async function blockingPdf(only?: string): Promise<Blob> {
  const s = useProjectStore.getState();
  const b = s.blockingByTemplate[s.templateId];
  if (!b) throw new Error('No blocking yet.');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const who = only ? b.performers.find((p) => p.id === only) : undefined;
  for (const [i, scene] of b.scenes.entries()) {
    if (i) doc.addPage('a4', 'landscape');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`${s.projectName} — ${scene.name}${who ? ` · ${who.name}'s track` : ''}`, 12, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Scene ${i + 1} of ${b.scenes.length} · ${getTemplate(s.templateId)!.name}`, 12, 20);
    const { svg, w, h } = sceneSvg(scene, b, only);
    const img = await svgImage(svg, w, h);
    const maxW = pw - 80;
    const maxH = ph - 34;
    const k = Math.min(maxW / w, maxH / h);
    doc.addImage(img, 'JPEG', 12, 24, w * k, h * k);
    // Legend and notes on the right.
    let y = 30;
    const x = pw - 62;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Performers', x, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    for (const p of b.performers.filter((q) => !q.hidden && (!only || q.id === only))) {
      doc.setFillColor(p.color);
      doc.circle(x + 2, y - 1.2, 2, 'F');
      doc.text(`${initials(p.name)}  ${p.name}`, x + 6, y);
      y += 6;
    }
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', x, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const notes = doc.splitTextToSize(scene.notes || '—', 56) as string[];
    doc.text(notes.slice(0, 40), x, y);
  }
  return doc.output('blob');
}
