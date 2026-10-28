/**
 * Showpieces — the pieces big productions are made of: neon signs, marquee
 * bulb frames, curved LED rings, curved runways, and set dressing (bookshelves
 * full of books, chandeliers, pictures, ladders).
 *
 * Glowing parts (neon, bulbs, LED) use unlit materials that skip tone mapping,
 * so they read as light sources whatever the stage lighting is doing.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Params } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { Cube, Icon, SET } from '../common';
import { FaceMat } from '../faceMaterial';
import type { SetObjectType } from '../types';

const len = (key: string, label: string, def: number, min: number, max: number, group = 'Size') => ({ key, label, group, type: 'number' as const, default: def, min, max, step: 0.05 });
const count = (key: string, label: string, def: number, min: number, max: number, group = 'Size') => ({ key, label, group, type: 'number' as const, unit: 'none' as const, default: def, min, max, step: 1 });
const colour = (key: string, label: string, def: string, group = 'Look') => ({ key, label, group, type: 'color' as const, default: def });
const choice = (key: string, label: string, options: [string, string][], def: string, group = 'Look') => ({ key, label, group, type: 'select' as const, default: def, options: options.map(([value, l]) => ({ value, label: l })) });

/** A deterministic random sequence (so a bookshelf looks the same every time). */
function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A bright, unlit material for things that are light (bulbs, neon, LED edges). */
function glowMat(color: string, boost = 1.6) {
  const c = new THREE.Color(color).multiplyScalar(boost);
  const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  return m;
}

// --- Neon sign ---------------------------------------------------------------------------

const NEON_SHAPES: [string, string][] = [
  ['text', 'Words'],
  ['heart', 'Heart'],
  ['star', 'Star'],
  ['flower', 'Flower'],
  ['wave', 'Wave'],
  ['circle', 'Circle'],
  ['spiral', 'Spiral'],
];
const neonFont = (p: Params, px: number) => (str(p, 'font') === 'script' ? `italic 700 ${px}px "Brush Script MT", "Snell Roundhand", cursive` : str(p, 'font') === 'serif' ? `700 ${px}px Georgia, "Times New Roman", serif` : `800 ${px}px "Arial Black", Inter, sans-serif`);

/** Width ÷ height of the sign (words get wider with more letters). */
function neonAspect(p: Params) {
  if (str(p, 'shape') !== 'text') return str(p, 'shape') === 'wave' ? 2.4 : 1;
  const c = document.createElement('canvas').getContext('2d')!;
  c.font = neonFont(p, 100);
  return Math.max(0.6, (c.measureText(str(p, 'text') || ' ').width + 60) / 140);
}

