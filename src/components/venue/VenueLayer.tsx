/**
 * The venue in 3D: walls extruded from the plan (cut around door openings,
 * with a lintel over each), door leaves standing ajar, room floors and the
 * furniture — all updating live as the plan changes. Cut-away lowers every
 * wall to 1 m so you can look into the rooms from above.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useProjectStore } from '../../store/useProjectStore';
import { doorSpan, wallFrame, wallPieces } from '../../venue/geometry';
import { FLOOR_MATERIALS, WALL_MATERIALS, type Door, type Furniture, type Pt, type Wall } from '../../venue/types';
import { useVenueUI, type VenueSelection } from '../../venue/ui';
import { roomOutline } from '../../venue/rooms';
import { getFurniture } from '../../venue/furniture';

const CUTAWAY = 1;
const ACCENT = '#f27a35';
/** Door leaves are drawn open by this much so the opening reads. */
const AJAR = (70 * Math.PI) / 180;

export function prism(poly: Pt[], height: number, y0 = 0) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.005, height), bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  if (y0) g.translate(0, y0, 0);
  return g;
}

/** Click handlers that select `sel` in Venue mode. */
function usePick(sel: NonNullable<VenueSelection>, active: boolean) {
  if (!active) return {};
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 4) return;
      e.stopPropagation();
      useVenueUI.getState().select(sel);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => (document.body.style.cursor = ''),
  };
}

function Prism({ poly, height, y0 = 0, color, selected, pick, glass, userData }: { poly: Pt[]; height: number; y0?: number; color: string; selected: boolean; pick: object; glass?: boolean; userData?: object }) {
  const geometry = useMemo(() => prism(poly, height, y0), [poly, height, y0]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow={!glass} receiveShadow userData={userData} {...pick}>
      <meshStandardMaterial color={color} roughness={glass ? 0.1 : 0.9} transparent={glass} opacity={glass ? 0.35 : 1} emissive={selected ? ACCENT : '#000000'} emissiveIntensity={selected ? 0.45 : 0} />
    </mesh>
  );
}

function WallView({ wall, walls, doors, cutaway, selected, active }: { wall: Wall; walls: Wall[]; doors: Door[]; cutaway: boolean; selected: boolean; active: boolean }) {
  const { solids, openings } = useMemo(() => wallPieces(walls, wall, doors), [walls, wall, doors]);
  const pick = usePick({ kind: 'wall', id: wall.id }, active);
  const m = WALL_MATERIALS[wall.material] ?? WALL_MATERIALS.plaster;
  const top = cutaway ? Math.min(CUTAWAY, wall.height) : wall.height;
  return (
    <>
      {solids.map((poly, i) => (
        <Prism key={i} poly={poly} height={top} color={m.color} selected={selected} pick={pick} glass={wall.material === 'glass'} userData={{ venueWall: wall.id }} />
      ))}
      {/* Lintels over the doors. */}
      {openings.map((o) => {
        const d = doors.find((x) => x.id === o.id)!;
        return d.height < top - 0.02 ? <Prism key={o.id} poly={o.poly} y0={d.height} height={top - d.height} color={m.color} selected={selected} pick={pick} glass={wall.material === 'glass'} userData={{ venueWall: wall.id }} /> : null;
      })}
    </>
  );
}

function DoorView({ door, wall, selected, active }: { door: Door; wall: Wall; selected: boolean; active: boolean }) {
  const pick = usePick({ kind: 'door', id: door.id }, active);
  if (door.kind === 'opening') return null;
  const [s0, s1] = doorSpan(wall, door);
  const leaves: { hinge: number; len: number; dir: 1 | -1 }[] =
    door.kind === 'double'
      ? [
          { hinge: s0, len: (s1 - s0) / 2, dir: 1 },
          { hinge: s1, len: (s1 - s0) / 2, dir: -1 },
        ]
      : [door.hinge === 'a' ? { hinge: s0, len: s1 - s0, dir: 1 } : { hinge: s1, len: s1 - s0, dir: -1 }];
  return (
    <>
      {leaves.map((l, i) => {
        const f = wallFrame(wall, l.hinge);
        const c: Pt = [f.d[0] * l.dir, f.d[1] * l.dir];
        const o: Pt = [f.n[0] * door.side, f.n[1] * door.side];
        const dir: Pt = [c[0] * Math.cos(AJAR) + o[0] * Math.sin(AJAR), c[1] * Math.cos(AJAR) + o[1] * Math.sin(AJAR)];
        const theta = Math.atan2(-dir[1], dir[0]);
        return (
          <group key={i} position={[f.at[0], 0, f.at[1]]} rotation-y={theta}>
            <mesh position={[l.len / 2, door.height / 2, 0]} castShadow userData={{ venueDoor: door.id }} {...pick}>
              <boxGeometry args={[l.len - 0.02, door.height - 0.02, 0.045]} />
              <meshStandardMaterial color={door.entrance ? '#4b5563' : '#8b6b4a'} roughness={0.7} emissive={selected ? ACCENT : '#000000'} emissiveIntensity={selected ? 0.5 : 0} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function FurnitureView({ item, selected, active }: { item: Furniture; selected: boolean; active: boolean }) {
  const f = getFurniture(item.type);
  const pick = usePick({ kind: 'furniture', id: item.id }, active);
  const built = useMemo(() => f?.build(), [f]);
  if (!f) return null;
  return (
    <group position={[item.x, 0, item.z]} rotation-y={(item.rotation * Math.PI) / 180} userData={{ venueFurniture: item.id }} {...pick}>
      {built}
      {selected && (
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[f.w + 0.06, 1.2, f.d + 0.06]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color={ACCENT} lineWidth={2} />
        </mesh>
      )}
    </group>
  );
}

export function VenueLayer() {
  const venue = useProjectStore((s) => s.venue);
  const active = useProjectStore((s) => s.mode === 'venue');
  const cutaway = useVenueUI((s) => s.cutaway);
  const selected = useVenueUI((s) => (active ? s.selected : null));
  const rooms = useMemo(() => venue.rooms.map((r) => ({ r, poly: roomOutline(venue.walls, r).polygon })), [venue.rooms, venue.walls]);
  const is = (kind: string, id: string) => selected?.kind === kind && selected.id === id;
  return (
    <group>
      {rooms.map(({ r, poly }) =>
        poly.length >= 3 ? <RoomFloor key={r.id} id={r.id} poly={poly} color={FLOOR_MATERIALS[r.floor]?.color ?? '#ccc'} selected={is('room', r.id)} active={active} /> : null,
      )}
      {venue.walls.map((w) => (
        <WallView key={w.id} wall={w} walls={venue.walls} doors={venue.doors} cutaway={cutaway} selected={is('wall', w.id)} active={active} />
      ))}
      {venue.doors.map((d) => {
        const w = venue.walls.find((x) => x.id === d.wallId);
        return w ? <DoorView key={d.id} door={d} wall={w} selected={is('door', d.id)} active={active} /> : null;
      })}
      {venue.furniture.map((f) => (
        <FurnitureView key={f.id} item={f} selected={is('furniture', f.id)} active={active} />
      ))}
    </group>
  );
}

function RoomFloor({ id, poly, color, selected, active }: { id: string; poly: Pt[]; color: string; selected: boolean; active: boolean }) {
  const pick = usePick({ kind: 'room', id }, active);
  return <Prism poly={poly} height={0.012} y0={0.002} color={color} selected={selected} pick={pick} userData={{ venueRoom: id }} />;
}
