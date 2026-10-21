/**
 * Props — simple, low-poly, neutral grey pieces for scale and layout:
 * furniture, people, audio gear and a drum riser. Each has a few params and
 * a face for colour or graphics where it makes sense.
 */
import type { Params } from '../../types';
import { bool, num, str } from '../../helpers/params';
import { Icon, type BoxFaces } from '../common';
import type { SetObjectType } from '../types';
import { Figure, PROP, PROP_DARK, PROP_LIGHT, PropMat } from './shared';

type Size3 = [number, number, number];

/** Box with optional named faces (three.js order: +X, -X, +Y top, -Y, +Z front, -Z back). */
function B({ at, size, color = PROP, faces }: { at: Size3; size: Size3; color?: string; faces?: BoxFaces }) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      {(['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const).map((k, i) => (
        <PropMat key={k} attach={`material-${i}`} color={color} face={faces?.[k]} />
      ))}
    </mesh>
  );
}
/** Cylinder with optional named side and top faces. */
function Cyl({ at, r, h, color = PROP, rTop, rotX = 0, seg = 24, side, top }: { at: Size3; r: number; h: number; color?: string; rTop?: number; rotX?: number; seg?: number; side?: string; top?: string }) {
  return (
    <mesh position={at} rotation-x={rotX} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, seg]} />
      <PropMat attach="material-0" color={color} face={side} />
      <PropMat attach="material-1" color={color} face={top} />
      <PropMat attach="material-2" color={color} />
    </mesh>
  );
}

const sel = (key: string, label: string, options: [string, string][], def: string, group = 'Options') =>
  ({ key, label, group, type: 'select' as const, default: def, options: options.map(([value, l]) => ({ value, label: l })) });
const len = (key: string, label: string, def: number, min: number, max: number, group = 'Size') =>
  ({ key, label, group, type: 'number' as const, default: def, min, max, step: 0.05 });

// --- Furniture ------------------------------------------------------------------

export const chairObject: SetObjectType = {
  id: 'chair',
  name: 'Chair',
  category: 'Props',
  icon: <Icon><path d="M7 3v9h10V3M6 12h12M7 12v9M17 12v9" /></Icon>,
  placement: 'floor',
  params: [sel('style', 'Style', [['simple', 'Simple'], ['armchair', 'Armchair']], 'simple'), len('width', 'Seat width', 0.5, 0.35, 1.2), len('seatHeight', 'Seat height', 0.45, 0.2, 1)],
  constraints: (p) => p,
  size: (p) => {
    const w = num(p, 'width') * (str(p, 'style') === 'armchair' ? 1.5 : 1);
    return { width: w, depth: num(p, 'width') * (str(p, 'style') === 'armchair' ? 1.5 : 1), height: num(p, 'seatHeight') + 0.45 };
  },
  resize: (p) => ({ width: { key: 'width', scale: str(p, 'style') === 'armchair' ? 1 / 1.5 : 1 } }),
  build: (p) => {
    const w = num(p, 'width');
    const sh = num(p, 'seatHeight');
    if (str(p, 'style') === 'armchair') {
      const W = w * 1.5;
      return (
        <>
          <B at={[0, sh / 2, 0.05]} size={[W, sh, W - 0.1]} faces={{ py: 'seat' }} />
          <B at={[0, sh + 0.25, -W / 2 + 0.1]} size={[W, 0.5, 0.2]} color={PROP_DARK} faces={{ pz: 'back' }} />
          {[-1, 1].map((s) => <B key={s} at={[s * (W / 2 - 0.08), sh + 0.12, 0.05]} size={[0.16, 0.24, W - 0.1]} color={PROP_DARK} />)}
        </>
      );
    }
    return (
      <>
        <B at={[0, sh, 0]} size={[w, 0.05, w]} faces={{ py: 'seat' }} />
        <B at={[0, sh + 0.25, -w / 2 + 0.02]} size={[w, 0.45, 0.04]} color={PROP_DARK} faces={{ pz: 'back' }} />
        {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z], i) => <B key={i} at={[(x * (w - 0.05)) / 2, sh / 2, (z * (w - 0.05)) / 2]} size={[0.035, sh, 0.035]} color={PROP_DARK} />)}
      </>
    );
  },
  faces: (p) => [
    { id: 'seat', name: 'Seat', width: num(p, 'width'), height: num(p, 'width') },
    { id: 'back', name: 'Back', width: num(p, 'width'), height: 0.45 },
  ],
};

