/**
 * The stage as a 3D model for other programs: SketchUp (Collada .dae),
 * Blender (glTF .glb), Rhino and anything else (OBJ + MTL).
 *
 * What's exported is what you see, without the editing helpers: the stage
 * and seating, the set, the backstage, and — if wanted — the light fixtures
 * and performer figures. Every piece is baked into world space (metres, Y up)
 * and grouped by part (Stage, Set, Lights, Performers, Backstage), each piece
 * named as in Layers. Repeated seats are expanded into real geometry.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import JSZip from 'jszip';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { exporter } from './state';
import { useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { useVenueUI } from '../venue/ui';

/** The 3D view isn't drawn while Backstage shows only the plan: show it for a moment. */
async function with3D<T>(fn: () => Promise<T>): Promise<T> {
  if (exporter.scene) return fn();
  const ui = useVenueUI.getState();
  const before = ui.layout;
  ui.setLayout('split');
  try {
    for (let i = 0; i < 50 && !exporter.scene; i++) await new Promise((r) => setTimeout(r, 100));
    return await fn();
  } finally {
    useVenueUI.getState().setLayout(before);
  }
}

export type ModelFormat = 'sketchup' | 'blender' | 'rhino' | 'obj';
export interface ModelOptions {
  lights: boolean;
  performers: boolean;
  backstage: boolean;
}

type Part = 'Stage' | 'Set' | 'Lights' | 'Performers' | 'Backstage';
const PARTS: Part[] = ['Stage', 'Set', 'Lights', 'Performers', 'Backstage'];

/** Which part of the model an object belongs to, and its name; null: an editing helper, not exported. */
function classify(o: THREE.Object3D, names: Map<string, string>): { part: Part; name: string } | null {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    const u = p.userData;
    if (u.handle || u.noExport) return null;
    if (u.objectId) return { part: 'Set', name: names.get(u.objectId) ?? 'Set piece' };
    if (u.fixture) return { part: 'Lights', name: names.get(u.fixture) ?? 'Light' };
    if (u.lightPosition) return { part: 'Lights', name: names.get(u.lightPosition) ?? 'Light bar' };
    if (u.performer) return { part: 'Performers', name: names.get(u.performer) ?? 'Performer' };
    if (u.venueWall) return { part: 'Backstage', name: 'Wall' };
    if (u.venueRoom) return { part: 'Backstage', name: 'Room floor' };
    if (u.venueDoor) return { part: 'Backstage', name: 'Door' };
    if (u.venueFurniture) return { part: 'Backstage', name: names.get(u.venueFurniture) ?? 'Furniture' };
    if (u.lightHelper || u.blockingHelper) return null;
  }
  return { part: 'Stage', name: o.name || 'Stage' };
}

/** Plain materials every program understands: a colour (and opacity), plus the texture for glTF. */
const flat = new Map<string, THREE.MeshStandardMaterial>();
function plainMaterial(m: THREE.Material, keepMap: boolean): THREE.MeshStandardMaterial | null {
  const any = m as THREE.MeshStandardMaterial;
  if ((m as THREE.ShaderMaterial).isShaderMaterial || m.blending === THREE.AdditiveBlending || m.depthTest === false || (any.wireframe ?? false)) return null;
  const opacity = m.transparent ? m.opacity : 1;
  if (opacity < 0.05 || !m.visible) return null;
  const color = any.color ? any.color.clone() : new THREE.Color(1, 1, 1);
  const map = keepMap && any.map && (any.map as THREE.Texture).image ? any.map : null;
  const key = `${color.getHexString()}:${opacity.toFixed(2)}:${map ? map.uuid : ''}`;
  let out = flat.get(key);
  if (!out) {
    out = new THREE.MeshStandardMaterial({ color, opacity, transparent: opacity < 1, map, roughness: any.roughness ?? 0.8, metalness: any.metalness ?? 0, side: THREE.DoubleSide });
    out.name = `colour_${color.getHexString()}${opacity < 1 ? `_${Math.round(opacity * 100)}` : ''}${map ? `_${flat.size}` : ''}`;
    flat.set(key, out);
  }
  return out;
}

function lookupNames() {
  const s = useProjectStore.getState();
  const names = new Map<string, string>();
  for (const o of s.objectsByTemplate[s.templateId] ?? []) names.set(o.id, o.name);
  const l = s.lightingByTemplate[s.templateId];
  for (const f of l?.fixtures ?? []) names.set(f.id, `${f.channel} ${f.name}`);
  for (const p of l?.positions ?? []) names.set(p.id, p.name);
  for (const p of s.blockingByTemplate[s.templateId]?.performers ?? []) names.set(p.id, p.name);
  for (const f of s.venue.furniture) names.set(f.id, (f as { name?: string }).name ?? 'Furniture');
  return names;
}

