/**
 * Shared bits for props: neutral greys (props are for scale, not styling) and
 * a low-poly human figure built from capsules.
 */
import type { ReactNode } from 'react';
import { FaceMat } from '../faceMaterial';

export const PROP = '#b3b6bb';
export const PROP_DARK = '#8b9097';
export const PROP_LIGHT = '#c9ccd0';

/** Prop material; `face` makes it a named face that can take colour/graphics. */
export function PropMat({ color = PROP, face, attach }: { color?: string; face?: string; attach?: string }) {
  return <FaceMat attach={attach} face={face} color={color} roughness={0.8} />;
}

/** A capsule between two points in the YZ plane (x fixed). */
function Limb({ x, a, b, r }: { x: number; a: [number, number]; b: [number, number]; r: number }) {
  const dy = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dy, dz);
  return (
    <mesh position={[x, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2]} rotation-x={Math.atan2(dz, dy)} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, len), 4, 10]} />
      <PropMat color={PROP_DARK} />
    </mesh>
  );
}

/**
 * Human figure for scale. `height` is standing height. Seated figures have
 * their seat at `seat` m above the floor and face +Z.
 */
export function Figure({ height, seated = false, seat = 0.45 }: { height: number; seated?: boolean; seat?: number }) {
  const s = height / 1.75;
  const parts: ReactNode[] = [];
  const hip = seated ? seat + 0.07 : 0.9 * s;
  // Legs
  for (const x of [-0.1 * s, 0.1 * s]) {
    if (seated) {
      parts.push(<Limb key={`t${x}`} x={x} a={[hip, 0]} b={[hip, 0.45 * s]} r={0.075 * s} />);
      parts.push(<Limb key={`s${x}`} x={x} a={[hip, 0.45 * s]} b={[0.06, 0.48 * s]} r={0.06 * s} />);
    } else {
      parts.push(<Limb key={`l${x}`} x={x} a={[0.06, 0]} b={[hip, 0]} r={0.075 * s} />);
    }
  }
  const shoulder = hip + 0.52 * s;
  // Torso (flattened front-to-back), neck and head
  parts.push(
    <mesh key="torso" position={[0, (hip + shoulder) / 2, 0]} scale={[1, 1, 0.62]} castShadow>
      <capsuleGeometry args={[0.17 * s, 0.32 * s, 4, 12]} />
      <PropMat color={PROP_DARK} />
    </mesh>,
    <mesh key="head" position={[0, shoulder + 0.2 * s, 0]} castShadow>
      <sphereGeometry args={[0.11 * s, 14, 12]} />
      <PropMat color={PROP_DARK} />
    </mesh>,
    <mesh key="neck" position={[0, shoulder + 0.05 * s, 0]}>
      <cylinderGeometry args={[0.045 * s, 0.05 * s, 0.1 * s, 8]} />
      <PropMat color={PROP_DARK} />
    </mesh>,
  );
  // Arms: hanging at the sides when standing, forearms resting forward when seated.
  for (const x of [-0.24 * s, 0.24 * s]) {
    parts.push(<Limb key={`u${x}`} x={x} a={[shoulder - 0.02 * s, 0]} b={[shoulder - 0.32 * s, 0.03 * s]} r={0.05 * s} />);
    parts.push(seated ? <Limb key={`f${x}`} x={x} a={[shoulder - 0.32 * s, 0.03 * s]} b={[hip + 0.04, 0.3 * s]} r={0.045 * s} /> : <Limb key={`f${x}`} x={x} a={[shoulder - 0.32 * s, 0.03 * s]} b={[hip - 0.05 * s, 0.06 * s]} r={0.045 * s} />);
  }
  return <>{parts}</>;
}
