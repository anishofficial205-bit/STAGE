import { useContext, useEffect, useMemo, useRef } from 'react';
import { SceneModeContext } from '../../components/StageScene';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Params } from '../../types';
import { bool, str } from '../../helpers/params';
import { DimensionLabel } from '../../helpers/DimensionLabel';
import { Seating } from '../../helpers/Seating';
import { Beam, Panel } from '../../helpers/primitives';
import { COLORS, ROUGHNESS } from '../../helpers/materials';
import { footprint, overlappingIds, roomOf, useBlackBoxUI, ROW_DEPTH, type BlackBoxData, type Block } from './blocks';
import { blockActions } from './actions';
import { useProjectStore } from '../../store/useProjectStore';

export const WALL_COLORS: Record<string, { wall: string; floor: string; grid: string }> = {
  black: { wall: '#2a2c30', floor: '#34363b', grid: '#1b1c1f' },
  'dark-grey': { wall: '#5a5e65', floor: '#45484e', grid: '#2a2c30' },
  white: { wall: '#e8e8e6', floor: '#bfc1c4', grid: '#6b7078' },
};

const SELECTED = '#f27a35';
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Click to select, drag across the floor to move (orbiting is paused while dragging). */
function useDrag(block: Block) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const drag = useRef<{ dx: number; dz: number } | null>(null);
  const hit = new THREE.Vector3();
  // Seating blocks belong to the Stage mode; elsewhere they're shown but can't be picked.
  const active = useProjectStore((s) => s.mode === 'set' && s.stageSelected);
  if (!active) return {};

  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      useBlackBoxUI.getState().select(block.id);
      useProjectStore.getState().select([]); // one selection at a time: blocks or set objects
      if (!e.ray.intersectPlane(floorPlane, hit)) return;
      drag.current = { dx: block.x - hit.x, dz: block.z - hit.z };
      (e.target as unknown as Element).setPointerCapture(e.pointerId);
      if (controls) controls.enabled = false;
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (!drag.current || !e.ray.intersectPlane(floorPlane, hit)) return;
      e.stopPropagation();
      blockActions.move(block.id, hit.x + drag.current.dx, hit.z + drag.current.dz);
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (!drag.current) return;
      drag.current = null;
      (e.target as unknown as Element).releasePointerCapture(e.pointerId);
      if (controls) controls.enabled = true;
    },
    onPointerOver: () => (document.body.style.cursor = 'grab'),
    onPointerOut: () => (document.body.style.cursor = ''),
  };
}

function Outline({ selected, overlap }: { selected: boolean; overlap: boolean }) {
  if (!selected && !overlap) return null;
  return <Edges color={overlap ? COLORS.overlay : SELECTED} lineWidth={selected ? 3 : 2} />;
}

export function PlatformView({ block, selected, overlap }: { block: Extract<Block, { kind: 'platform' }>; selected: boolean; overlap: boolean }) {
  const handlers = useDrag(block);
  return (
    <group position={[block.x, 0, block.z]} rotation-y={(block.rotation * Math.PI) / 180}>
      <mesh position-y={block.height / 2} castShadow receiveShadow {...handlers}>
        <boxGeometry args={[block.width, block.height, block.depth]} />
        <meshStandardMaterial color={COLORS.stageFloor} roughness={ROUGHNESS} />
        <Outline selected={selected} overlap={overlap} />
      </mesh>
    </group>
  );
}

export function SeatingView({ block, selected, overlap }: { block: Extract<Block, { kind: 'seating' }>; selected: boolean; overlap: boolean }) {
  const handlers = useDrag(block);
  const { w, d } = footprint(block);
  const h = (block.rows - 1) * block.rake + 1;
  return (
    <group position={[block.x, 0, block.z]} rotation-y={(block.rotation * Math.PI) / 180}>
      {/* Seats face the block's front (-Z) edge. */}
      <Seating rows={block.rows} seatsPerRow={block.seatsPerRow} firstRowDistance={0.5} rowSpacing={ROW_DEPTH} rise={block.rake} position={[0, 0, -d / 2]} />
      {/* Invisible box over the whole block to grab it by. */}
      <mesh position-y={h / 2} {...handlers}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Outline selected={selected} overlap={overlap} />
      </mesh>
    </group>
  );
}