const round = (p: Params) => str(p, 'shape') === 'round';
export const tableObject: SetObjectType = {
  id: 'table',
  name: 'Table',
  category: 'Props',
  icon: <Icon><path d="M3 9h18M5 9v11M19 9v11M3 9l2-3h14l2 3" /></Icon>,
  placement: 'floor',
  params: [
    sel('shape', 'Shape', [['rect', 'Rectangular'], ['round', 'Round']], 'rect'),
    { ...len('width', 'Width', 1.6, 0.4, 6), visible: (p: Params) => !round(p) },
    { ...len('depth', 'Depth', 0.8, 0.4, 3), visible: (p: Params) => !round(p) },
    { ...len('diameter', 'Diameter', 1.2, 0.4, 4), visible: round },
    len('height', 'Height', 0.75, 0.3, 1.2),
  ],
  constraints: (p) => p,
  size: (p) => (round(p) ? { width: num(p, 'diameter'), depth: num(p, 'diameter'), height: num(p, 'height') } : { width: num(p, 'width'), depth: num(p, 'depth'), height: num(p, 'height') }),
  resize: (p) => (round(p) ? { width: 'diameter', depth: 'diameter' } : { width: 'width', depth: 'depth' }),
  build: (p) => {
    const h = num(p, 'height');
    if (round(p)) {
      const d = num(p, 'diameter');
      return (
        <>
          <Cyl at={[0, h - 0.02, 0]} r={d / 2} h={0.04} seg={48} color={PROP_LIGHT} top="top" />
          <Cyl at={[0, (h - 0.04) / 2, 0]} r={0.05} h={h - 0.04} color={PROP_DARK} />
          <Cyl at={[0, 0.015, 0]} r={Math.min(0.3, d / 3)} h={0.03} color={PROP_DARK} />
        </>
      );
    }
    const [w, d] = [num(p, 'width'), num(p, 'depth')];
    return (
      <>
        <B at={[0, h - 0.02, 0]} size={[w, 0.04, d]} color={PROP_LIGHT} faces={{ py: 'top' }} />
        {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z], i) => <B key={i} at={[(x * (w - 0.1)) / 2, (h - 0.04) / 2, (z * (d - 0.1)) / 2]} size={[0.05, h - 0.04, 0.05]} color={PROP_DARK} />)}
      </>
    );
  },
  faces: (p) => [{ id: 'top', name: 'Top', width: round(p) ? num(p, 'diameter') : num(p, 'width'), height: round(p) ? num(p, 'diameter') : num(p, 'depth') }],
};

export const sofaObject: SetObjectType = {
  id: 'sofa',
  name: 'Sofa',
  category: 'Props',
  icon: <Icon><path d="M4 10V7h16v3M2 10h4v4h12v-4h4v7H2zM5 17v2M19 17v2" /></Icon>,
  placement: 'floor',
  params: [len('width', 'Width', 2, 1, 4), len('depth', 'Depth', 0.9, 0.6, 1.5), len('height', 'Back height', 0.85, 0.6, 1.2)],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'depth'), height: num(p, 'height') }),
  resize: { width: 'width', depth: 'depth' },
  build: (p) => {
    const [w, d, h] = [num(p, 'width'), num(p, 'depth'), num(p, 'height')];
    return (
      <>
        <B at={[0, 0.21, 0.05]} size={[w - 0.3, 0.42, d - 0.1]} faces={{ pz: 'front' }} />
        <B at={[0, h / 2, -d / 2 + 0.11]} size={[w, h, 0.22]} color={PROP_DARK} />
        {[-1, 1].map((s) => <B key={s} at={[s * (w / 2 - 0.08), 0.31, 0]} size={[0.16, 0.62, d]} color={PROP_DARK} />)}
      </>
    );
  },
  faces: (p) => [{ id: 'front', name: 'Front', width: num(p, 'width'), height: 0.42 }],
};