function drawShape(g: CanvasRenderingContext2D, shape: string, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.38;
  g.beginPath();
  if (shape === 'heart') {
    g.moveTo(cx, cy + r * 0.95);
    g.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.8, cy - r * 1.25, cx, cy - r * 0.45);
    g.bezierCurveTo(cx + r * 0.8, cy - r * 1.25, cx + r * 1.5, cy - r * 0.1, cx, cy + r * 0.95);
  } else if (shape === 'star') {
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      i ? g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : g.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
  } else if (shape === 'flower') {
    for (let i = 0; i <= 360; i += 2) {
      const a = (i * Math.PI) / 180;
      const rr = r * (0.62 + 0.38 * Math.abs(Math.cos(2.5 * a)));
      i ? g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : g.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
  } else if (shape === 'wave') {
    for (let x = w * 0.06; x <= w * 0.94; x += 4) {
      const y = cy + Math.sin(((x - w * 0.06) / (w * 0.88)) * Math.PI * 4) * h * 0.25;
      x === w * 0.06 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
  } else if (shape === 'spiral') {
    for (let i = 0; i <= 720; i += 4) {
      const a = (i * Math.PI) / 180;
      const rr = (r * i) / 720;
      i ? g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : g.moveTo(cx, cy);
    }
  } else g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
}

const neonTextures = new Map<string, THREE.Texture>();
function neonTexture(p: Params) {
  const key = JSON.stringify([str(p, 'shape'), str(p, 'text'), str(p, 'font'), str(p, 'color')]);
  const hit = neonTextures.get(key);
  if (hit) return hit;
  const aspect = neonAspect(p);
  const H = 256;
  const W = Math.min(4096, Math.round(H * aspect));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const color = str(p, 'color');
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // Glow, then the tube, then its hot white core.
  for (const [blur, width, style] of [
    [40, 14, color],
    [14, 9, color],
    [0, 3.5, '#ffffff'],
  ] as [number, number, string][]) {
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.strokeStyle = style;
    g.lineWidth = width;
    if (str(p, 'shape') === 'text') {
      g.font = neonFont(p, 150);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.strokeText(str(p, 'text') || ' ', W / 2, H / 2 + 6);
    } else drawShape(g, str(p, 'shape'), W, H);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  neonTextures.set(key, t);
  return t;
}

function NeonSign({ p }: { p: Params }) {
  const h = num(p, 'height');
  const w = h * neonAspect(p);
  const map = neonTexture(p);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8) }), [map]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group>
      {bool(p, 'backing') && <Cube at={[0, h / 2, -0.03]} size={[w + 0.2, h + 0.2, 0.04]} color="#15161a" face="backing" />}
      <mesh position={[0, h / 2, 0.01]} material={mat}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* A faint grab area: the glow itself is see-through. */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, 0.02]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export const neonSignObject: SetObjectType = {
  id: 'neon-sign',
  name: 'Neon sign',
  category: 'Showpieces',
  icon: (
    <Icon>
      <path d="M4 15c2-6 4-6 5 0s3 6 5 0 3-6 6 0" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    choice('shape', 'Shape', NEON_SHAPES, 'text', 'Sign'),
    { key: 'text', label: 'Words', group: 'Sign', type: 'select', default: 'Showtime', options: [], free: true, text: true, visible: (p) => str(p, 'shape') === 'text' },
    choice('font', 'Lettering', [['script', 'Script'], ['block', 'Block capitals'], ['serif', 'Classic serif']], 'script', 'Sign'),
    colour('color', 'Colour', '#ff3d8b', 'Sign'),
    len('height', 'Height', 0.8, 0.2, 6),
    { key: 'backing', label: 'Dark backing board', group: 'Sign', type: 'boolean', default: false },
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'height') * neonAspect(p), depth: 0.06, height: num(p, 'height') }),
  build: (p) => <NeonSign p={p} />,
  faces: (p) => (bool(p, 'backing') ? [{ id: 'backing', name: 'Backing board', width: num(p, 'height') * neonAspect(p), height: num(p, 'height') }] : []),
};

// --- Marquee bulb frame ----------------------------------------------------------------

/** The frame's outline (x across, y up from 0), as a closed list of points. */
function frameOutline(shape: string, w: number, h: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const P = (x: number, y: number) => pts.push(new THREE.Vector3(x, y, 0));
  if (shape === 'circle') {
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      P((w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a));
    }
  } else if (shape === 'heart') {
    for (let i = 0; i < 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      P((x / 32) * w, ((y + 17) / 29.5) * h);
    }
  } else if (shape === 'arch') {
    const r = w / 2;
    const spring = Math.max(0, h - r);
    P(-r, 0);
    for (let i = 0; i <= 48; i++) {
      const a = Math.PI - (i / 48) * Math.PI;
      P(r * Math.cos(a), spring + r * Math.sin(a));
    }
    P(r, 0);
  } else {
    P(-w / 2, 0);
    P(-w / 2, h);
    P(w / 2, h);
    P(w / 2, 0);
  }
  return pts;
}

/** Points every `step` metres along a closed outline. */
function along(pts: THREE.Vector3[], step: number, closed: boolean) {
  const out: THREE.Vector3[] = [];
  const segs = closed ? pts.length : pts.length - 1;
  let carry = 0;
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const L = a.distanceTo(b);
    let t = carry;
    while (t < L) {
      out.push(a.clone().lerp(b, t / L));
      t += step;
    }
    carry = t - L;
  }
  return out;
}

