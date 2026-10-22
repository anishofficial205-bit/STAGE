/**
 * "My templates": custom stages saved from Build Your Own (outline, seating
 * and room), with a thumbnail. They live in IndexedDB, so every project in
 * this browser can use them, and they travel inside project .zip exports.
 */
import { create } from 'zustand';
import { TEMPLATES, deleteRecord, getAllRecords, putRecord } from '../../graphics/db';
import { exporter } from '../../export/state';
import { useProjectStore } from '../../store/useProjectStore';
import type { Params } from '../../types';

export const CUSTOM_ID = 'custom';

export interface SavedTemplate {
  id: string;
  name: string;
  /** Small JPEG data URL. */
  thumbnail: string;
  savedAt: number;
  params: Params;
  data: unknown;
}

export const useMyTemplates = create<{ list: SavedTemplate[]; loaded: boolean }>(() => ({ list: [], loaded: false }));

export async function refreshMyTemplates() {
  try {
    const list = await getAllRecords<SavedTemplate>(TEMPLATES);
    useMyTemplates.setState({ list: list.filter(isSaved).sort((a, b) => b.savedAt - a.savedAt), loaded: true });
  } catch {
    useMyTemplates.setState({ loaded: true });
  }
}

const isSaved = (t: unknown): t is SavedTemplate => !!t && typeof (t as SavedTemplate).id === 'string' && typeof (t as SavedTemplate).name === 'string' && typeof (t as SavedTemplate).params === 'object';

/** Save the current Build Your Own stage under a name, with a snapshot of the view. */
export async function saveMyTemplate(name: string) {
  const s = useProjectStore.getState();
  if (s.templateId !== CUSTOM_ID) throw new Error('Only a Build Your Own stage can be saved as a template.');
  let thumbnail = '';
  try {
    thumbnail = (await exporter.capture?.({ width: 320, height: 200, labels: false, type: 'image/jpeg' })) ?? '';
  } catch {
    // No thumbnail is fine.
  }
  const t: SavedTemplate = { id: `t${Date.now().toString(36)}`, name: name.trim() || 'My stage', thumbnail, savedAt: Date.now(), params: s.paramsByTemplate[CUSTOM_ID], data: s.dataByTemplate[CUSTOM_ID] };
  await putRecord(TEMPLATES, t.id, t);
  await refreshMyTemplates();
  return t;
}

export async function deleteMyTemplate(id: string) {
  await deleteRecord(TEMPLATES, id);
  await refreshMyTemplates();
}

/** Put a saved stage into the current project (undoable). */
export function applySavedTemplate(t: SavedTemplate) {
  useProjectStore.getState().loadTemplateState(CUSTOM_ID, t.params, t.data, `Loaded “${t.name}”`);
}

/** Saved templates restored from an imported project (kept alongside any already here). */
export async function importMyTemplates(raw: unknown) {
  if (!Array.isArray(raw)) return;
  for (const t of raw) if (isSaved(t)) await putRecord(TEMPLATES, t.id, t);
  await refreshMyTemplates();
}
