import { Cube, SET } from '../common';

/**
 * Stage braces behind a flat: a diagonal brace from about two-thirds height
 * down to the floor, with a stage weight on the foot. `back` is the z of the
 * flat's back face; braces extend towards -Z by `reach`.
 */
export function Braces({ width, height, back, reach }: { width: number; height: number; back: number; reach: number }) {
  const xs = width > 1.6 ? [-width * 0.3, width * 0.3] : [0];
  const top = height * 0.66;
  const len = Math.hypot(top, reach);
  const angle = Math.atan2(reach, top);
  return (
    <>
      {xs.map((x) => (
        <group key={x}>
          <mesh position={[x, top / 2, back - reach / 2]} rotation-x={angle} castShadow>
            <boxGeometry args={[0.05, len, 0.025]} />
            <meshStandardMaterial color={SET.wood} roughness={0.8} />
          </mesh>
          <Cube at={[x, 0.06, back - reach + 0.05]} size={[0.25, 0.12, 0.2]} color={SET.dark} />
        </group>
      ))}
    </>
  );
}
