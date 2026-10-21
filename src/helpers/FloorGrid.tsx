import { Grid } from '@react-three/drei';
import { useProjectStore } from '../store/useProjectStore';
import { M_PER_FT } from '../units';
import { COLORS, ROUGHNESS } from './materials';

/**
 * Ground plane plus a subtle grid: 1 m cells (5 m sections) in metres,
 * 1 ft cells (10 ft sections) in feet.
 */
export function FloorGrid() {
  const units = useProjectStore((s) => s.units);
  const cell = units === 'ft' ? M_PER_FT : 1;
  const section = units === 'ft' ? M_PER_FT * 10 : 5;
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color={COLORS.ground} roughness={ROUGHNESS} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[10, 10]}
        infiniteGrid
        cellSize={cell}
        sectionSize={section}
        cellThickness={0.6}
        sectionThickness={1}
        cellColor="#c9ccd1"
        sectionColor="#b3b8bf"
        fadeDistance={units === 'ft' ? 70 : 110}
        fadeStrength={1.5}
      />
    </>
  );
}
