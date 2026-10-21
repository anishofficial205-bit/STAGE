import { create } from 'zustand';
import type { Params, PresetView } from '../types';
import type { Units } from '../units';
import { getTemplate, templates } from '../templates/registry';
import { getObjectType } from '../objects/registry';
import type { SetObject } from '../objects/types';
import { applyConstraints, defaultParams } from '../helpers/params';

const STORAGE_KEY = 'stage-builder:project';
const FILE_VERSION = 2;
const HISTORY_LIMIT = 100;
/** Edits with the same key within this window merge into one undo step (e.g. dragging a slider). */
const COALESCE_MS = 1000;
/** Pass as an edit's key to fold it into the previous undo step. */
export const MERGE_WITH_PREVIOUS = '@merge';

/** What gets saved to localStorage and exported as JSON. */
export interface ProjectFile {
  app: 'stage-builder';
  version: number;
  projectName: string;
  units: Units;
  showLabels: boolean;
  templateId: string;
  /** Each template keeps its own params, so switching back and forth loses nothing. */
  paramsByTemplate: Record<string, Params>;
  /** Free-form data for templates that have it (see TemplateDataHooks). */
  dataByTemplate: Record<string, unknown>;
  /** The set built on each template. */
  objectsByTemplate: Record<string, SetObject[]>;
}

/** The parts of the project that undo/redo restores. */
type Doc = Pick<ProjectFile, 'templateId' | 'paramsByTemplate' | 'dataByTemplate' | 'objectsByTemplate'>;

export interface ViewRequest {
  view: PresetView;
  instant: boolean;
  nonce: number;
}

interface ProjectState extends Omit<ProjectFile, 'app' | 'version'> {
  dirty: boolean;
  lastSavedAt: number | null;
  viewRequest: ViewRequest | null;
  /** Width / height of the 3D viewport, so views can frame the scene properly. */
  viewportAspect: number;

  // History
  past: Doc[];
  future: Doc[];
  /** Shown as an "Undo" toast after bulk changes (preset, reset, template switch). */
  lastAction: { label: string; nonce: number } | null;
  undo: () => void;
  redo: () => void;
  dismissLastAction: () => void;

  // Selection and editing preferences (not part of undo history)
  selectedIds: string[];
  snapping: boolean;
  select: (ids: string[], additive?: boolean) => void;
  toggleSnapping: () => void;

  setProjectName: (name: string) => void;
  setUnits: (units: Units) => void;
  toggleLabels: () => void;
  /** Switch template, either from defaults or carrying the stage width/depth/height across. */
  switchTemplate: (id: string, mode: 'fresh' | 'similar') => void;
  resetToDefaults: () => void;
  applyPreset: (index: number) => void;
  setParam: (key: string, value: Params[string]) => void;
  /** Update the active template's data. */
  setData: (update: (data: unknown) => unknown, coalesceKey?: string) => void;

  // Set objects (on the active template)
  addObject: (type: string, at?: { x: number; z: number }) => string | null;
  /** Change objects. `key` merges rapid edits (drags, sliders) into one undo step. */
  updateObjects: (update: (objects: SetObject[]) => SetObject[], key?: string) => void;
  removeObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[]) => void;

  requestView: (view: PresetView, instant?: boolean) => void;
  setViewportAspect: (aspect: number) => void;
  save: () => void;
  toFile: () => ProjectFile;
  loadFile: (data: unknown) => void;
}

