/** Small fixture models, built with the beam pointing along +Z from the origin. */
import type { FixtureType } from '../../lighting/types';

const BODY = '#26282c';
const YOKE = '#3a3d42';

function Cyl({ r, r2 = r, len, z, color = BODY, emissive }: { r: number; r2?: number; len: number; z: number; color?: string; emissive?: string }) {
  return (
    <mesh position={[0, 0, z]} rotation-x={Math.PI / 2} castShadow={false}>
      <cylinderGeometry args={[r2, r, len, 16]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} emissive={emissive ?? '#000'} emissiveIntensity={emissive ? 1 : 0} />
    </mesh>
  );
}

/** Lens glow when the light is on. */
const lens = (color: string, on: boolean) => (on ? color : undefined);

export function FixtureModel({ type, color, on }: { type: FixtureType; color: string; on: boolean }) {
  switch (type) {
    case 'profile':
    case 'follow':
      return (
        <>
          <Cyl r={0.09} len={type === 'follow' ? 0.8 : 0.55} z={type === 'follow' ? -0.25 : -0.15} />
          <Cyl r={0.12} len={0.2} z={-0.45} />
          <Cyl r={0.085} len={0.02} z={type === 'follow' ? 0.16 : 0.13} color="#111" emissive={lens(color, on)} />
        </>
      );
    case 'fresnel':
      return (
        <>
          <Cyl r={0.13} len={0.3} z={-0.1} />
          <Cyl r={0.11} len={0.02} z={0.06} color="#222" emissive={lens(color, on)} />
        </>
      );
    case 'par':
      return (
        <>
          <Cyl r={0.12} r2={0.14} len={0.35} z={-0.12} />
          <Cyl r={0.12} len={0.02} z={0.06} color="#222" emissive={lens(color, on)} />
        </>
      );
    case 'moving':
      return (
        <>
          <mesh position={[0, 0.22, -0.05]}>
            <boxGeometry args={[0.3, 0.12, 0.3]} />
            <meshStandardMaterial color={YOKE} roughness={0.6} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshStandardMaterial color={BODY} roughness={0.5} />
          </mesh>
          <Cyl r={0.07} len={0.02} z={0.13} color="#111" emissive={lens(color, on)} />
        </>
      );
    case 'cyc':
      return (
        <>
          <mesh position={[0, 0, -0.06]}>
            <boxGeometry args={[1, 0.14, 0.12]} />
            <meshStandardMaterial color={BODY} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.005]}>
            <boxGeometry args={[0.92, 0.09, 0.01]} />
            <meshStandardMaterial color="#111" emissive={lens(color, on) ?? '#000'} emissiveIntensity={on ? 1 : 0} />
          </mesh>
        </>
      );
    case 'uplight':
      return (
        <>
          <mesh position={[0, 0, -0.08]}>
            <boxGeometry args={[0.2, 0.2, 0.16]} />
            <meshStandardMaterial color={BODY} roughness={0.6} />
          </mesh>
          <Cyl r={0.08} len={0.02} z={0.01} color="#111" emissive={lens(color, on)} />
        </>
      );
    case 'house':
      return (
        <>
          {[-1.2, 0, 1.2].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 0.06, 20]} />
              <meshStandardMaterial color="#d9d6cf" emissive={on ? color : '#000'} emissiveIntensity={on ? 0.8 : 0} />
            </mesh>
          ))}
        </>
      );
    default:
      return null;
  }
}

/** A practical: a floor lamp whose shade glows when it's on. */
export function PracticalModel({ color, on }: { color: string; on: boolean }) {
  return (
    <>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.04, 20]} />
        <meshStandardMaterial color={BODY} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.36, 8]} />
        <meshStandardMaterial color="#8c939c" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.14, 0.22, 0.26, 20, 1, true]} />
        <meshStandardMaterial color="#efe3c8" side={2} emissive={on ? color : '#000'} emissiveIntensity={on ? 0.9 : 0} transparent opacity={0.92} />
      </mesh>
    </>
  );
}