function BulbFrame({ p }: { p: Params }) {
  const [w, h] = [num(p, 'width'), num(p, 'height')];
  const shape = str(p, 'shape');
  const closed = shape !== 'arch';
  const { tube, bulbs } = useMemo(() => {
    const pts = frameOutline(shape, w, h);
    const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0);
    const tube = new THREE.TubeGeometry(curve, Math.max(64, pts.length * 4), num(p, 'frame') / 2, 8, closed);
    return { tube, bulbs: along(pts, num(p, 'spacing'), closed) };
  }, [shape, w, h, closed, p]);
  useEffect(() => () => tube.dispose(), [tube]);
  const bulbMat = useMemo(() => glowMat(str(p, 'bulbColor'), 1.8), [p]);
  const inst = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035 + num(p, 'frame') * 0.15, 10, 8), bulbMat, Math.max(1, bulbs.length));
    const o = new THREE.Object3D();
    bulbs.forEach((b, i) => {
      o.position.set(b.x, b.y, num(p, 'frame') / 2 + 0.02);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = bulbs.length;
    return m;
  }, [bulbs, bulbMat, p]);
  useEffect(() => () => inst.geometry.dispose(), [inst]);
  return (
    <group>
      <mesh geometry={tube} castShadow receiveShadow>
        <FaceMat face="frame" color={str(p, 'frameColor')} roughness={0.35} metalness={0.6} />
      </mesh>
      <primitive object={inst} />
    </group>
  );
}

export const bulbFrameObject: SetObjectType = {
  id: 'bulb-frame',
  name: 'Marquee bulb frame',
  category: 'Showpieces',
  icon: (
    <Icon>
      <path d="M12 20c-6-4-9-8-9-11a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 3-3 7-9 11z" />
    </Icon>
  ),
  placement: 'floor',
  params: [
    choice('shape', 'Shape', [['rect', 'Rectangle'], ['arch', 'Arch'], ['heart', 'Heart'], ['circle', 'Circle']], 'arch', 'Frame'),
    len('width', 'Width', 4, 0.5, 30),
    len('height', 'Height', 4, 0.5, 20),
    len('frame', 'Frame thickness', 0.15, 0.04, 0.6),
    len('spacing', 'Bulb spacing', 0.25, 0.08, 1, 'Bulbs'),
    colour('bulbColor', 'Bulb colour', '#ffcf7a', 'Bulbs'),
    colour('frameColor', 'Frame colour', '#b8862f', 'Frame'),
  ],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'frame') + 0.1, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => <BulbFrame p={p} />,
  faces: (p) => [{ id: 'frame', name: 'Frame', width: num(p, 'width'), height: num(p, 'height') }],
};

// --- LED ring ----------------------------------------------------------------------------

let standby: THREE.Texture | null = null;
/** The ring's look until a picture is put on it: a soft blue-violet band. */
function standbyTexture() {
  if (standby) return standby;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#1b3d8f');
  grad.addColorStop(0.5, '#4a2a86');
  grad.addColorStop(1, '#1b3d8f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 64);
  standby = new THREE.CanvasTexture(c);
  standby.colorSpace = THREE.SRGBColorSpace;
  return standby;
}

function LedRing({ p }: { p: Params }) {
  const [r, h, arc] = [num(p, 'diameter') / 2, num(p, 'height'), num(p, 'arc')];
  const theta = (arc * Math.PI) / 180;
  const start = -theta / 2; // centred on the front (+z)
  const trim = useMemo(() => glowMat(str(p, 'trim'), 1.2), [p]);
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[r, r, h, 96, 1, true, start, theta]} />
        <FaceMat face="screen" color="#ffffff" map={standbyTexture()} emissive="#ffffff" emissiveIntensity={0.9} emissiveMap={standbyTexture()} roughness={0.35} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[r - 0.04, r - 0.04, h, 96, 1, true, start, theta]} />
        <meshStandardMaterial color="#14161b" side={THREE.BackSide} roughness={0.6} />
      </mesh>
      {[0, h].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2 - theta / 2]} material={trim}>
          <torusGeometry args={[r + 0.01, 0.025, 6, 96, theta]} />
        </mesh>
      ))}
    </group>
  );
}