function LightingGrid({ halfW, halfL, y, color }: { halfW: number; halfL: number; y: number; color: string }) {
  const step = 1.5;
  const xs = Array.from({ length: Math.floor((2 * halfW - 1) / step) + 1 }, (_, i) => -halfW + 0.5 + i * step);
  const zs = Array.from({ length: Math.floor((2 * halfL - 1) / step) + 1 }, (_, i) => -halfL + 0.5 + i * step);
  return (
    <>
      {xs.map((x) => (
        <Beam key={`x${x}`} from={[x, y, -halfL + 0.3]} to={[x, y, halfL - 0.3]} size={0.05} color={color} castShadow={false} />
      ))}
      {zs.map((z) => (
        <Beam key={`z${z}`} from={[-halfW + 0.3, y, z]} to={[halfW - 0.3, y, z]} size={0.05} color={color} castShadow={false} />
      ))}
    </>
  );
}

/** Keyboard for the selected block: Delete removes, R rotates 15° (Shift+R: 90°), Cmd/Ctrl+D duplicates, Esc deselects. */
export function useBlockKeys(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      const id = useBlackBoxUI.getState().selectedId;
      if (e.key === 'Escape') useBlackBoxUI.getState().select(null);
      if (!id) return;
      if (e.key === 'Delete' || e.key === 'Backspace') blockActions.remove(id);
      else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) blockActions.rotate(id, e.shiftKey ? 90 : 15);
      else if (e.key.toLowerCase() === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        blockActions.duplicate(id);
      } else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function BlackBoxScene({ p, data }: { p: Params; data: BlackBoxData }) {
  const room = roomOf(p);
  const { halfW, halfL, height } = room;
  const colors = WALL_COLORS[str(p, 'wallColour')] ?? WALL_COLORS.black;
  const selectedId = useBlackBoxUI((s) => s.selectedId);
  const overlap = useMemo(() => overlappingIds(data.blocks), [data.blocks]);

  useBlockKeys(!useContext(SceneModeContext).thumbnail);

  return (
    <group>
      {/* Floor: clicking empty floor (without dragging the view) deselects. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.004}
        receiveShadow
        onClick={(e) => {
          if (e.delta < 4) {
            useBlackBoxUI.getState().select(null);
            useProjectStore.getState().select([]);
          }
        }}
      >
        <planeGeometry args={[halfW * 2, halfL * 2]} />
        <meshStandardMaterial color={colors.floor} roughness={0.95} />
      </mesh>
      {/* Walls face inwards so you can always see in from outside. */}
      <Panel position={[0, height / 2, -halfL]} width={halfW * 2} height={height} color={colors.wall} oneSided />
      <Panel position={[0, height / 2, halfL]} rotationY={Math.PI} width={halfW * 2} height={height} color={colors.wall} oneSided />
      <Panel position={[-halfW, height / 2, 0]} rotationY={Math.PI / 2} width={halfL * 2} height={height} color={colors.wall} oneSided />
      <Panel position={[halfW, height / 2, 0]} rotationY={-Math.PI / 2} width={halfL * 2} height={height} color={colors.wall} oneSided />
      {bool(p, 'lightingGrid') && <LightingGrid halfW={halfW} halfL={halfL} y={height - 0.6} color={colors.grid} />}

      {data.blocks.map((b) =>
        b.kind === 'platform' ? (
          <PlatformView key={b.id} block={b} selected={b.id === selectedId} overlap={overlap.has(b.id)} />
        ) : (
          <SeatingView key={b.id} block={b} selected={b.id === selectedId} overlap={overlap.has(b.id)} />
        ),
      )}

      <DimensionLabel start={[-halfW, 0.05, halfL]} end={[halfW, 0.05, halfL]} offset={[0, 0, 0.6]} label="Room" />
      <DimensionLabel start={[halfW, 0.05, -halfL]} end={[halfW, 0.05, halfL]} offset={[0.6, 0, 0]} label="Length" />
    </group>
  );
}
