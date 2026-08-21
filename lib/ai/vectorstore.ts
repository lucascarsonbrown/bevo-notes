import { cosineSimilarity } from './embeddings';

/**
 * IndexedDB-backed vector store.
 *
 * The server no longer stores vectors, so the index is per-device: it is built
 * on this machine and disappears if the user clears site data. Records carry
 * enough metadata to rebuild scoped to one course.
 */

const DB_NAME = 'bevo-vectors';
const DB_VERSION = 1;
const STORE = 'chunks';

export interface VectorRecord {
  id: string;
  courseId: string;
  noteId: string | null;
  unitId: string | null;
  title: string;
  text: string;
  embedding: number[];
  createdAt: number;
}

export interface SearchFilters {
  courseId: string;
  unitIds?: string[];
  noteIds?: string[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('courseId', 'courseId', { unique: false });
        store.createIndex('noteId', 'noteId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putRecords(records: VectorRecord[]): Promise<void> {
  if (!records.length) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const record of records) store.put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function recordsForCourse(courseId: string): Promise<VectorRecord[]> {
  const db = await openDB();
  const all = await new Promise<VectorRecord[]>((resolve, reject) => {
    const request = db
      .transaction(STORE, 'readonly')
      .objectStore(STORE)
      .index('courseId')
      .getAll(courseId);
    request.onsuccess = () => resolve(request.result as VectorRecord[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return all;
}

export interface ScoredRecord extends VectorRecord {
  score: number;
}

/** Brute-force cosine search. Per-course corpora are small enough that an index would be premature. */
export async function search(
  queryEmbedding: number[],
  filters: SearchFilters,
  topK = 8
): Promise<ScoredRecord[]> {
  let records = await recordsForCourse(filters.courseId);

  if (filters.unitIds?.length) {
    const wanted = new Set(filters.unitIds);
    records = records.filter((r) => r.unitId && wanted.has(r.unitId));
  }
  if (filters.noteIds?.length) {
    const wanted = new Set(filters.noteIds);
    records = records.filter((r) => r.noteId && wanted.has(r.noteId));
  }

  return records
    .map((r) => ({ ...r, score: cosineSimilarity(queryEmbedding, r.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function deleteByNote(noteId: string): Promise<void> {
  const db = await openDB();
  const ids = await new Promise<string[]>((resolve, reject) => {
    const request = db
      .transaction(STORE, 'readonly')
      .objectStore(STORE)
      .index('noteId')
      .getAllKeys(noteId);
    request.onsuccess = () => resolve(request.result as string[]);
    request.onerror = () => reject(request.error);
  });

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const id of ids) store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function countForCourse(courseId: string): Promise<number> {
  return (await recordsForCourse(courseId)).length;
}

export async function clearAll(): Promise<void> {
  const db = await openDB();
  await tx(db, 'readwrite', (store) => store.clear());
  db.close();
}