export const ledRingObject: SetObjectType = {
  id: 'led-ring',
  name: 'LED ring',
  category: 'Showpieces',
  icon: (
    <Icon>
      <ellipse cx="12" cy="8" rx="8" ry="3" />
      <path d="M4 8v6c0 1.7 3.6 3 8 3s8-1.3 8-3V8" />
    </Icon>
  ),
  placement: 'hanging',
  defaultElevation: 5,
  params: [len('diameter', 'Diameter', 8, 1, 40), len('height', 'Screen height', 1.2, 0.2, 8), { key: 'arc', label: 'How far round (°)', group: 'Size', type: 'number', unit: 'none', default: 360, min: 30, max: 360, step: 5 }, colour('trim', 'Edge light', '#9fd8ff')],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'diameter'), depth: num(p, 'diameter'), height: num(p, 'height') }),
  resize: { width: 'diameter' },
  build: (p) => <LedRing p={p} />,
  faces: (p) => [{ id: 'screen', name: 'Screen', width: (Math.PI * num(p, 'diameter') * num(p, 'arc')) / 360, height: num(p, 'height') }],
};

// --- Curved runway ----------------------------------------------------------------------

/** The runway's footprint: an arc of track centred on +z. Returns its bounds and outline. */
export function arcGeometry(p: Params) {
  const [inner, w, a] = [num(p, 'radius'), num(p, 'width'), (num(p, 'angle') * Math.PI) / 180];
  const outer = inner + w;
  const xs = [outer * Math.sin(a / 2), -outer * Math.sin(a / 2)];
  const zs = [outer, inner * Math.cos(Math.min(Math.PI, a / 2)), outer * Math.cos(Math.min(Math.PI, a / 2))];
  if (a >= Math.PI) xs.push(outer, -outer);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs, a >= Math.PI ? -outer * Math.cos(Math.PI - a / 2) : Infinity);
  const maxZ = Math.max(...zs);
  return { inner, outer, a, width: maxX - minX, depth: maxZ - minZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

function ArcRunway({ p }: { p: Params }) {
  const g = arcGeometry(p);
  const h = num(p, 'height');
  const geometry = useMemo(() => {
    const s = new THREE.Shape();
    // Shape coords: (x, -z), so the extrusion lies on the floor after turning it.
    const pt = (r: number, t: number) => new THREE.Vector2(r * Math.sin(t), -r * Math.cos(t));
    const n = 64;
    const a0 = -g.a / 2;
    s.moveTo(pt(g.outer, a0).x, pt(g.outer, a0).y);
    for (let i = 1; i <= n; i++) s.lineTo(pt(g.outer, a0 + (g.a * i) / n).x, pt(g.outer, a0 + (g.a * i) / n).y);
    for (let i = n; i >= 0; i--) s.lineTo(pt(g.inner, a0 + (g.a * i) / n).x, pt(g.inner, a0 + (g.a * i) / n).y);
    const e = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
    e.rotateX(-Math.PI / 2);
    e.translate(-g.cx, 0, -g.cz);
    return e;
  }, [g.inner, g.outer, g.a, g.cx, g.cz, h]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const edge = useMemo(() => {
    if (!bool(p, 'edgeLight')) return null;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = -g.a / 2 + (g.a * i) / 96;
      pts.push(new THREE.Vector3(g.outer * Math.sin(t) - g.cx, h + 0.012, g.outer * Math.cos(t) - g.cz));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 192, 0.02, 6, false);
  }, [p, g.outer, g.a, g.cx, g.cz, h]);
  const edgeMat = useMemo(() => glowMat(str(p, 'edgeColor'), 1.5), [p]);
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <FaceMat attach="material-0" face="top" color={str(p, 'deckColor')} roughness={0.35} metalness={0.1} />
        <FaceMat attach="material-1" face="edge" color="#1d2026" roughness={0.6} />
      </mesh>
      {edge && <mesh geometry={edge} material={edgeMat} />}
    </group>
  );
}