/** Build the exportable model from the scene: one group per part, each piece a mesh in world space. */
function collect(scene: THREE.Scene, o: ModelOptions, keepMaps: boolean): THREE.Group {
  flat.clear();
  const names = lookupNames();
  const root = new THREE.Group();
  const s = useProjectStore.getState();
  root.name = s.projectName || getTemplate(s.templateId)?.name || 'Stage';
  const groups = new Map<Part, THREE.Group>(PARTS.map((p) => [p, Object.assign(new THREE.Group(), { name: p })]));
  const want: Record<Part, boolean> = { Stage: true, Set: true, Lights: o.lights, Performers: o.performers, Backstage: o.backstage };
  scene.updateMatrixWorld(true);
  const visible = (x: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = x; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  const m4 = new THREE.Matrix4();
  scene.traverse((x) => {
    const mesh = x as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || (mesh as unknown as { isLineSegments2?: boolean }).isLineSegments2 || !visible(mesh)) return;
    if (mesh.geometry.type === 'RingGeometry' || mesh.geometry.type === 'CircleGeometry') return;
    const where = classify(mesh, names);
    if (!where || !want[where.part]) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const mat = plainMaterial(mats[0], keepMaps);
    if (!mat) return;
    const bake = (matrix: THREE.Matrix4) => {
      const g = mesh.geometry.clone();
      // Only what the other programs read: positions, normals, uvs and the triangles.
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.clearGroups();
      g.applyMatrix4(matrix);
      if (matrix.determinant() < 0 && g.index) {
        // Mirrored pieces: flip the triangles so the faces point outwards.
        const idx = g.index.array as Uint16Array | Uint32Array;
        for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      }
      return g;
    };
    const add = (g: THREE.BufferGeometry, name: string) => {
      const out = new THREE.Mesh(g, mat);
      out.name = name;
      groups.get(where.part)!.add(out);
    };
    const inst = mesh as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      // Repeated pieces (rows of seats) become one piece each: much lighter to work with.
      const all: THREE.BufferGeometry[] = [];
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, m4);
        all.push(bake(new THREE.Matrix4().multiplyMatrices(inst.matrixWorld, m4)));
      }
      const merged = all.length ? mergeGeometries(all) : null;
      all.forEach((g) => g.dispose());
      if (merged) add(merged, where.part === 'Stage' && where.name === 'Stage' ? 'Seating' : where.name);
    } else add(bake(mesh.matrixWorld), where.name);
  });
  for (const p of PARTS) if (groups.get(p)!.children.length) root.add(groups.get(p)!);
  return root;
}

// ---- Writers ---------------------------------------------------------------

async function glb(model: THREE.Group): Promise<Blob> {
  const data = await new GLTFExporter().parseAsync(model, { binary: true });
  return new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' });
}

function mtl(model: THREE.Group) {
  const seen = new Map<string, THREE.MeshStandardMaterial>();
  model.traverse((x) => {
    const m = (x as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && !seen.has(m.name)) seen.set(m.name, m);
  });
  return [...seen.values()]
    .map((m) => `newmtl ${m.name}\nKa 0 0 0\nKd ${m.color.r.toFixed(4)} ${m.color.g.toFixed(4)} ${m.color.b.toFixed(4)}\nKs 0.05 0.05 0.05\nd ${m.opacity.toFixed(3)}\nillum 2\n`)
    .join('\n');
}

async function objZip(model: THREE.Group, base: string): Promise<Blob> {
  // OBJ groups take the piece names; keep them unique and free of spaces.
  const used = new Map<string, number>();
  model.traverse((x) => {
    if (!(x as THREE.Mesh).isMesh) return;
    const part = x.parent?.name ?? 'Stage';
    const n = `${part}_${x.name}`.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
    const k = (used.get(n) ?? 0) + 1;
    used.set(n, k);
    x.name = k > 1 ? `${n}_${k}` : n;
  });
  const obj = `# ${model.name} — exported from Stage Builder. Units: metres. Y is up.\nmtllib ${base}.mtl\n${new OBJExporter().parse(model)}`;
  const zip = new JSZip();
  zip.file(`${base}.obj`, obj);
  zip.file(`${base}.mtl`, `# Materials for ${base}.obj\n\n${mtl(model)}`);
  zip.file('README.txt', `${model.name}\n\nOpen ${base}.obj (keep ${base}.mtl next to it for the colours).\nUnits are metres; Y is up.\n\nRhino: File > Import, choose ${base}.obj, and in the OBJ options keep "Map OBJ Y to Rhino Z" on. Set the model units to metres.\nBlender: File > Import > Wavefront (.obj).\n`);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n: number) => (Math.abs(n) < 1e-6 ? '0' : Number(n.toFixed(5)).toString());

