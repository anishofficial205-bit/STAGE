/**
 * Venue furniture: simple low-poly pieces for backstage and front-of-house
 * rooms. Local frame: centred on its footprint, front towards +z.
 */
import type { ReactNode } from 'react';

export interface FurnitureType {
  id: string;
  label: string;
  /** Footprint (m). */
  w: number;
  d: number;
  build: () => ReactNode;
}

const B = ({ at, size, color, rough = 0.8, metal = 0, emissive }: { at: [number, number, number]; size: [number, number, number]; color: string; rough?: number; metal?: number; emissive?: string }) => (
  <mesh position={at} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 0.8 : 0} />
  </mesh>
);

const WOOD = '#9a7350';
const DARK = '#3b3e44';
const STEEL = '#a9afb6';
const MIRROR = '#dfe9ef';
const FABRIC = '#5a6f8a';

function legs(w: number, d: number, h: number, color = DARK) {
  return [-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} at={[(sx * (w - 0.06)) / 2, h / 2, (sz * (d - 0.06)) / 2]} size={[0.04, h, 0.04]} color={color} />));
}

export const FURNITURE: FurnitureType[] = [
  {
    id: 'dressing-table',
    label: 'Dressing table with mirror',
    w: 1.2,
    d: 0.5,
    build: () => (
      <>
        <B at={[0, 0.74, 0]} size={[1.2, 0.04, 0.5]} color={WOOD} />
        {legs(1.2, 0.5, 0.72)}
        <B at={[0, 1.25, -0.23]} size={[1.0, 0.8, 0.03]} color={MIRROR} rough={0.05} metal={0.9} />
        {[-0.45, -0.15, 0.15, 0.45].map((x) => (
          <B key={x} at={[x, 1.68, -0.22]} size={[0.06, 0.06, 0.06]} color="#fff6d8" emissive="#ffe9a8" />
        ))}
      </>
    ),
  },
  {
    id: 'chair',
    label: 'Chair',
    w: 0.45,
    d: 0.45,
    build: () => (
      <>
        <B at={[0, 0.45, 0]} size={[0.45, 0.04, 0.45]} color={DARK} />
        {legs(0.45, 0.45, 0.44)}
        <B at={[0, 0.7, -0.21]} size={[0.45, 0.5, 0.03]} color={DARK} />
      </>
    ),
  },
  {
    id: 'costume-rack',
    label: 'Costume rack',
    w: 1.5,
    d: 0.5,
    build: () => (
      <>
        {[-0.72, 0.72].map((x) => (
          <group key={x}>
            <B at={[x, 0.82, 0]} size={[0.03, 1.6, 0.03]} color={STEEL} metal={0.7} rough={0.4} />
            <B at={[x, 0.03, 0]} size={[0.05, 0.05, 0.5]} color={STEEL} metal={0.7} rough={0.4} />
          </group>
        ))}
        <B at={[0, 1.6, 0]} size={[1.5, 0.03, 0.03]} color={STEEL} metal={0.7} rough={0.4} />
        {['#b23a48', '#3c6e71', '#e2b13c', '#5b4b8a', '#2f4858', '#c06c84'].map((c, i) => (
          <B key={c} at={[-0.55 + i * 0.22, 1.12, 0]} size={[0.06, 0.9, 0.42]} color={c} rough={1} />
        ))}
      </>
    ),
  },
  {
    id: 'sofa',
    label: 'Sofa',
    w: 2,
    d: 0.9,
    build: () => (
      <>
        <B at={[0, 0.22, 0.05]} size={[2, 0.36, 0.8]} color={FABRIC} rough={1} />
        <B at={[0, 0.6, -0.35]} size={[2, 0.5, 0.2]} color={FABRIC} rough={1} />
        {[-0.92, 0.92].map((x) => (
          <B key={x} at={[x, 0.5, 0.05]} size={[0.16, 0.28, 0.8]} color={FABRIC} rough={1} />
        ))}
      </>
    ),
  },
  {
    id: 'lockers',
    label: 'Lockers',
    w: 1.2,
    d: 0.5,
    build: () => (
      <>
        <B at={[0, 0.95, 0]} size={[1.2, 1.9, 0.5]} color="#7f8c99" metal={0.4} rough={0.5} />
        {[-0.4, 0, 0.4].map((x) => (
          <B key={x} at={[x, 0.95, 0.252]} size={[0.36, 1.8, 0.01]} color="#8d9aa7" metal={0.4} rough={0.5} />
        ))}
      </>
    ),
  },
  {
    id: 'sink',
    label: 'Sink',
    w: 0.6,
    d: 0.45,
    build: () => (
      <>
        <B at={[0, 0.42, 0]} size={[0.6, 0.84, 0.45]} color="#e8e6e1" />
        <B at={[0, 0.85, 0.02]} size={[0.45, 0.03, 0.32]} color="#c9ced3" metal={0.6} rough={0.3} />
        <B at={[0, 0.95, -0.18]} size={[0.04, 0.18, 0.04]} color={STEEL} metal={0.9} rough={0.2} />
      </>
    ),
  },
  {
    id: 'mirror-wall',
    label: 'Mirror wall',
    w: 3,
    d: 0.08,
    build: () => (
      <>
        <B at={[0, 1.3, 0]} size={[3, 2, 0.03]} color={MIRROR} rough={0.03} metal={1} />
        <B at={[0, 1, 0.04]} size={[3, 0.04, 0.04]} color={WOOD} />
      </>
    ),
  },
  {
    id: 'control-desk',
    label: 'Control desk',
    w: 2.4,
    d: 0.9,
    build: () => (
      <>
        <B at={[0, 0.74, 0]} size={[2.4, 0.05, 0.9]} color={DARK} />
        {legs(2.4, 0.9, 0.72)}
        <mesh position={[-0.5, 0.82, 0.05]} rotation-x={-0.25} castShadow>
          <boxGeometry args={[1, 0.08, 0.55]} />
          <meshStandardMaterial color="#25272b" roughness={0.6} />
        </mesh>
        <B at={[0.7, 1.0, -0.25]} size={[0.6, 0.38, 0.04]} color="#15171a" emissive="#2b4c7e" />
      </>
    ),
  },
  {
    id: 'ticket-counter',
    label: 'Ticket counter',
    w: 2.4,
    d: 0.7,
    build: () => (
      <>
        <B at={[0, 0.55, 0]} size={[2.4, 1.1, 0.7]} color={WOOD} />
        <B at={[0, 1.12, 0]} size={[2.5, 0.04, 0.8]} color="#e9e5dc" />
        <B at={[0, 1.4, -0.3]} size={[2.3, 0.5, 0.02]} color="#d6e8f2" rough={0.05} />
      </>
    ),
  },
];

export const getFurniture = (id: string) => FURNITURE.find((f) => f.id === id);