const BED_W: Record<string, number> = { single: 0.9, double: 1.4, king: 1.8 };
export const bedObject: SetObjectType = {
  id: 'bed',
  name: 'Bed',
  category: 'Props',
  icon: <Icon><path d="M3 18V7M3 13h18v5M21 13v-2a2 2 0 0 0-2-2H9v4M5 10h3v3" /></Icon>,
  placement: 'floor',
  params: [sel('bedSize', 'Size', [['single', 'Single (0.9 m)'], ['double', 'Double (1.4 m)'], ['king', 'King (1.8 m)']], 'double'), len('length', 'Length', 2, 1.6, 2.4)],
  constraints: (p) => p,
  size: (p) => ({ width: BED_W[str(p, 'bedSize')] + 0.1, depth: num(p, 'length') + 0.08, height: 1 }),
  build: (p) => {
    const w = BED_W[str(p, 'bedSize')];
    const l = num(p, 'length');
    return (
      <>
        <B at={[0, 0.15, 0.04]} size={[w + 0.1, 0.3, l]} color={PROP_DARK} />
        <B at={[0, 0.41, 0.04]} size={[w, 0.22, l - 0.04]} color={PROP_LIGHT} faces={{ py: 'cover' }} />
        <B at={[0, 0.58, -l / 2 + 0.3]} size={[w * 0.8, 0.12, 0.4]} />
        <B at={[0, 0.5, -l / 2 + 0.02]} size={[w + 0.1, 1, 0.06]} color={PROP_DARK} faces={{ pz: 'headboard' }} />
      </>
    );
  },
  faces: (p) => [
    { id: 'cover', name: 'Cover', width: BED_W[str(p, 'bedSize')], height: num(p, 'length') },
    { id: 'headboard', name: 'Headboard', width: BED_W[str(p, 'bedSize')] + 0.1, height: 1 },
  ],
};

export const lecternObject: SetObjectType = {
  id: 'lectern',
  name: 'Lectern / podium',
  category: 'Props',
  icon: <Icon><path d="M6 6h12l-1 3H7zM8 9h8v12H8zM6 21h12" /></Icon>,
  placement: 'floor',
  params: [len('width', 'Width', 0.6, 0.4, 1.5), len('height', 'Height', 1.15, 0.8, 1.4)],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: 0.5, height: num(p, 'height') }),
  resize: { width: 'width' },
  build: (p) => {
    const [w, h] = [num(p, 'width'), num(p, 'height')];
    return (
      <>
        <B at={[0, (h - 0.1) / 2, 0]} size={[w, h - 0.1, 0.42]} faces={{ pz: 'front' }} />
        {/* Sloped reading top, rising towards the speaker (back) */}
        <mesh position={[0, h - 0.05, 0]} rotation-x={-0.25} castShadow>
          <boxGeometry args={[w + 0.04, 0.03, 0.5]} />
          <PropMat color={PROP_DARK} />
        </mesh>
      </>
    );
  },
  faces: (p) => [{ id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') - 0.1 }],
};

export const stoolObject: SetObjectType = {
  id: 'stool',
  name: 'Stool',
  category: 'Props',
  icon: <Icon><ellipse cx="12" cy="5" rx="5" ry="1.8" /><path d="M8 6l-2 15M16 6l2 15M12 7v14M7 15h10" /></Icon>,
  placement: 'floor',
  params: [len('height', 'Height', 0.75, 0.4, 1)],
  constraints: (p) => p,
  size: (p) => ({ width: 0.42, depth: 0.42, height: num(p, 'height') }),
  build: (p) => {
    const h = num(p, 'height');
    return (
      <>
        <Cyl at={[0, h - 0.03, 0]} r={0.18} h={0.06} color={PROP_LIGHT} top="seat" />
        {[0, 1, 2].map((i) => {
          const a = (i * Math.PI * 2) / 3;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.12, (h - 0.06) / 2, Math.cos(a) * 0.12]} rotation={[Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12]} castShadow>
              <cylinderGeometry args={[0.015, 0.015, h - 0.06, 8]} />
              <PropMat color={PROP_DARK} />
            </mesh>
          );
        })}
        <mesh position-y={h * 0.35} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.15, 0.01, 6, 24]} />
          <PropMat color={PROP_DARK} />
        </mesh>
      </>
    );
  },
  faces: () => [{ id: 'seat', name: 'Seat', width: 0.36, height: 0.36 }],
};

