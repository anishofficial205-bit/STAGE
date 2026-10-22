/**
 * The venue in 3D: walls extruded from the plan, updating live as it changes.
 * Cut-away lowers every wall to 1 m so you can look into the rooms from above.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useProjectStore } from '../../store/useProjectStore';
import { wallPolygon } from '../../venue/geometry';
import { WALL_MATERIALS, type Pt, type Wall } from '../../venue/types';
import { useVenueUI } from '../../venue/ui';

const CUTAWAY = 1;

export function prism(poly: Pt[], height: number, y0 = 0) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  if (y0) g.translate(0, y0, 0);
  return g;
}

function WallMesh({ wall, poly, height, selected, active }: { wall: Wall; poly: Pt[]; height: number; selected: boolean; active: boolean }) {
  const geometry = useMemo(() => prism(poly, height), [poly, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const m = WALL_MATERIALS[wall.material] ?? WALL_MATERIALS.plaster;
  const pick = active
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return;
          e.stopPropagation();
          useVenueUI.getState().select({ kind: 'wall', id: wall.id });
        },
        onPointerOver: () => (document.body.style.cursor = 'pointer'),
        onPointerOut: () => (document.body.style.cursor = ''),
      }
    : {};
  return (
    <mesh geometry={geometry} castShadow receiveShadow userData={{ venueWall: wall.id }} {...pick}>
      <meshStandardMaterial
        color={m.color}
        roughness={wall.material === 'glass' ? 0.1 : 0.9}
        transparent={wall.material === 'glass'}
        opacity={wall.material === 'glass' ? 0.35 : 1}
        emissive={selected ? '#2f6fde' : '#000000'}
        emissiveIntensity={selected ? 0.45 : 0}
      />
    </mesh>
  );
}

export function VenueLayer() {
  const walls = useProjectStore((s) => s.venue.walls);
  const active = useProjectStore((s) => s.mode === 'venue');
  const cutaway = useVenueUI((s) => s.cutaway);
  const selected = useVenueUI((s) => (s.selected?.kind === 'wall' ? s.selected.id : null));
  const polys = useMemo(() => walls.map((w) => ({ w, poly: wallPolygon(walls, w) })), [walls]);
  return (
    <group>
      {polys.map(({ w, poly }) => (
        <WallMesh key={w.id} wall={w} poly={poly} height={cutaway ? Math.min(CUTAWAY, w.height) : w.height} selected={active && selected === w.id} active={active} />
      ))}
    </group>
  );
}