export const arcPlatformObject: SetObjectType = {
  id: 'arc-platform',
  name: 'Curved runway',
  category: 'Platforms',
  icon: (
    <Icon>
      <path d="M3 9a12 12 0 0 0 18 0M6 6a9 9 0 0 0 12 0" />
    </Icon>
  ),
  placement: 'floor',
  params: [len('radius', 'Inner radius', 8, 0.5, 60), len('width', 'Track width', 1.8, 0.4, 10), { key: 'angle', label: 'How far round (°)', group: 'Size', type: 'number', unit: 'none', default: 120, min: 10, max: 330, step: 5 }, len('height', 'Height', 1, 0.05, 4), colour('deckColor', 'Deck colour', '#2a2d34'), { key: 'edgeLight', label: 'Light along the edge', group: 'Look', type: 'boolean', default: true }, colour('edgeColor', 'Edge light colour', '#9fd8ff')],
  constraints: (p) => p,
  size: (p) => {
    const g = arcGeometry(p);
    return { width: g.width, depth: g.depth, height: num(p, 'height') };
  },
  platformTop: (p) => num(p, 'height'),
  build: (p) => <ArcRunway p={p} />,
  faces: (p) => [
    { id: 'top', name: 'Deck', width: arcGeometry(p).width, height: arcGeometry(p).depth },
    { id: 'edge', name: 'Edge', width: arcGeometry(p).width, height: num(p, 'height') },
  ],
};

// --- Bookshelf ---------------------------------------------------------------------------

const BOOK_COLOURS = ['#7a2e2e', '#2f4a6b', '#3d5a3a', '#8a6a2f', '#5a3a5e', '#a8492f', '#2c2c2c', '#c9b58a', '#6b4a32', '#3a6a6a'];

function Bookshelf({ p }: { p: Params }) {
  const [w, h, d, shelves] = [num(p, 'width'), num(p, 'height'), num(p, 'depth'), Math.round(num(p, 'shelves'))];
  const t = 0.03;
  const gap = (h - t) / shelves;
  const books = useMemo(() => {
    const rnd = seeded(Math.round(w * 1000 + h * 37 + shelves));
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 600);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    let n = 0;
    const fill = num(p, 'fill');
    for (let s = 0; s < shelves && n < 600; s++) {
      let x = -w / 2 + t + 0.01;
      const y0 = t + s * gap;
      while (x < w / 2 - t - 0.03 && n < 600) {
        const bw = 0.025 + rnd() * 0.04;
        if (rnd() > fill) {
          x += bw + 0.02;
          continue;
        }
        const bh = Math.min(gap - 0.03, gap * (0.6 + rnd() * 0.3));
        const lean = rnd() < 0.06 ? 0.25 : 0;
        o.position.set(x + bw / 2, y0 + bh / 2, -0.02 + rnd() * 0.03);
        o.rotation.set(0, 0, lean);
        o.scale.set(bw, bh, d * (0.7 + rnd() * 0.2));
        o.updateMatrix();
        m.setMatrixAt(n, o.matrix);
        m.setColorAt(n, c.set(BOOK_COLOURS[Math.floor(rnd() * BOOK_COLOURS.length)]));
        n++;
        x += bw + 0.002;
      }
    }
    m.count = n;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }, [w, h, d, shelves, gap, p]);
  useEffect(() => () => books.geometry.dispose(), [books]);
  return (
    <group>
      <Cube at={[-w / 2 + t / 2, h / 2, 0]} size={[t, h, d]} color={SET.wood} face="frame" />
      <Cube at={[w / 2 - t / 2, h / 2, 0]} size={[t, h, d]} color={SET.wood} face="frame" />
      <Cube at={[0, h / 2, -d / 2 + 0.01]} size={[w, h, 0.02]} color={SET.wood} face="frame" />
      {Array.from({ length: shelves + 1 }, (_, i) => (
        <Cube key={i} at={[0, i * gap + t / 2, 0]} size={[w, t, d]} color={SET.wood} face="frame" />
      ))}
      <primitive object={books} />
    </group>
  );
}

