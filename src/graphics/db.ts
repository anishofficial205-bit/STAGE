/**
 * Image files for the graphics library, stored in IndexedDB (localStorage is
 * far too small for images). The project only keeps ids and metadata.
 */
const DB = 'stage-builder';
const STORE = 'graphics';
/** Saved custom stages ("My templates"), shared by every project in this browser. */
export const TEMPLATES = 'templates';
/** Recent projects for the start screen: the project file plus a small picture. */
export const PROJECTS = 'projects';

let opening: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 3);
    req.onupgradeneeded = () => {
      for (const name of [STORE, TEMPLATES, PROJECTS]) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const putBlob = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id)).then(() => undefined);
export const getBlob = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
export const deleteBlob = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined);

/** Records in another store (e.g. saved templates). */
export const putRecord = (store: string, id: string, value: unknown) => run('readwrite', (s) => s.put(value, id), store).then(() => undefined);
export const getAllRecords = <T>(store: string) => run<T[]>('readonly', (s) => s.getAll() as IDBRequest<T[]>, store);
export const getRecord = <T>(store: string, id: string) => run<T | undefined>('readonly', (s) => s.get(id) as IDBRequest<T | undefined>, store);
export const deleteRecord = (store: string, id: string) => run('readwrite', (s) => s.delete(id), store).then(() => undefined);