/** Collada 1.4.1 — the format SketchUp imports natively (File › Import › COLLADA). */
function collada(model: THREE.Group): Blob {
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const geoms: string[] = [];
  const nodes: string[] = [];
  let n = 0;
  for (const part of model.children) {
    const inner: string[] = [];
    for (const x of part.children) {
      const mesh = x as THREE.Mesh;
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
      const pos = g.getAttribute('position');
      if (!pos || pos.count < 3) continue;
      const m = mesh.material as THREE.MeshStandardMaterial;
      mats.set(m.name, m);
      const id = `g${n++}`;
      const p: string[] = [];
      for (let i = 0; i < pos.count; i++) p.push(fmt(pos.getX(i)), fmt(pos.getY(i)), fmt(pos.getZ(i)));
      const tris = Math.floor(pos.count / 3);
      const idx: string[] = [];
      for (let i = 0; i < tris * 3; i++) idx.push(String(i));
      geoms.push(
        `<geometry id="${id}" name="${esc(mesh.name)}"><mesh>` +
          `<source id="${id}-p"><float_array id="${id}-pa" count="${p.length}">${p.join(' ')}</float_array><technique_common><accessor source="#${id}-pa" count="${pos.count}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>` +
          `<vertices id="${id}-v"><input semantic="POSITION" source="#${id}-p"/></vertices>` +
          `<triangles material="m" count="${tris}"><input semantic="VERTEX" source="#${id}-v" offset="0"/><p>${idx.join(' ')}</p></triangles>` +
          `</mesh></geometry>`,
      );
      inner.push(`<node id="${id}-n" name="${esc(mesh.name)}"><instance_geometry url="#${id}"><bind_material><technique_common><instance_material symbol="m" target="#${esc(m.name)}"/></technique_common></bind_material></instance_geometry></node>`);
    }
    nodes.push(`<node id="part-${esc(part.name)}" name="${esc(part.name)}">${inner.join('')}</node>`);
  }
  const effects = [...mats.values()].map((m) => `<effect id="${esc(m.name)}-fx"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${fmt(m.color.r)} ${fmt(m.color.g)} ${fmt(m.color.b)} 1</color></diffuse><transparency><float>${fmt(m.opacity)}</float></transparency></lambert></technique><extra><technique profile="GOOGLEEARTH"><double_sided>1</double_sided></technique></extra></profile_COMMON></effect>`);
  const materials = [...mats.values()].map((m) => `<material id="${esc(m.name)}" name="${esc(m.name)}"><instance_effect url="#${esc(m.name)}-fx"/></material>`);
  const xml =
    `<?xml version="1.0" encoding="utf-8"?>\n<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">` +
    `<asset><contributor><authoring_tool>Stage Builder</authoring_tool></contributor><created>${new Date().toISOString()}</created><modified>${new Date().toISOString()}</modified><unit name="meter" meter="1"/><up_axis>Y_UP</up_axis></asset>` +
    `<library_effects>${effects.join('')}</library_effects><library_materials>${materials.join('')}</library_materials><library_geometries>${geoms.join('')}</library_geometries>` +
    `<library_visual_scenes><visual_scene id="scene" name="${esc(model.name)}">${nodes.join('')}</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#scene"/></scene></COLLADA>`;
  return new Blob([xml], { type: 'model/vnd.collada+xml' });
}

/** Export the stage as a 3D model. Returns the file and its name. */
export async function exportModel(format: ModelFormat, o: ModelOptions, base: string): Promise<{ blob: Blob; name: string; pieces: number }> {
  return with3D(async () => {
    if (!exporter.scene) throw new Error('The 3D view isn’t ready yet. Try again in a moment.');
    return exporter.scene(async (scene) => {
    const model = collect(scene, o, format === 'blender');
    let pieces = 0;
    model.traverse((x) => (x as THREE.Mesh).isMesh && pieces++);
    if (!pieces) throw new Error('There’s nothing to export.');
    const out =
      format === 'blender' ? { blob: await glb(model), name: `${base}.glb` } : format === 'sketchup' ? { blob: collada(model), name: `${base}.dae` } : { blob: await objZip(model, base), name: `${base}${format === 'rhino' ? '-rhino' : ''}-obj.zip` };
    model.traverse((x) => (x as THREE.Mesh).isMesh && (x as THREE.Mesh).geometry.dispose());
    return { ...out, pieces };
    });
  });
}
