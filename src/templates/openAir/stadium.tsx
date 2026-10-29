/**
 * Stadium surroundings for the open-air stage: an oval bowl of two seating
 * tiers with a roof, a running track round the field and a seated crowd.
 * The stage end is left without a crowd, as at a real stadium show.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seeded } from './scenery';
import { useSeatsShown } from '../../helpers/seatsView';

/** One row of the bowl's cross-section: distance out from the field edge, height, and what it is. */
type Kind = 'wall' | 'seatA' | 'seatB' | 'riser' | 'concourse' | 'boxes';
type Step = [d: number, y: number, kind: Kind];

const LOWER = { rows: 24, front: 2.4, depth: 0.85, rise: 0.42 };
const UPPER = { rows: 20, depth: 0.85, rise: 0.56 };
const SEGMENTS = 160;

function profile() {
  const pts: Step[] = [[0, 0, 'wall'], [0, LOWER.front, 'wall']];
  let d = 0;
  let y = LOWER.front;
  const tier = (rows: number, depth: number, rise: number) => {
    const treads: [number, number][] = [];
    for (let k = 0; k < rows; k++) {
      treads.push([d + depth / 2, y]);
      d += depth;
      pts.push([d, y, k % 2 ? 'seatB' : 'seatA']);
      y += rise;
      pts.push([d, y, 'riser']);
    }
    return treads;
  };
  const lower = tier(LOWER.rows, LOWER.depth, LOWER.rise);
  d += 2.5;
  pts.push([d, y, 'concourse']);
  y += 3.4;
  pts.push([d, y, 'boxes']);
  const upper = tier(UPPER.rows, UPPER.depth, UPPER.rise);
  const back = d;
  pts.push([back, y + 4.5, 'wall']);
  pts.push([back + 0.6, y + 4.5, 'wall']);
  pts.push([back + 0.6, 0, 'wall']);
  return { pts, treads: [...lower, ...upper], back, top: y + 4.5 };
}

const COLOR: Record<Kind, string> = {
  wall: '#7d828a',
  seatA: '#2f5fa8',
  seatB: '#2a559a',
  riser: '#5d636c',
  concourse: '#6c7178',
  boxes: '#3a3f47',
};

