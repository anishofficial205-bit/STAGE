/**
 * Importing a 3D model as a prop: OBJ (with its .mtl and textures, picked
 * together or in a .zip), or glTF (.glb / .gltf). The model is turned the
 * right way up, measured in real units, fitted into a 1 × 1 × 1 box (like a
 * prop made from photos, so the piece scales it to its real size) and kept as
 * one .glb file in My props.
 */
import * as THREE from 'three';
import JSZip from 'jszip';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export type FileUnits = 'mm' | 'cm' | 'm' | 'in' | 'ft';
export const UNIT_SCALE: Record<FileUnits, number> = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 };
export const UNIT_LABEL: Record<FileUnits, string> = { mm: 'Millimetres', cm: 'Centimetres', m: 'Metres', in: 'Inches', ft: 'Feet' };

export interface LoadedModel {
  /** The model as read (file units, file orientation). */
  object: THREE.Object3D;
  name: string;
  triangles: number;
  /** Things worth telling the user (missing textures, a heavy model…). */
  notes: string[];
}

const base = (p: string) => p.split(/[\\/]/).pop()!.toLowerCase();

/** The files picked, with any .zip opened up. */
async function expand(files: File[]): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>();
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const zip = await JSZip.loadAsync(f);
      for (const entry of Object.values(zip.files)) if (!entry.dir && !/__MACOSX/.test(entry.name)) out.set(base(entry.name), await entry.async('blob'));
    } else out.set(base(f.name), f);
  }
  return out;
}

/** Load a model from the picked files. */
export async function loadModel(files: File[]): Promise<LoadedModel> {
  const all = await expand(files);
  const names = [...all.keys()];
  const main = names.find((n) => n.endsWith('.glb')) ?? names.find((n) => n.endsWith('.gltf')) ?? names.find((n) => n.endsWith('.obj'));
  if (!main) throw new Error('Pick an .obj file (with its .mtl and pictures, or all of them in a .zip), or a .glb / .gltf file.');
  const notes: string[] = [];
  const urls = new Map<string, string>();
  const missing = new Set<string>();
  // Textures and other files referenced by name are served from the picked files.
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (/^(blob:|data:)/.test(url)) return url;
    const key = base(decodeURIComponent(url));
    const blob = all.get(key);
    if (!blob) {
      missing.add(key);
      return url;
    }
    if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob));
    return urls.get(key)!;
  });
  // Pictures load after the shape: know when they've all arrived (or failed).
  let pending = 0;
  let settle: () => void = () => undefined;
  const textures = new Promise<void>((resolve) => (settle = resolve));
  manager.onStart = () => pending++;
  manager.onLoad = () => settle();
  let object: THREE.Object3D;
  try {
    if (main.endsWith('.glb') || main.endsWith('.gltf')) {
      const loader = new GLTFLoader(manager);
      const data = main.endsWith('.glb') ? await all.get(main)!.arrayBuffer() : await all.get(main)!.text();
      object = (await loader.parseAsync(data, '')).scene;
    } else {
      const text = await all.get(main)!.text();
      const loader = new OBJLoader(manager);
      const lib = text.match(/^mtllib\s+(.+)$/m)?.[1]?.trim();
      const mtlName = (lib && all.has(base(lib)) ? base(lib) : null) ?? names.find((n) => n.endsWith('.mtl'));
      if (mtlName) {
        const materials = new MTLLoader(manager).parse(await all.get(mtlName)!.text(), '');
        materials.preload();
        loader.setMaterials(materials);
      } else if (lib) notes.push(`The colours file “${lib}” wasn’t picked, so the model is plain grey. Pick it together with the .obj.`);
      object = loader.parse(text);
    }
    // Wait for the pictures, if any (at most a few seconds).
    await new Promise((r) => setTimeout(r, 30));
    if (pending) await Promise.race([textures, new Promise((r) => setTimeout(r, 6000))]);
  } finally {
    setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 10000);
  }
  if (missing.size) notes.push(`Missing picture${missing.size === 1 ? '' : 's'}: ${[...missing].slice(0, 4).join(', ')}${missing.size > 4 ? '…' : ''}. Pick ${missing.size === 1 ? 'it' : 'them'} too (or a .zip with everything).`);
  let triangles = 0;
  let meshes = 0;
  object.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  if (!meshes) throw new Error('There’s no 3D shape in that file.');
  if (triangles > 600_000) notes.push(`This is a heavy model (${Math.round(triangles / 1000)}k triangles). It may slow the view down; a simpler version works better.`);
  return { object, name: main.replace(/\.(obj|glb|gltf)$/i, '').replace(/[-_]+/g, ' '), triangles, notes };
}

