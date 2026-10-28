/**
 * Reading an MVR file (My Virtual Rig — the open exchange format lighting
 * software like Vectorworks Spotlight, grandMA3 and Capture can export).
 *
 * An .mvr is a zip with GeneralSceneDescription.xml (every fixture with its
 * place, in millimetres, Z up) and the GDTF files describing each fixture
 * model. We take each fixture's position, where it points (its focus point,
 * or straight along its beam), its fixture number, position name and colour,
 * and from the GDTF its beam angle and whether it moves.
 */
import JSZip from 'jszip';
import * as THREE from 'three';
import { guessType } from './csv';
import { toWorld, type ImportLight } from './importPlace';
import { currentStage } from '../objects/actions';
import { floorHeightAt } from '../helpers/stageInfo';
import type { FixtureType, Vec3 } from './types';

/** "{u1,u2,u3}{v1,v2,v3}{w1,w2,w3}{o1,o2,o3}" → a 4×4 matrix (millimetres). */
function matrixOf(el: Element | null): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  const text = el?.textContent ?? '';
  const parts = [...text.matchAll(/\{([^}]*)\}/g)].map((g) => g[1].split(',').map(Number));
  if (parts.length !== 4 || parts.some((p) => p.length !== 3 || p.some((n) => !Number.isFinite(n)))) return m;
  const [u, v, w, o] = parts;
  m.makeBasis(new THREE.Vector3(...u), new THREE.Vector3(...v), new THREE.Vector3(...w));
  m.setPosition(o[0], o[1], o[2]);
  return m;
}

const child = (el: Element, name: string) => [...el.children].find((c) => c.localName === name) ?? null;
const text = (el: Element, name: string) => child(el, name)?.textContent?.trim() ?? '';

/** Matrix of an element in the scene, including every parent's. */
function worldMatrix(el: Element): THREE.Matrix4 {
  const chain: Element[] = [];
  for (let p: Element | null = el; p && p.localName !== 'Scene'; p = p.parentElement) chain.unshift(p);
  const m = new THREE.Matrix4();
  for (const e of chain) {
    const own = child(e, 'Matrix');
    if (own) m.multiply(matrixOf(own));
  }
  return m;
}

/** CIE 1931 "x,y,Y" → #rrggbb. */
function cieToHex(s: string): string | undefined {
  const [x, y] = s.split(',').map(Number);
  if (!(x > 0 && y > 0)) return undefined;
  const Y = 1;
  const X = (x * Y) / y;
  const Z = ((1 - x - y) * Y) / y;
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  const max = Math.max(r, g, b, 1e-6);
  [r, g, b] = [r, g, b].map((c) => Math.max(0, c / max));
  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return `#${[r, g, b].map((c) => Math.round(gamma(c) * 255).toString(16).padStart(2, '0')).join('')}`;
}

interface GdtfInfo {
  name: string;
  beam?: number;
  type?: FixtureType;
}

/** What a GDTF fixture file says: its name, beam angle and kind. */
async function readGdtf(zip: JSZip, file: string): Promise<GdtfInfo | null> {
  const entry = zip.file(file) ?? zip.file(`${file}.gdtf`);
  if (!entry) return null;
  try {
    const inner = await JSZip.loadAsync(await entry.async('arraybuffer'));
    const xml = await inner.file('description.xml')?.async('string');
    if (!xml) return null;
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const ft = doc.getElementsByTagName('FixtureType')[0];
    const name = [ft?.getAttribute('Manufacturer'), ft?.getAttribute('LongName') || ft?.getAttribute('Name')].filter(Boolean).join(' ');
    const beam = doc.getElementsByTagName('Beam')[0];
    const angle = Number(beam?.getAttribute('BeamAngle'));
    const beamType = beam?.getAttribute('BeamType') ?? '';
    const attrs = [...doc.getElementsByTagName('Attribute')].map((a) => a.getAttribute('Name') ?? '');
    const moves = attrs.includes('Pan') && attrs.includes('Tilt');
    const type: FixtureType | undefined = moves ? 'moving' : /fresnel|pc/i.test(beamType) ? 'fresnel' : /spot/i.test(beamType) ? 'profile' : /rectangle/i.test(beamType) ? 'cyc' : /wash/i.test(beamType) ? 'par' : undefined;
    return { name, beam: Number.isFinite(angle) && angle > 0 ? angle : undefined, type };
  } catch {
    return null;
  }
}