/** Sweeps a cross-section round an ellipse (half-widths a, b) into one flat-shaded mesh. */
function sweep(pts: Step[], a: number, b: number, colors: Record<Kind, string>) {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const at = (d: number, y: number, t: number) => [(a + d) * Math.cos(t), y, (b + d) * Math.sin(t)];
  for (let s = 0; s < SEGMENTS; s++) {
    const t0 = (s / SEGMENTS) * Math.PI * 2;
    const t1 = ((s + 1) / SEGMENTS) * Math.PI * 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [d0, y0] = pts[i];
      const [d1, y1, kind] = pts[i + 1];
      const p00 = at(d0, y0, t0), p01 = at(d0, y0, t1), p10 = at(d1, y1, t0), p11 = at(d1, y1, t1);
      pos.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      c.set(colors[kind]);
      for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** A flat elliptical ring on the ground, from `r0` to `r1` beyond the ellipse (a, b). */
function ringGeometry(a: number, b: number, r0: number, r1: number) {
  const outer = new THREE.Shape();
  outer.absellipse(0, 0, a + r1, b + r1, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, a + r0, b + r0, 0, Math.PI * 2, true, 0);
  outer.holes.push(hole);
  return new THREE.ShapeGeometry(outer, 96).rotateX(Math.PI / 2);
}

/**
 * Lets a vertex- or instance-coloured material give off a little of its own
 * colour, so the stands stay readable at night when no light reaches them.
 */
function selfLit<T extends THREE.MeshStandardMaterial>(m: T) {
  m.emissive.set('#ffffff');
  m.emissiveIntensity = 0;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;');
  };
  return m;
}

const seatGeometry = new THREE.BoxGeometry(0.42, 0.62, 0.34).translate(0, 0.31, 0);
const crowdMaterial = selfLit(new THREE.MeshStandardMaterial({ roughness: 0.9 }));
const lightGeometry = new THREE.SphereGeometry(0.06, 4, 3);
const lightMaterial = new THREE.MeshBasicMaterial({ color: '#fff6dc', toneMapped: false });
const SHIRTS = ['#c94a4a', '#e8e4dc', '#3a4a6a', '#2a2a30', '#d6a23a', '#5a7a9a', '#8a3a6a', '#4a6a4a', '#f0f0f0', '#1c1c22'];

function Instances({ geometry, material, matrices, colors }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; colors?: string[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      if (colors) mesh.setColorAt(i, c.set(colors[i]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices, colors]);
  if (!matrices.length) return null;
  return <instancedMesh key={matrices.length} ref={ref} args={[geometry, material, matrices.length]} userData={{ noOcclude: true }} />;
}

/**
 * The bowl round a field of `width` × `length` centred at z = `cz`. The ellipse
 * passes through the field's corners, so the whole field sits inside it.
 */
export function Stadium({ width, length, cz, night }: { width: number; length: number; cz: number; night: boolean }) {
  const shown = useSeatsShown();
  const a = (width / 2) * Math.SQRT2 + 2;
  const b = (length / 2) * Math.SQRT2 + 2;
  const P = useMemo(profile, []);
  const bowl = useMemo(() => sweep(P.pts, a, b, COLOR), [P, a, b]);
  const roof = useMemo(
    () => sweep([[P.back + 0.6, P.top, 'boxes'], [P.back - 18, P.top + 3.5, 'boxes']], a, b, { ...COLOR, boxes: '#30343b' }),
    [P, a, b],
  );
  const track = useMemo(() => ringGeometry(a, b, -9, 0), [a, b]);

  // A seated crowd on the treads, none behind the stage (the field's −z end).
  const crowd = useMemo(() => {
    const rnd = seeded(11);
    const seats: THREE.Matrix4[] = [];
    const colors: string[] = [];
    const lights: THREE.Matrix4[] = [];
    const o = new THREE.Object3D();
    const perRow = Math.round((Math.PI * (a + b)) / 0.9);
    for (const [d, y] of P.treads) {
      for (let i = 0; i < perRow; i++) {
        if (rnd() > 0.62) continue;
        const t = ((i + rnd() * 0.5) / perRow) * Math.PI * 2;
        if (Math.sin(t) < -0.72) continue;
        const x = (a + d) * Math.cos(t);
        const z = (b + d) * Math.sin(t);
        o.position.set(x, y, z);
        o.rotation.set(0, Math.atan2(-x, -z), 0);
        o.scale.set(1, 0.85 + rnd() * 0.3, 1);
        o.updateMatrix();
        seats.push(o.matrix.clone());
        colors.push(SHIRTS[Math.floor(rnd() * SHIRTS.length)]);
        if (rnd() < 0.08) lights.push(new THREE.Matrix4().makeTranslation(x * 0.999, y + 0.75 + rnd() * 0.25, z * 0.999));
      }
    }
    return { seats, colors, lights };
  }, [P, a, b]);

  const bowlMat = useMemo(() => selfLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide })), []);
  bowlMat.emissiveIntensity = night ? 0.16 : 0;
  crowdMaterial.emissiveIntensity = night ? 0.22 : 0;
  const trackMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a4a3a', roughness: 0.9, side: THREE.DoubleSide }), []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#cfe2ff', toneMapped: false, side: THREE.DoubleSide }), []);
  const edge = useMemo(
    () => sweep([[P.back - 18, P.top + 3.3, 'boxes'], [P.back - 18, P.top + 3.0, 'boxes']], a, b, COLOR),
    [P, a, b],
  );

  if (!shown) return null;
  return (
    <group position={[0, 0, cz]}>
      <mesh geometry={track} position={[0, 0.006, 0]} receiveShadow>
        <primitive object={trackMat} attach="material" />
      </mesh>
      <mesh geometry={bowl} material={bowlMat} receiveShadow userData={{ noOcclude: true }} />
      <mesh geometry={roof} material={bowlMat} userData={{ noOcclude: true }} />
      {night && <mesh geometry={edge} material={glowMat} />}
      <Instances geometry={seatGeometry} material={crowdMaterial} matrices={crowd.seats} colors={crowd.colors} />
      {night && <Instances geometry={lightGeometry} material={lightMaterial} matrices={crowd.lights} />}
    </group>
  );
}

/** How far the bowl reaches beyond the field's centre, for camera framing. */
export function stadiumReach(width: number, length: number) {
  const { back, top } = profile();
  return { x: (width / 2) * Math.SQRT2 + 2 + back + 1, z: (length / 2) * Math.SQRT2 + 2 + back + 1, top: top + 4 };
}