export const bookshelfObject: SetObjectType = {
  id: 'bookshelf',
  name: 'Bookshelf',
  category: 'Props',
  icon: (
    <Icon>
      <path d="M4 3h16v18H4zM4 9h16M4 15h16M7 4v4M9 4v4M13 10v4M16 16v4" />
    </Icon>
  ),
  placement: 'floor',
  params: [len('width', 'Width', 1.6, 0.4, 8), len('height', 'Height', 2.2, 0.5, 5), len('depth', 'Depth', 0.35, 0.2, 1), count('shelves', 'Shelves', 5, 1, 10), { key: 'fill', label: 'How full', group: 'Books', type: 'number', unit: 'none', default: 0.85, min: 0, max: 1, step: 0.05 }],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'depth'), height: num(p, 'height') }),
  resize: { width: 'width', depth: 'depth' },
  build: (p) => <Bookshelf p={p} />,
  faces: (p) => [{ id: 'frame', name: 'Wood', width: num(p, 'width'), height: num(p, 'height') }],
};

// --- Chandelier --------------------------------------------------------------------------

function Chandelier({ p }: { p: Params }) {
  const [dia, tiers, drop] = [num(p, 'diameter'), Math.round(num(p, 'tiers')), num(p, 'drop')];
  const body = 0.9;
  const bulbs = useMemo(() => {
    const pos: THREE.Vector3[] = [];
    for (let t = 0; t < tiers; t++) {
      const r = (dia / 2) * (1 - t * 0.3);
      const y = 0.15 + t * (body / tiers);
      const n = Math.max(6, Math.round(r * 14));
      for (let i = 0; i < n; i++) pos.push(new THREE.Vector3(r * Math.cos((i / n) * Math.PI * 2), y + 0.06, r * Math.sin((i / n) * Math.PI * 2)));
    }
    return pos;
  }, [dia, tiers]);
  const mat = useMemo(() => glowMat(str(p, 'bulbColor'), 1.9), [p]);
  const inst = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), mat, bulbs.length);
    const o = new THREE.Object3D();
    bulbs.forEach((b, i) => {
      o.position.copy(b);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    return m;
  }, [bulbs, mat]);
  useEffect(() => () => inst.geometry.dispose(), [inst]);
  const metal = str(p, 'metal');
  return (
    <group>
      {/* Chain up to where it hangs from */}
      <mesh position={[0, body + drop / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, drop, 6]} />
        <meshStandardMaterial color={metal} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, body / 2, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.06, body, 10]} />
        <FaceMat face="metal" color={metal} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshStandardMaterial color={metal} metalness={0.8} roughness={0.3} />
      </mesh>
      {Array.from({ length: tiers }, (_, t) => {
        const r = (dia / 2) * (1 - t * 0.3);
        return (
          <mesh key={t} position={[0, 0.15 + t * (body / tiers), 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[r, 0.018, 6, 48]} />
            <meshStandardMaterial color={metal} metalness={0.8} roughness={0.3} />
          </mesh>
        );
      })}
      <primitive object={inst} />
    </group>
  );
}

export const chandelierObject: SetObjectType = {
  id: 'chandelier',
  name: 'Chandelier',
  category: 'Props',
  icon: (
    <Icon>
      <path d="M12 2v5M5 11a7 3 0 0 0 14 0M8 14a4 2 0 0 0 8 0M5 11v2M19 11v2M12 7v9" />
    </Icon>
  ),
  placement: 'hanging',
  defaultElevation: 3.6,
  hangGap: 0,
  params: [len('diameter', 'Diameter', 1.2, 0.3, 5), count('tiers', 'Tiers', 2, 1, 3), len('drop', 'Chain length', 0.8, 0.1, 6), colour('bulbColor', 'Bulb colour', '#ffd9a0'), colour('metal', 'Metal', '#c9a24a')],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'diameter'), depth: num(p, 'diameter'), height: 0.9 + num(p, 'drop') }),
  resize: { width: 'diameter' },
  build: (p) => <Chandelier p={p} />,
  faces: (p) => [{ id: 'metal', name: 'Metal', width: num(p, 'diameter'), height: 0.9 }],
};