export const plantObject: SetObjectType = {
  id: 'plant',
  name: 'Plant',
  category: 'Props',
  icon: <Icon><path d="M8 15h8l-1 6H9zM12 15V8M12 10c-3 0-5-2-5-5 3 0 5 2 5 5zM12 9c0-3 2-5 5-5 0 3-2 5-5 5z" /></Icon>,
  placement: 'floor',
  params: [len('height', 'Height', 1.2, 0.3, 3), len('pot', 'Pot diameter', 0.4, 0.15, 1)],
  constraints: (p) => p,
  size: (p) => ({ width: Math.max(num(p, 'pot'), num(p, 'height') * 0.6), depth: Math.max(num(p, 'pot'), num(p, 'height') * 0.6), height: num(p, 'height') }),
  build: (p) => {
    const [h, d] = [num(p, 'height'), num(p, 'pot')];
    const potH = Math.min(d * 1.1, h * 0.35);
    const r = h * 0.3;
    // A few overlapping low-poly blobs for the foliage.
    const blobs: Size3[] = [[0, h - r, 0], [r * 0.45, h - r * 1.5, r * 0.2], [-r * 0.45, h - r * 1.4, -r * 0.15], [0.05, h - r * 1.7, -r * 0.4]];
    return (
      <>
        <Cyl at={[0, potH / 2, 0]} r={d * 0.4} rTop={d / 2} h={potH} color={PROP_DARK} side="pot" />
        <Cyl at={[0, (potH + h - r) / 2, 0]} r={0.02} h={h - r - potH} color={PROP_DARK} seg={6} />
        {blobs.map((b, i) => (
          <mesh key={i} position={b} castShadow>
            <icosahedronGeometry args={[r * (i ? 0.7 : 1), 0]} />
            <meshStandardMaterial color="#9ea59c" roughness={0.9} flatShading />
          </mesh>
        ))}
      </>
    );
  },
  faces: (p) => [{ id: 'pot', name: 'Pot', width: Math.PI * num(p, 'pot'), height: Math.min(num(p, 'pot') * 1.1, num(p, 'height') * 0.35) }],
};

// --- People -----------------------------------------------------------------------

export const standingPersonObject: SetObjectType = {
  id: 'person-standing',
  name: 'Standing person',
  category: 'Props',
  icon: <Icon><circle cx="12" cy="4" r="2" /><path d="M12 7v7M8 9l4-1 4 1M10 21l2-7 2 7" /></Icon>,
  placement: 'floor',
  params: [len('height', 'Height', 1.7, 1, 2.2)],
  constraints: (p) => p,
  size: (p) => ({ width: 0.6 * (num(p, 'height') / 1.75), depth: 0.3, height: num(p, 'height') }),
  build: (p) => <Figure height={num(p, 'height')} />,
  faces: () => [],
};

