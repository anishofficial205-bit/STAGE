import { useContext, useEffect } from 'react';
import { labelRegistry, useExportState } from '../export/state';
import { Html, Line } from '@react-three/drei';
import { useProjectStore } from '../store/useProjectStore';
import { formatLength } from '../units';
import type { Vec3 } from '../types';
import { COLORS } from './materials';
import { SceneModeContext } from '../components/StageScene';
import { labelPriority, useHovered, useShowLabel, type LabelKind } from './labels';

interface Props {
  start: Vec3;
  end: Vec3;
  /** Pushes the measurement line away from the object, drawing extension lines back to it. */
  offset?: Vec3;
  /** Optional prefix, e.g. "Arch". */
  label?: string;
  /** Stage dimensions show while the stage is selected; a set piece's show when it's selected or hovered. */
  kind?: LabelKind;
  selected?: boolean;
  hoverKey?: string;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * A measurement line between two points with a text label in the current unit.
 * Shown according to the label rules for each mode (see helpers/labels).
 */
export function DimensionLabel({ start, end, offset = [0, 0, 0], label, kind = 'stage-dim', selected, hoverKey }: Props) {
  const show = useShowLabel(kind, { selected, hoverKey });
  const hovered = useHovered(hoverKey);
  const units = useProjectStore((s) => s.units);
  const { thumbnail } = useContext(SceneModeContext);
  const exporting = useExportState((s) => s.exporting);
  // Exports draw labels themselves (the on-screen labels are HTML, not part of the 3D image).
  const key = `${start}|${end}|${offset}|${label}`;
  useEffect(() => {
    if (!show || thumbnail) return;
    const entry = { a: add(start, offset), b: add(end, offset), label };
    labelRegistry.add(entry);
    return () => {
      labelRegistry.delete(entry);
    };
  }, [key, show, thumbnail]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show || thumbnail || exporting) return null;

  const a = add(start, offset);
  const b = add(end, offset);
  const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  if (length < 0.01) return null;
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const hasOffset = offset.some((v) => v !== 0);

  return (
    <group userData={{ noOcclude: true }}>
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
        <div className="dim-label" data-lp={labelPriority(kind, selected, hovered)}>
          {label && <span className="dim-label__name">{label}</span>}
          {formatLength(length, units)}
        </div>
      </Html>
    </group>
  );
}
