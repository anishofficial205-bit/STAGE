/**
 * Image files for the graphics library, stored in IndexedDB (localStorage is
 * far too small for images). The project only keeps ids and metadata.
 */
const DB = 'stage-builder';
const STORE = 'graphics';

let opening: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const putBlob = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id)).then(() => undefined);
export const getBlob = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
export const deleteBlob = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined);