export const seatedPersonObject: SetObjectType = {
  id: 'person-seated',
  name: 'Seated person',
  category: 'Props',
  icon: <Icon><circle cx="10" cy="4" r="2" /><path d="M10 7v6h6v8M6 9l4-1M7 21h3" /></Icon>,
  placement: 'floor',
  params: [len('height', 'Standing height', 1.7, 1, 2.2), { key: 'withSeat', label: 'Include a seat', group: 'Options', type: 'boolean', default: true }],
  constraints: (p) => p,
  size: (p) => ({ width: 0.6 * (num(p, 'height') / 1.75), depth: 0.65, height: 0.45 + 0.07 + 0.52 * (num(p, 'height') / 1.75) + 0.32 * (num(p, 'height') / 1.75) }),
  build: (p) => (
    <group position-z={-0.15}>
      <Figure height={num(p, 'height')} seated />
      {bool(p, 'withSeat') && <B at={[0, 0.22, 0.05]} size={[0.45, 0.44, 0.45]} color={PROP_LIGHT} />}
    </group>
  ),
  faces: () => [],
};

// --- Audio and band ---------------------------------------------------------------

export const micStandObject: SetObjectType = {
  id: 'mic-stand',
  name: 'Microphone stand',
  category: 'Props',
  icon: <Icon><rect x="10" y="2" width="4" height="6" rx="2" /><path d="M12 8v13M8 21h8" /></Icon>,
  placement: 'floor',
  params: [len('height', 'Height', 1.5, 0.6, 2), { key: 'boom', label: 'Boom arm', group: 'Options', type: 'boolean', default: false }],
  constraints: (p) => p,
  size: (p) => ({ width: 0.5, depth: bool(p, 'boom') ? 0.8 : 0.5, height: num(p, 'height') + 0.1 }),
  build: (p) => {
    const h = num(p, 'height');
    const boom = bool(p, 'boom');
    const top = boom ? h - 0.25 : h;
    return (
      <>
        <Cyl at={[0, 0.015, 0]} r={0.15} h={0.03} color={PROP_DARK} />
        <Cyl at={[0, top / 2, 0]} r={0.012} h={top} color={PROP_DARK} seg={8} />
        {boom ? (
          <group position={[0, top, 0]} rotation-x={-1.0}>
            <Cyl at={[0, 0.3, 0]} r={0.01} h={0.6} color={PROP_DARK} seg={8} />
            <Cyl at={[0, 0.66, 0]} r={0.022} h={0.13} color={PROP} />
          </group>
        ) : (
          <Cyl at={[0, h + 0.05, 0.03]} r={0.022} h={0.13} color={PROP} rotX={0.4} />
        )}
      </>
    );
  },
  faces: () => [],
};