/** A guess at the file's units from how big the model is (most props are 0.2–5 m). */
export function guessUnits(m: LoadedModel, zUp: boolean): FileUnits {
  const size = new THREE.Box3().setFromObject(m.object).getSize(new THREE.Vector3());
  const tallest = Math.max(size.x, zUp ? size.z : size.y, 1e-9);
  if (tallest > 150) return 'mm';
  if (tallest > 15) return 'cm';
  return 'm';
}

/** Plain materials everything (and the .glb file) understands, keeping colours, pictures and see-through. */
function standardise(object: THREE.Object3D) {
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const conv = (m: THREE.Material) => {
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return m;
      const src = m as THREE.MeshPhongMaterial;
      const out = new THREE.MeshStandardMaterial({
        color: src.color ?? new THREE.Color('#9a9a96'),
        map: src.map ?? null,
        transparent: src.transparent,
        opacity: src.opacity,
        side: src.side,
        roughness: 0.7,
        metalness: 0,
      });
      out.name = m.name;
      return out;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
  });
}

/**
 * Turn the model upright, measure it in metres and fit it into the 1 × 1 × 1
 * box (x −0.5…0.5, y 0…1, z −0.5…0.5). Returns the fitted model and its real size.
 */
export function fit(m: LoadedModel, units: FileUnits, zUp: boolean): { model: THREE.Group; size: [number, number, number] } {
  const object = m.object.clone(true);
  standardise(object);
  const turn = new THREE.Group();
  if (zUp) turn.rotation.x = -Math.PI / 2;
  turn.add(object);
  turn.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn);
  const s = box.getSize(new THREE.Vector3());
  const k = UNIT_SCALE[units];
  const size: [number, number, number] = [Math.max(1e-4, s.x * k), Math.max(1e-4, s.y * k), Math.max(1e-4, s.z * k)];
  const centre = box.getCenter(new THREE.Vector3());
  const unit = new THREE.Group();
  unit.scale.set(1 / Math.max(1e-9, s.x), 1 / Math.max(1e-9, s.y), 1 / Math.max(1e-9, s.z));
  const shift = new THREE.Group();
  shift.position.set(-centre.x, -box.min.y, -centre.z);
  shift.add(turn);
  unit.add(shift);
  const model = new THREE.Group();
  model.add(unit);
  return { model, size };
}

/** The fitted model as one .glb file. */
export async function toGlb(model: THREE.Object3D): Promise<Blob> {
  const data = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
  return new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' });
}

/** A small picture of the model for the library. */
export function snapshot(model: THREE.Object3D, size: [number, number, number]): string {
  const S = 160;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(S, S, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight('#ffffff', 1.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(2, 3, 3);
  scene.add(sun);
  const holder = new THREE.Group();
  const k = 1 / Math.max(...size);
  holder.scale.set(size[0] * k, size[1] * k, size[2] * k);
  holder.position.y = -(size[1] * k) / 2;
  holder.add(model.clone(true));
  holder.rotation.y = -0.6;
  scene.add(holder);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  cam.position.set(0, 0.35, 2.4);
  cam.lookAt(0, 0, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  r.dispose();
  return url;
}

const parsed = new Map<string, Promise<THREE.Object3D | null>>();
/** A stored prop model, read once and shared by every copy on stage. */
export function readGlb(key: string, blob: Blob) {
  let p = parsed.get(key);
  if (!p) {
    p = blob
      .arrayBuffer()
      .then((buf) => new GLTFLoader().parseAsync(buf, ''))
      .then((g) => {
        g.scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) (o.castShadow = true), (o.receiveShadow = true);
        });
        return g.scene as THREE.Object3D;
      })
      .catch(() => null);
    parsed.set(key, p);
  }
  return p;
}