export interface MvrResult {
  lights: ImportLight[];
  /** Fixtures that had no model file or one we couldn't read. */
  models: number;
}

export async function readMvr(file: File): Promise<MvrResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sceneFile = zip.file(/GeneralSceneDescription\.xml$/i)[0];
  if (!sceneFile) throw new Error('This doesn’t look like an MVR file (no scene description inside).');
  const doc = new DOMParser().parseFromString(await sceneFile.async('string'), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The MVR file’s scene description couldn’t be read.');

  // Named positions and focus points live in AUXData.
  const positionNames = new Map<string, string>();
  for (const p of doc.getElementsByTagName('Position')) {
    const uuid = p.getAttribute('uuid');
    if (uuid && p.getAttribute('name')) positionNames.set(uuid.toLowerCase(), p.getAttribute('name')!);
  }
  const focusPoints = new Map<string, THREE.Vector3>();
  for (const f of doc.getElementsByTagName('FocusPoint')) {
    const uuid = f.getAttribute('uuid');
    if (uuid) focusPoints.set(uuid.toLowerCase(), new THREE.Vector3().setFromMatrixPosition(worldMatrix(f)));
  }

  const fixtures = [...doc.getElementsByTagName('Fixture')];
  const specs = new Map<string, GdtfInfo | null>();
  for (const f of fixtures) {
    const spec = text(f, 'GDTFSpec');
    if (spec && !specs.has(spec)) specs.set(spec, await readGdtf(zip, spec));
  }

  const coords = { scale: 0.001, up: 'z' as const };
  const { info } = currentStage();
  let models = 0;
  const lights: ImportLight[] = fixtures.map((f, i) => {
    const m = worldMatrix(f);
    const at = new THREE.Vector3().setFromMatrixPosition(m);
    const spec = specs.get(text(f, 'GDTFSpec')) ?? null;
    if (spec) models++;
    const name = f.getAttribute('name') ?? '';
    const guess = guessType(`${spec?.name ?? ''} ${text(f, 'GDTFSpec')} ${name}`);
    const type = spec?.type ?? guess.type;
    const pos = toWorld([at.x, at.y, at.z], coords);
    // Aim: the focus point, else straight along the beam (the fixture's −Z) to the floor.
    let target: Vec3 | undefined;
    const focus = focusPoints.get(text(f, 'Focus').toLowerCase());
    if (focus) target = toWorld([focus.x, focus.y, focus.z], coords);
    else {
      const dir = new THREE.Vector3(0, 0, -1).transformDirection(m);
      const d = toWorld([at.x + dir.x * 1000, at.y + dir.y * 1000, at.z + dir.z * 1000], coords);
      const step = [d[0] - pos[0], d[1] - pos[1], d[2] - pos[2]];
      if (step[1] < -0.05) {
        const floor = floorHeightAt(info, pos[0], pos[2]);
        const k = (pos[1] - floor) / -step[1];
        if (k > 0 && k < 80) target = [pos[0] + step[0] * k, floor, pos[2] + step[2] * k];
      }
    }
    const fid = Number(text(f, 'FixtureID')) || Number(text(f, 'UnitNumber')) || undefined;
    const position = positionNames.get(text(f, 'Position').toLowerCase());
    const typeText = spec?.name || text(f, 'GDTFSpec').replace(/\.gdtf$/i, '').replace(/[@_]+/g, ' ').trim() || undefined;
    return {
      channel: fid,
      name: name || spec?.name || `Light ${i + 1}`,
      typeText,
      type,
      known: !!spec?.type || guess.known,
      position,
      unit: Number(text(f, 'UnitNumber')) || undefined,
      pos,
      target,
      color: cieToHex(text(f, 'Color')),
      beam: spec?.beam ?? (Number(typeText?.match(/(\d{1,3})\s*(deg|°)/i)?.[1]) || undefined),
    };
  });
  if (!lights.length) throw new Error('There are no lights in this MVR file.');
  return { lights, models };
}