const SPK: Record<string, Size3> = { small: [0.35, 0.55, 0.32], medium: [0.5, 0.8, 0.45], large: [0.65, 1.2, 0.55] };
export const speakerObject: SetObjectType = {
  id: 'speaker',
  name: 'Speaker',
  category: 'Props',
  icon: <Icon><rect x="6" y="2" width="12" height="20" rx="1" /><circle cx="12" cy="15" r="3.5" /><circle cx="12" cy="7" r="1.5" /></Icon>,
  placement: 'floor',
  params: [sel('speakerSize', 'Size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], 'medium'), sel('kind', 'Type', [['box', 'Cabinet'], ['wedge', 'Floor wedge (monitor)']], 'box')],
  constraints: (p) => p,
  size: (p) => {
    const [w, h, d] = SPK[str(p, 'speakerSize')];
    return str(p, 'kind') === 'wedge' ? { width: w * 1.3, depth: h * 0.7, height: d * 0.9 } : { width: w, depth: d, height: h };
  },
  build: (p) => {
    const [w, h, d] = SPK[str(p, 'speakerSize')];
    if (str(p, 'kind') === 'wedge') {
      // A monitor wedge lying on the floor, its front tilted up towards the performer (-Z).
      return (
        <group rotation-x={-0.6} position={[0, d * 0.45, 0]}>
          <B at={[0, 0, 0]} size={[w * 1.3, d * 0.6, h * 0.65]} color={PROP_DARK} />
        </group>
      );
    }
    return (
      <>
        <B at={[0, h / 2, 0]} size={[w, h, d]} color={PROP_DARK} faces={{ pz: 'front' }} />
        <Cyl at={[0, h * 0.35, d / 2]} r={w * 0.32} h={0.02} rotX={Math.PI / 2} color="#5f646b" />
        <Cyl at={[0, h * 0.78, d / 2]} r={w * 0.13} h={0.02} rotX={Math.PI / 2} color="#5f646b" />
      </>
    );
  },
  faces: (p) => [{ id: 'front', name: 'Front', width: SPK[str(p, 'speakerSize')][0], height: SPK[str(p, 'speakerSize')][1] }],
};

export const drumRiserObject: SetObjectType = {
  id: 'drum-riser',
  name: 'Drum riser',
  category: 'Props',
  icon: <Icon><path d="M3 18h18v3H3zM7 18v-4a5 3 0 0 1 10 0v4M5 9h5M14 8h5" /></Icon>,
  placement: 'floor',
  params: [len('width', 'Width', 2.4, 1.5, 4), len('depth', 'Depth', 2.4, 1.5, 4), len('height', 'Height', 0.4, 0.2, 1), { key: 'kit', label: 'Drum kit', group: 'Options', type: 'boolean', default: true }],
  constraints: (p) => p,
  size: (p) => ({ width: num(p, 'width'), depth: num(p, 'depth'), height: num(p, 'height') + (bool(p, 'kit') ? 1.1 : 0) }),
  resize: { width: 'width', depth: 'depth' },
  platformTop: (p) => num(p, 'height'),
  build: (p) => {
    const [w, d, h] = [num(p, 'width'), num(p, 'depth'), num(p, 'height')];
    return (
      <>
        <B at={[0, h / 2, 0]} size={[w, h, d]} color={PROP_LIGHT} faces={{ py: 'top', pz: 'front' }} />
        {bool(p, 'kit') && (
          <group position-y={h}>
            {/* Kick drum facing the audience, toms, snare, floor tom, cymbals, stool */}
            <Cyl at={[0, 0.28, 0.25]} r={0.28} h={0.4} rotX={Math.PI / 2} color={PROP} />
            <Cyl at={[-0.15, 0.68, 0.2]} r={0.13} h={0.16} rotX={-0.3} />
            <Cyl at={[0.15, 0.68, 0.2]} r={0.14} h={0.18} rotX={-0.3} />
            <Cyl at={[-0.45, 0.62, -0.05]} r={0.17} h={0.14} />
            <Cyl at={[0.5, 0.45, -0.05]} r={0.2} h={0.4} />
            {[[-0.7, 1.05, 0.2], [0.75, 1.1, 0.25], [-0.75, 0.85, -0.25]].map((c, i) => (
              <group key={i}>
                <Cyl at={c as Size3} r={0.22} h={0.01} color="#9c9277" />
                <Cyl at={[c[0], c[1] / 2, c[2]]} r={0.01} h={c[1]} color={PROP_DARK} seg={6} />
              </group>
            ))}
            <Cyl at={[0, 0.25, -0.5]} r={0.17} h={0.5} color={PROP_DARK} />
          </group>
        )}
      </>
    );
  },
  faces: (p) => [
    { id: 'top', name: 'Top', width: num(p, 'width'), height: num(p, 'depth') },
    { id: 'front', name: 'Front', width: num(p, 'width'), height: num(p, 'height') },
  ],
};

export const propObjects: SetObjectType[] = [
  chairObject,
  tableObject,
  sofaObject,
  bedObject,
  lecternObject,
  stoolObject,
  plantObject,
  standingPersonObject,
  seatedPersonObject,
  micStandObject,
  speakerObject,
  drumRiserObject,
];
