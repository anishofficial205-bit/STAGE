import { create } from 'zustand';
import type { Params, PresetView } from '../types';
import type { Units } from '../units';
import { getTemplate, templates } from '../templates/registry';
import { applyConstraints, defaultParams } from '../helpers/params';

const STORAGE_KEY = 'stage-builder:project';
const FILE_VERSION = 1;

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
}

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

  setProjectName: (name: string) => void;
  setUnits: (units: Units) => void;
  toggleLabels: () => void;
  setTemplate: (id: string) => void;
  setParam: (key: string, value: Params[string]) => void;
  requestView: (view: PresetView, instant?: boolean) => void;
  setViewportAspect: (aspect: number) => void;
  save: () => void;
  toFile: () => ProjectFile;
  loadFile: (data: unknown) => void;
}

function freshProject(): Omit<ProjectFile, 'app' | 'version'> {
  return {
    projectName: 'Untitled stage',
    units: 'm',
    showLabels: true,
    templateId: templates[0].id,
    paramsByTemplate: Object.fromEntries(templates.map((t) => [t.id, defaultParams(t)])),
  };
}

/** Validate an unknown object (from storage or an imported file) into a project. */
function parseProject(data: unknown): Omit<ProjectFile, 'app' | 'version'> {
  if (!data || typeof data !== 'object') throw new Error('Not a valid project file.');
  const d = data as Partial<ProjectFile>;
  if (d.app !== 'stage-builder') throw new Error('This file is not a Stage Builder project.');
  const base = freshProject();
  const saved = d.paramsByTemplate && typeof d.paramsByTemplate === 'object' ? d.paramsByTemplate : {};
  return {
    projectName: typeof d.projectName === 'string' ? d.projectName : base.projectName,
    units: d.units === 'ft' ? 'ft' : 'm',
    showLabels: typeof d.showLabels === 'boolean' ? d.showLabels : true,
    templateId: d.templateId && getTemplate(d.templateId) ? d.templateId : base.templateId,
    paramsByTemplate: Object.fromEntries(
      templates.map((t) => [t.id, applyConstraints(t, { ...base.paramsByTemplate[t.id], ...saved[t.id] })]),
    ),
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

export const useProjectStore = create<ProjectState>((set, get) => ({
  ...loadFromStorage(),
  dirty: false,
  lastSavedAt: null,
  viewRequest: null,
  viewportAspect: 1.6,

  setProjectName: (projectName) => set({ projectName, dirty: true }),
  setUnits: (units) => set({ units, dirty: true }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels, dirty: true })),
  setTemplate: (templateId) => set({ templateId, dirty: true }),

  setParam: (key, value) => {
    const { templateId, paramsByTemplate } = get();
    const template = getTemplate(templateId)!;
    const next = applyConstraints(template, { ...paramsByTemplate[templateId], [key]: value });
    set({ paramsByTemplate: { ...paramsByTemplate, [templateId]: next }, dirty: true });
  },

  requestView: (view, instant = false) => set({ viewRequest: { view, instant, nonce: ++nonce } }),
  setViewportAspect: (viewportAspect) => set({ viewportAspect }),

  toFile: () => {
    const { projectName, units, showLabels, templateId, paramsByTemplate } = get();
    return { app: 'stage-builder', version: FILE_VERSION, projectName, units, showLabels, templateId, paramsByTemplate };
  },

  save: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(get().toFile()));
    set({ dirty: false, lastSavedAt: Date.now() });
  },

  /** Throws with a readable message if the data isn't a valid project. */
  loadFile: (data) => set({ ...parseProject(data), dirty: true }),
}));

/** Params of the active template. */
export const useActiveParams = () => useProjectStore((s) => s.paramsByTemplate[s.templateId]);
