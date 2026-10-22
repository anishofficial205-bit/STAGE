/** A simple low-poly performer: 1.7 m tall at scale 1, facing +z. */
import type { Posture } from '../../blocking/types';

const SKIN = '#e2c4a6';

function Part({ at, size, color, opacity, r = 0 }: { at: [number, number, number]; size: [number, number, number]; color: string; opacity: number; r?: number }) {
  return (
    <mesh position={at} rotation-x={r} castShadow={opacity >= 1}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.8} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
    </mesh>
  );
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(Math.min(255, v * k)).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

export function Figure({ color, posture, opacity = 1 }: { color: string; posture: Posture; opacity?: number }) {
  const legs = shade(color, 0.55);
  const head = (y: number, z = 0) => (
    <mesh position={[0, y, z]} castShadow={opacity >= 1}>
      <sphereGeometry args={[0.115, 12, 10]} />
      <meshStandardMaterial color={SKIN} roughness={0.7} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
    </mesh>
  );
  if (posture === 'sitting')
    return (
      <>
        {[-0.1, 0.1].map((x) => (
          <group key={x}>
            <Part at={[x, 0.47, 0.2]} size={[0.14, 0.14, 0.44]} color={legs} opacity={opacity} />
            <Part at={[x, 0.23, 0.4]} size={[0.13, 0.46, 0.14]} color={legs} opacity={opacity} />
          </group>
        ))}
        <Part at={[0, 0.82, -0.02]} size={[0.38, 0.6, 0.22]} color={color} opacity={opacity} />
        {[-0.24, 0.24].map((x) => (
          <Part key={x} at={[x, 0.8, 0.06]} size={[0.09, 0.5, 0.1]} color={color} opacity={opacity} r={-0.5} />
        ))}
        {head(1.26)}
        {/* Something to sit on. */}
        <Part at={[0, 0.2, 0.02]} size={[0.44, 0.4, 0.44]} color="#6b6f76" opacity={opacity * 0.9} />
      </>
    );
  const body = (
    <>
      {[-0.1, 0.1].map((x) => (
        <Part key={x} at={[x, 0.44, 0]} size={[0.14, 0.86, 0.15]} color={legs} opacity={opacity} />
      ))}
      <Part at={[0, 1.17, 0]} size={[0.38, 0.62, 0.22]} color={color} opacity={opacity} />
      {[-0.25, 0.25].map((x) => (
        <Part key={x} at={[x, 1.12, 0]} size={[0.09, 0.6, 0.1]} color={color} opacity={opacity} />
      ))}
      {head(1.6)}
      {/* Nose: shows which way they face. */}
      <Part at={[0, 1.6, 0.11]} size={[0.04, 0.05, 0.05]} color={SKIN} opacity={opacity} />
    </>
  );
  if (posture === 'lying')
    return (
      <group position={[0, 0.12, 0.85]} rotation-x={-Math.PI / 2}>
        {body}
      </group>
    );
  return body;
}