// --- Picture frame -----------------------------------------------------------------------

export const pictureFrameObject: SetObjectType = {
  id: 'picture-frame',
  name: 'Picture frame',
  category: 'Props',
  icon: (
    <Icon>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M7 16l4-5 3 3 2-2 2 4" />
    </Icon>
  ),
  placement: 'wall',
  elevationParam: 'hangHeight',
  params: [len('width', 'Width', 0.8, 0.15, 6), len('height', 'Height', 1, 0.15, 6), len('border', 'Frame width', 0.07, 0.01, 0.4), len('hangHeight', 'Hanging height', 1.4, 0, 8), colour('frameColor', 'Frame colour', '#b8862f')],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.05, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => {
    const [w, h, b] = [num(p, 'width'), num(p, 'height'), num(p, 'border')];
    const fc = str(p, 'frameColor');
    return (
      <group>
        <Cube at={[0, b / 2, 0]} size={[w, b, 0.05]} color={fc} face="frame" />
        <Cube at={[0, h - b / 2, 0]} size={[w, b, 0.05]} color={fc} face="frame" />
        <Cube at={[-w / 2 + b / 2, h / 2, 0]} size={[b, h, 0.05]} color={fc} face="frame" />
        <Cube at={[w / 2 - b / 2, h / 2, 0]} size={[b, h, 0.05]} color={fc} face="frame" />
        <mesh position={[0, h / 2, 0.005]}>
          <planeGeometry args={[w - 2 * b, h - 2 * b]} />
          <FaceMat face="picture" color="#8a7a62" roughness={0.6} />
        </mesh>
      </group>
    );
  },
  faces: (p) => [
    { id: 'picture', name: 'Picture', width: num(p, 'width') - 2 * num(p, 'border'), height: num(p, 'height') - 2 * num(p, 'border') },
    { id: 'frame', name: 'Frame', width: num(p, 'width'), height: num(p, 'height') },
  ],
};

// --- Ladder ------------------------------------------------------------------------------

export const ladderObject: SetObjectType = {
  id: 'ladder',
  name: 'Ladder',
  category: 'Props',
  icon: (
    <Icon>
      <path d="M7 2v20M17 2v20M7 6h10M7 10h10M7 14h10M7 18h10" />
    </Icon>
  ),
  placement: 'floor',
  params: [len('width', 'Width', 0.5, 0.3, 1.5), len('height', 'Height', 3, 0.6, 10), colour('color', 'Colour', '#d8dde4')],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.08, height: num(p, 'height') }),
  build: (p) => {
    const [w, h, c] = [num(p, 'width'), num(p, 'height'), str(p, 'color')];
    const rungs = Math.max(2, Math.floor(h / 0.3));
    return (
      <group>
        <Cube at={[-w / 2, h / 2, 0]} size={[0.05, h, 0.06]} color={c} face="rails" />
        <Cube at={[w / 2, h / 2, 0]} size={[0.05, h, 0.06]} color={c} face="rails" />
        {Array.from({ length: rungs }, (_, i) => (
          <Cube key={i} at={[0, ((i + 0.5) * h) / rungs, 0]} size={[w, 0.03, 0.04]} color={c} face="rails" />
        ))}
      </group>
    );
  },
  faces: (p) => [{ id: 'rails', name: 'Ladder', width: num(p, 'width'), height: num(p, 'height') }],
};

export const showpieceObjects = [neonSignObject, bulbFrameObject, ledRingObject, arcPlatformObject, bookshelfObject, chandelierObject, pictureFrameObject, ladderObject];