function freshProject(): Omit<ProjectFile, 'app' | 'version'> {
  const paramsByTemplate = Object.fromEntries(templates.map((t) => [t.id, defaultParams(t)]));
  return {
    projectName: 'Untitled stage',
    units: 'm',
    showLabels: true,
    templateId: templates[0].id,
    paramsByTemplate,
    dataByTemplate: Object.fromEntries(templates.filter((t) => t.data).map((t) => [t.id, t.data!.initial(paramsByTemplate[t.id])])),
    objectsByTemplate: {},
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Drop unknown object types and repair bad values in saved objects. */
function sanitizeObjects(raw: unknown): SetObject[] {
  if (!Array.isArray(raw)) return [];
  const out: SetObject[] = [];
  for (const o of raw as Partial<SetObject>[]) {
    const type = o && typeof o.type === 'string' ? getObjectType(o.type) : undefined;
    if (!type || !o) continue;
    out.push({
      id: typeof o.id === 'string' ? o.id : newObjectId(),
      type: type.id,
      name: typeof o.name === 'string' ? o.name : type.name,
      params: applyConstraints(type, { ...defaultParams(type), ...(o.params ?? {}) }),
      x: isNum(o.x) ? o.x : 0,
      z: isNum(o.z) ? o.z : 0,
      elevation: isNum(o.elevation) ? o.elevation : 0,
      rotation: isNum(o.rotation) ? o.rotation : 0,
      hidden: !!o.hidden,
      locked: !!o.locked,
    });
  }
  return out;
}

/** Validate an unknown object (from storage or an imported file) into a project. */
function parseProject(data: unknown): Omit<ProjectFile, 'app' | 'version'> {
  if (!data || typeof data !== 'object') throw new Error('Not a valid project file.');
  const d = data as Partial<ProjectFile>;
  if (d.app !== 'stage-builder') throw new Error('This file is not a Stage Builder project.');
  const base = freshProject();
  const saved = d.paramsByTemplate && typeof d.paramsByTemplate === 'object' ? d.paramsByTemplate : {};
  const savedData = d.dataByTemplate && typeof d.dataByTemplate === 'object' ? d.dataByTemplate : {};
  const savedObjects = d.objectsByTemplate && typeof d.objectsByTemplate === 'object' ? d.objectsByTemplate : {};
  const paramsByTemplate = Object.fromEntries(
    templates.map((t) => [t.id, applyConstraints(t, { ...base.paramsByTemplate[t.id], ...saved[t.id] })]),
  );
  return {
    projectName: typeof d.projectName === 'string' ? d.projectName : base.projectName,
    units: d.units === 'ft' ? 'ft' : 'm',
    showLabels: typeof d.showLabels === 'boolean' ? d.showLabels : true,
    templateId: d.templateId && getTemplate(d.templateId) ? d.templateId : base.templateId,
    paramsByTemplate,
    dataByTemplate: Object.fromEntries(
      templates
        .filter((t) => t.data)
        .map((t) => {
          const p = paramsByTemplate[t.id];
          return [t.id, t.id in savedData ? t.data!.sanitize(savedData[t.id], p) : t.data!.initial(p)];
        }),
    ),
    objectsByTemplate: Object.fromEntries(templates.map((t) => [t.id, sanitizeObjects(savedObjects[t.id])])),
  };
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseProject(JSON.parse(raw));
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return freshProject();
}

let nonce = 0;
let idCounter = 0;
export const newObjectId = () => `o${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/** Name like "Flat 3": one more than the highest number already used for that type. */
function nextName(base: string, objects: SetObject[]) {
  const used = objects.map((o) => o.name.match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`))?.[1]).filter(Boolean).map(Number);
  return `${base} ${used.length ? Math.max(...used) + 1 : 1}`;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  let lastCommit = { key: '', time: 0 };

  const doc = (): Doc => {
    const s = get();
    return { templateId: s.templateId, paramsByTemplate: s.paramsByTemplate, dataByTemplate: s.dataByTemplate, objectsByTemplate: s.objectsByTemplate };
  };

  /** Record the current state as an undo step before a change. */
  const commit = (key = '') => {
    // MERGE_WITH_PREVIOUS: a follow-up adjustment that belongs to the step just recorded.
    if (key === MERGE_WITH_PREVIOUS) return;
    const now = Date.now();
    if (key && key === lastCommit.key && now - lastCommit.time < COALESCE_MS) {
      lastCommit.time = now;
      return;
    }
    lastCommit = { key, time: now };
    set((s) => ({ past: [...s.past, doc()].slice(-HISTORY_LIMIT), future: [] }));
  };

  const announce = (label: string) => ({ lastAction: { label, nonce: ++nonce } });

  const activeObjects = () => {
    const s = get();
    return s.objectsByTemplate[s.templateId] ?? [];
  };
  const setActiveObjects = (objects: SetObject[]) =>
    set((s) => ({ objectsByTemplate: { ...s.objectsByTemplate, [s.templateId]: objects }, dirty: true }));

  return {
    ...loadFromStorage(),
    dirty: false,
    lastSavedAt: null,
    viewRequest: null,
    viewportAspect: 1.6,
    past: [],
    future: [],
    lastAction: null,
    selectedIds: [],
    snapping: true,

    undo: () => {
      const { past } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      lastCommit = { key: '', time: 0 };
      set((s) => ({ ...prev, past: s.past.slice(0, -1), future: [...s.future, doc()], lastAction: null, dirty: true }));
      get().select(get().selectedIds); // drop selections of objects that no longer exist
    },
    redo: () => {
      const { future } = get();
      if (!future.length) return;
      const next = future[future.length - 1];
      lastCommit = { key: '', time: 0 };
      set((s) => ({ ...next, future: s.future.slice(0, -1), past: [...s.past, doc()], dirty: true }));
      get().select(get().selectedIds);
    },
    dismissLastAction: () => set({ lastAction: null }),

    select: (ids, additive = false) => {
      const existing = new Set(activeObjects().map((o) => o.id));
      const current = get().selectedIds;
      let next = ids;
      if (additive) {
        next = [...current];
        for (const id of ids) next = next.includes(id) ? next.filter((x) => x !== id) : [...next, id];
      }
      next = next.filter((id) => existing.has(id));
      if (next.length !== current.length || next.some((id, i) => id !== current[i])) set({ selectedIds: next });
    },
    toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),

    setProjectName: (projectName) => set({ projectName, dirty: true }),
    setUnits: (units) => set({ units, dirty: true }),
    toggleLabels: () => set((s) => ({ showLabels: !s.showLabels, dirty: true })),

    switchTemplate: (id, mode) => {
      const s = get();
      const from = getTemplate(s.templateId)!;
      const to = getTemplate(id)!;
      commit();
      let params: Params;
      if (mode === 'fresh') {
        params = applyConstraints(to, defaultParams(to));
      } else {
        // Start from the target's own settings and carry the shared dimensions across.
        params = { ...s.paramsByTemplate[id] };
        const src = s.paramsByTemplate[s.templateId];
        for (const dim of ['width', 'depth', 'height'] as const) {
          const a = from.dimensions?.[dim];
          const b = to.dimensions?.[dim];
          if (a && b) params[b] = src[a];
        }
        params = applyConstraints(to, params);
      }
      set({
        templateId: id,
        paramsByTemplate: { ...s.paramsByTemplate, [id]: params },
        dataByTemplate: to.data ? { ...s.dataByTemplate, [id]: mode === 'fresh' ? to.data.initial(params) : to.data.sanitize(s.dataByTemplate[id], params) } : s.dataByTemplate,
        selectedIds: [],
        ...announce(`Switched to ${to.name}`),
        dirty: true,
      });
    },

    resetToDefaults: () => {
      const s = get();
      const t = getTemplate(s.templateId)!;
      commit();
      const params = applyConstraints(t, defaultParams(t));
      set({
        paramsByTemplate: { ...s.paramsByTemplate, [t.id]: params },
        dataByTemplate: t.data ? { ...s.dataByTemplate, [t.id]: t.data.initial(params) } : s.dataByTemplate,
        ...announce(`Reset ${t.name} to defaults`),
        dirty: true,
      });
    },

    applyPreset: (index) => {
      const s = get();
      const t = getTemplate(s.templateId)!;
      const preset = t.presets?.[index];
      if (!preset) return;
      commit();
      const prev = s.paramsByTemplate[t.id];
      const params = applyConstraints(t, { ...prev, ...preset.params });
      let data = s.dataByTemplate[t.id];
      if (t.data) data = preset.resetData ? t.data.initial(params) : t.data.onParamsChange ? t.data.onParamsChange(params, prev, data) : data;
      set({
        paramsByTemplate: { ...s.paramsByTemplate, [t.id]: params },
        dataByTemplate: t.data ? { ...s.dataByTemplate, [t.id]: data } : s.dataByTemplate,
        ...announce(`Applied “${preset.name}”`),
        dirty: true,
      });
    },

    setParam: (key, value) => {
      const { templateId, paramsByTemplate, dataByTemplate } = get();
      const template = getTemplate(templateId)!;
      commit(`param:${templateId}:${key}`);
      const prev = paramsByTemplate[templateId];
      const next = applyConstraints(template, { ...prev, [key]: value });
      const hook = template.data?.onParamsChange;
      set({
        paramsByTemplate: { ...paramsByTemplate, [templateId]: next },
        ...(hook ? { dataByTemplate: { ...dataByTemplate, [templateId]: hook(next, prev, dataByTemplate[templateId]) } } : {}),
        dirty: true,
      });
    },

    setData: (update, coalesceKey) => {
      commit(coalesceKey);
      const { templateId, dataByTemplate } = get();
      set({ dataByTemplate: { ...dataByTemplate, [templateId]: update(dataByTemplate[templateId]) }, dirty: true });
    },

    addObject: (typeId, at) => {
      const type = getObjectType(typeId);
      if (!type) return null;
      commit();
      const objects = activeObjects();
      const obj: SetObject = {
        id: newObjectId(),
        type: type.id,
        name: nextName(type.name, objects),
        params: applyConstraints(type, defaultParams(type)),
        x: at?.x ?? 0,
        z: at?.z ?? 0,
        elevation: type.defaultElevation ?? 0,
        rotation: 0,
      };
      setActiveObjects([...objects, obj]);
      set({ selectedIds: [obj.id] });
      return obj.id;
    },

    updateObjects: (update, key) => {
      commit(key);
      setActiveObjects(update(activeObjects()));
    },

    removeObjects: (ids) => {
      if (!ids.length) return;
      commit();
      setActiveObjects(activeObjects().filter((o) => !ids.includes(o.id)));
      set((s) => ({ selectedIds: s.selectedIds.filter((id) => !ids.includes(id)) }));
    },

    duplicateObjects: (ids) => {
      const objects = activeObjects();
      const sources = objects.filter((o) => ids.includes(o.id));
      if (!sources.length) return;
      commit();
      const all = [...objects];
      const copies = sources.map((o) => {
        const copy = { ...o, id: newObjectId(), name: nextName(o.name.replace(/ \d+$/, ''), all), x: o.x + 0.5, z: o.z + 0.5, locked: false };
        all.push(copy);
        return copy;
      });
      setActiveObjects(all);
      set({ selectedIds: copies.map((c) => c.id) });
    },

    requestView: (view, instant = false) => set({ viewRequest: { view, instant, nonce: ++nonce } }),
    setViewportAspect: (viewportAspect) => set({ viewportAspect }),

    toFile: () => {
      const { projectName, units, showLabels, templateId, paramsByTemplate, dataByTemplate, objectsByTemplate } = get();
      return { app: 'stage-builder', version: FILE_VERSION, projectName, units, showLabels, templateId, paramsByTemplate, dataByTemplate, objectsByTemplate };
    },

    save: () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().toFile()));
      set({ dirty: false, lastSavedAt: Date.now() });
    },

    /** Throws with a readable message if the data isn't a valid project. */
    loadFile: (data) => {
      const parsed = parseProject(data);
      commit();
      set({ ...parsed, selectedIds: [], lastAction: null, dirty: true });
    },
  };
});

/** Params of the active template. */
export const useActiveParams = () => useProjectStore((s) => s.paramsByTemplate[s.templateId]);
/** Data of the active template (undefined for templates without data). */
export const useActiveData = () => useProjectStore((s) => s.dataByTemplate[s.templateId]);
const NO_OBJECTS: SetObject[] = [];
/** Objects placed on the active template. */
export const useActiveObjects = () => useProjectStore((s) => s.objectsByTemplate[s.templateId] ?? NO_OBJECTS);
