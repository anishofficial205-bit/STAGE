import { useContext } from 'react';
import { Html, Line } from '@react-three/drei';
import { useProjectStore } from '../store/useProjectStore';
import { formatLength } from '../units';
import type { Vec3 } from '../types';
import { COLORS } from './materials';
import { SceneModeContext } from '../components/StageScene';

interface Props {
  start: Vec3;
  end: Vec3;
  /** Pushes the measurement line away from the object, drawing extension lines back to it. */
  offset?: Vec3;
  /** Optional prefix, e.g. "Arch". */
  label?: string;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * A measurement line between two points with a text label in the current unit.
 * Hidden when labels are toggled off in the top bar.
 */
export function DimensionLabel({ start, end, offset = [0, 0, 0], label }: Props) {
  const show = useProjectStore((s) => s.showLabels);
  const units = useProjectStore((s) => s.units);
  const { thumbnail } = useContext(SceneModeContext);
  if (!show || thumbnail) return null;

  const a = add(start, offset);
  const b = add(end, offset);
  const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  if (length < 0.01) return null;
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const hasOffset = offset.some((v) => v !== 0);

  return (
    <group>
      <Line points={[a, b]} color={COLORS.dimension} lineWidth={1.5} />
      {hasOffset && (
        <>
          <Line points={[start, a]} color={COLORS.dimension} lineWidth={0.75} transparent opacity={0.6} />
          <Line points={[end, b]} color={COLORS.dimension} lineWidth={0.75} transparent opacity={0.6} />
        </>
      )}
      <mesh position={a}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={COLORS.dimension} />
      </mesh>
      <mesh position={b}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={COLORS.dimension} />
      </mesh>
      <Html position={mid} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="dim-label">
          {label && <span className="dim-label__name">{label}</span>}
          {formatLength(length, units)}
        </div>
      </Html>
    </group>
  );
}
