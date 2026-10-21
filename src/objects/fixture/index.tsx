/**
 * Lighting fixture — visual only (no light is cast yet): a spotlight or par
 * can in a yoke, clamped under a bar or truss and tilted towards the stage.
 */
import { num, str } from '../../helpers/params';
import { Cube, Icon } from '../common';
import type { SetObjectType } from '../types';

const BODY = '#26292e';

export const fixtureObject: SetObjectType = {
  id: 'fixture',
  name: 'Lighting fixture',
  category: 'Rigging & Screens',
  icon: (
    <Icon>
      <path d="M12 2v3M8 5h8M9 5v4M15 5v4" />
      <rect x="8" y="9" width="8" height="7" rx="1" transform="rotate(-20 12 12)" />
      <path d="M10 19l-1.5 3M14 19l1.5 3" />
    </Icon>
  ),
  placement: 'hanging',
  hangGap: 0.02,
  defaultElevation: 4,
  params: [
    {
      key: 'kind',
      label: 'Type',
      group: 'Fixture',
      type: 'select',
      default: 'par',
      options: [
        { value: 'par', label: 'Par can' },
        { value: 'spot', label: 'Spotlight (profile)' },
      ],
    },
    { key: 'tilt', label: 'Tilt (°)', group: 'Fixture', type: 'number', unit: 'none', default: 40, min: 0, max: 90, step: 5, help: '0 = straight down, 90 = level, pointing at the audience side.' },
  ],
  constraints: (p) => p,
  size: () => ({ width: 0.4, depth: 0.4, height: 0.55 }),
  build: (p) => {
    const spot = str(p, 'kind') === 'spot';
    const len = spot ? 0.5 : 0.32;
    const r = spot ? 0.085 : 0.13;
    const tilt = (num(p, 'tilt') * Math.PI) / 180;
    return (
      <>
        {/* Clamp and yoke */}
        <Cube at={[0, 0.53, 0]} size={[0.08, 0.05, 0.08]} color={BODY} />
        <Cube at={[0, 0.49, 0]} size={[0.34, 0.03, 0.04]} color={BODY} />
        {[-1, 1].map((s) => (
          <Cube key={s} at={[s * 0.16, 0.36, 0]} size={[0.025, 0.26, 0.04]} color={BODY} />
        ))}
        {/* Body hangs from the yoke pivot, aimed down and forwards */}
        <group position={[0, 0.3, 0]} rotation-x={tilt}>
          <mesh position-y={-len / 2 + 0.06} castShadow>
            <cylinderGeometry args={[r, r * 0.92, len, 20]} />
            <meshStandardMaterial color={BODY} roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position-y={-len + 0.059}>
            <cylinderGeometry args={[r * 0.85, r * 0.85, 0.01, 20]} />
            <meshStandardMaterial color="#fff2d6" emissive="#ffe2a8" emissiveIntensity={0.4} />
          </mesh>
        </group>
      </>
    );
  },
  faces: () => [],
};
