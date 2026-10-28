/**
 * Recent projects: every project worked on in this browser is kept (with a
 * small picture) so the start screen can list and reopen it. The open project
 * still autosaves to localStorage; this copy is updated alongside it.
 */
import { create } from 'zustand';
import { PROJECTS, deleteRecord, getAllRecords, getRecord, putRecord } from '../graphics/db';
import { freshProject, newProjectId, useProjectStore } from '../store/useProjectStore';
import { exportCurrentView } from '../export/exports';

export interface ProjectRecord {
  id: string;
  name: string;
  savedAt: number;
  /** data: URL of a small render, if one was taken. */
  thumbnail?: string;
  file: unknown;
}

export const useRecentProjects = create<{ list: ProjectRecord[] }>(() => ({ list: [] }));

export async function refreshRecent() {
  try {
    const all = await getAllRecords<ProjectRecord>(PROJECTS);
    useRecentProjects.setState({ list: all.sort((a, b) => b.savedAt - a.savedAt) });
  } catch {
    /* IndexedDB unavailable: no recent list */
  }
}

/** Writes run one at a time, so a slow one can't overwrite a newer one. */
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>) => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
};

/** Store the open project in the recent list, as it is right now (keeps its picture). */
/** An untouched "Untitled stage" isn't worth listing. */
function isBlank() {
  const s = useProjectStore.getState();
  if (s.projectName !== 'Untitled stage') return false;
  const any = (m: Record<string, { length: number } | undefined>) => Object.values(m).some((v) => (v?.length ?? 0) > 0);
  return (
    !any(s.objectsByTemplate) &&
    !Object.values(s.lightingByTemplate).some((l) => l && l.fixtures.length > 0) &&
    !Object.values(s.blockingByTemplate).some((b) => b && b.performers.length > 0) &&
    s.venue.walls.length === 0
  );
}

export function recordCurrentProject() {
  if (isBlank()) return Promise.resolve();
  const s = useProjectStore.getState();
  const snap = { id: s.projectId, name: s.projectName, file: s.toFile() };
  return serial(async () => {
    try {
      const prev = await getRecord<ProjectRecord>(PROJECTS, snap.id);
      await putRecord(PROJECTS, snap.id, { ...snap, savedAt: Date.now(), thumbnail: prev?.thumbnail } satisfies ProjectRecord);
      await refreshRecent();
    } catch {
      /* not recorded */
    }
  });
}

let captures: Promise<unknown> = Promise.resolve();

/**
 * A small render of the current view for the recent list. Renders run one after
 * another (each gives up after a minute); `forId` skips the render if a different
 * project is open by then.
 */
export function captureThumbnail(forId?: string): Promise<string | undefined> {
  const run = async () => {
    if (forId && useProjectStore.getState().projectId !== forId) return undefined;
    const shot = (async () => {
      const blob = await exportCurrentView(480, 300, false);
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    })().catch(() => undefined);
    const t = await Promise.race([shot, new Promise<undefined>((r) => window.setTimeout(() => r(undefined), 60000))]);
    return forId && useProjectStore.getState().projectId !== forId ? undefined : t;
  };
  const next = captures.then(run, run);
  captures = next.catch(() => undefined);
  return next;
}

/** Save the open project to the recent list now, then add a fresh picture of it. */
export async function recordWithPicture() {
  const id = useProjectStore.getState().projectId;
  await recordCurrentProject();
  const thumbnail = await captureThumbnail(id);
  if (!thumbnail) return;
  await serial(async () => {
    try {
      const prev = await getRecord<ProjectRecord>(PROJECTS, id);
      if (prev) {
        await putRecord(PROJECTS, id, { ...prev, thumbnail });
        await refreshRecent();
      }
    } catch {
      /* no picture */
    }
  });
}

/** Rename a project in the list (and the open project, if it's this one). */
export async function renameProject(id: string, name: string) {
  const store = useProjectStore.getState();
  if (store.projectId === id) store.setProjectName(name);
  await serial(async () => {
    const prev = await getRecord<ProjectRecord>(PROJECTS, id);
    if (prev) await putRecord(PROJECTS, id, { ...prev, name, file: { ...(prev.file as object), projectName: name } });
  });
  await refreshRecent();
}

/** A copy of a project with its own id, named "… copy". */
export async function duplicateProject(id: string) {
  const prev = await getRecord<ProjectRecord>(PROJECTS, id);
  if (!prev) return;
  const copyId = newProjectId();
  const name = `${prev.name} copy`;
  await putRecord(PROJECTS, copyId, { ...prev, id: copyId, name, savedAt: Date.now(), file: { ...(prev.file as object), projectId: copyId, projectName: name } } satisfies ProjectRecord);
  await refreshRecent();
}

/**
 * Remove projects from this browser. If one of them is open, a blank stage takes
 * its place — otherwise its autosave would put it straight back in the list.
 */
export const deleteProjects = async (ids: string[]) => {
  const store = useProjectStore.getState();
  if (ids.includes(store.projectId)) {
    store.loadFile({ ...freshProject(), app: 'stage-builder', version: 2, units: store.units });
    useProjectStore.getState().save();
  }
  await serial(async () => {
    for (const id of ids) await deleteRecord(PROJECTS, id);
  });
  await refreshRecent();
};

export const deleteProject = (id: string) => deleteProjects([id]);

let lastPicture = 0;
/** Keep the recent list in step with saves; refresh the picture at most every two minutes. */
export function startRecentSync() {
  lastPicture = Date.now();
  return useProjectStore.subscribe((s, prev) => {
    if (s.lastSavedAt === prev.lastSavedAt || !s.lastSavedAt) return;
    const now = Date.now();
    if (now - lastPicture > 120_000) {
      lastPicture = now;
      void recordWithPicture();
    } else void recordCurrentProject();
  });
}
