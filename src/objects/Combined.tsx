/**
 * Draws a combined piece (see combine.ts): its pieces on a hidden layer, where
 * they can still be clicked and dragged, and the cut or joined shape in their place.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ADDITION, Brush, DIFFERENCE, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SetObject } from './types';
import { combineOf, type CombineOp } from './combine';

/** Pieces inside a combined piece are drawn on this layer: clickable, but not seen or exported. */
export const SOURCE_LAYER = 5;

const evaluator = new Evaluator();
evaluator.attributes = ['position', 'uv', 'normal'];
evaluator.useGroups = true;
evaluator.consolidateMaterials = true;

const OPS = { add: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION, exclude: DIFFERENCE } as const;

/** A copy of a mesh's geometry in `space`, with just the attributes the cutter needs. */
function brushFrom(mesh: THREE.Mesh, toSpace: THREE.Matrix4): Brush | null {
  const src = mesh.geometry as THREE.BufferGeometry;
  if (!src?.attributes.position) return null;
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', src.attributes.position.clone());
  if (src.index) g.setIndex(src.index.clone());
  if (src.attributes.normal) g.setAttribute('normal', src.attributes.normal.clone());
  else g.computeVertexNormals();
  const count = g.attributes.position.count;
  g.setAttribute('uv', src.attributes.uv ? src.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  for (const grp of src.groups) g.addGroup(grp.start, grp.count, grp.materialIndex);
  if (!g.index) g = mergeVertices(g);
  const brush = new Brush(g, mesh.material);
  brush.matrix.multiplyMatrices(toSpace, mesh.matrixWorld);
  brush.matrix.decompose(brush.position, brush.quaternion, brush.scale);
  brush.updateMatrixWorld(true);
  return brush;
}

/** Fold a list of brushes into one with `op`. */
function fold(brushes: Brush[], op: number): Brush | null {
  if (!brushes.length) return null;
  let acc = brushes[0];
  for (let i = 1; i < brushes.length; i++) acc = evaluator.evaluate(acc, brushes[i], op as never);
  return acc;
}

function evaluate(op: CombineOp, base: Brush[], others: Brush[]): Brush | null {
  if (!base.length) return fold(others, ADDITION);
  if (!others.length) return fold(base, ADDITION);
  const a = fold(base, ADDITION)!;
  if (op === 'add') return fold([a, ...others], ADDITION);
  if (op === 'subtract') return others.reduce((acc, b) => evaluator.evaluate(acc, b, SUBTRACTION), a);
  const b = fold(others, ADDITION)!;
  return evaluator.evaluate(a, b, OPS[op]);
}

/** Meshes that take part: solid, non-instanced geometry (labels, outlines and handles don't). */
const solid = (o: THREE.Object3D): o is THREE.Mesh => {
  const m = o as THREE.Mesh;
  return !!m.isMesh && !(m as unknown as THREE.InstancedMesh).isInstancedMesh && !!m.geometry?.attributes?.position && m.geometry.type !== 'PlaneGeometry' && !m.userData.noCombine;
};

/**
 * Draws one combined piece. `children` are its pieces, drawn as usual inside a
 * source group; each frame they're moved to the hidden layer and, when anything
 * changed, the result is rebuilt from their meshes.
 */
export function Combined({ group, baseId, units, version, children }: { group: SetObject; baseId: string; units: [string, string[]][]; version: unknown; children: ReactNode }) {
  const src = useRef<THREE.Group>(null);
  const out = useRef<THREE.Mesh>(null);
  const raycaster = useThree((s) => s.raycaster);
  const invalidate = useThree((s) => s.invalidate);
  const dirty = useRef(true);
  const last = useRef(0);
  const op = combineOf(group) ?? 'add';
  // Which top-level piece of the combination each leaf belongs to (the base, or one of the others).
  const unitOf = useMemo(() => new Map(units.flatMap(([unit, leaves]) => leaves.map((l) => [l, unit] as [string, string]))), [units]);

  useEffect(() => {
    raycaster.layers.enable(SOURCE_LAYER);
  }, [raycaster]);
  useLayoutEffect(() => {
    dirty.current = true;
    invalidate();
  }, [version, op, baseId, unitOf, invalidate]);

  useFrame(({ clock }) => {
    const root = src.current;
    if (!root || !out.current) return;
    // Anything newly drawn (a piece re-rendered) goes to the hidden layer and means a rebuild.
    root.traverse((o) => {
      if (solid(o) && o.layers.isEnabled(0)) {
        o.layers.set(SOURCE_LAYER);
        dirty.current = true;
      }
    });
    if (!dirty.current) return;
    // While dragging, rebuild at most ~12 times a second.
    const now = clock.elapsedTime;
    if (now - last.current < 0.08) return;
    last.current = now;
    dirty.current = false;
    root.updateMatrixWorld(true);
    const toSpace = new THREE.Matrix4().copy(root.parent!.matrixWorld).invert();
    const base: Brush[] = [];
    const others: Brush[] = [];
    root.traverse((o) => {
      if (!solid(o)) return;
      let id: string | undefined;
      for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (p.userData.objectId) id = p.userData.objectId;
      const b = brushFrom(o, toSpace);
      if (b) (id && (unitOf.get(id) ?? id) === baseId ? base : others).push(b);
    });
    let result: Brush | null = null;
    try {
      result = evaluate(op, base, others);
    } catch {
      result = null; // a shape the cutter can't handle: show nothing rather than break the view
    }
    const mesh = out.current;
    mesh.geometry.dispose();
    mesh.geometry = result ? result.geometry : new THREE.BufferGeometry();
    mesh.material = result ? result.material : [];
    mesh.visible = !!result;
  });

  return (
    <>
      <group ref={src}>{children}</group>
      <mesh ref={out} castShadow receiveShadow userData={{ objectId: baseId, combined: group.id }} raycast={() => null} />
    </>
  );
}

