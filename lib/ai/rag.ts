import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { WebLLMEmbeddings } from './embeddings';
import {
  putRecords,
  search,
  indexedNoteIds,
  type SearchFilters,
  type VectorRecord,
} from './vectorstore';
import { sectionToPlainText } from './render';
import type { NotesDocument } from './types';
import type { ProgressHandler } from './engine';

/**
 * Local retrieval-augmented generation.
 *
 * Indexing and retrieval both run in the browser against the IndexedDB store —
 * nothing is sent anywhere. LangChain supplies the splitter and the Embeddings
 * interface; generation is driven through WebLLM directly rather than through
 * ChatWebLLM, which has known breakage against recent web-llm releases.
 */

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
});

let embedder: WebLLMEmbeddings | null = null;

export function getEmbedder(onProgress?: ProgressHandler): WebLLMEmbeddings {
  if (!embedder) embedder = new WebLLMEmbeddings({ onProgress });
  return embedder;
}

export interface IndexNoteInput {
  courseId: string;
  noteId: string;
  unitId: string | null;
  document: NotesDocument;
}

/** Index one note's sections. Safe to call repeatedly — ids are deterministic. */
export async function indexNote(
  input: IndexNoteInput,
  onProgress?: ProgressHandler
): Promise<number> {
  const { courseId, noteId, unitId, document } = input;

  const passages = document.sections.map((s) => sectionToPlainText(s)).filter(Boolean);
  if (!passages.length) return 0;

  const splits = await splitter.createDocuments(passages);
  const texts = splits.map((d) => d.pageContent);
  if (!texts.length) return 0;

  const vectors = await getEmbedder(onProgress).embedDocuments(texts);

  const records: VectorRecord[] = texts.map((text, i) => ({
    id: `${noteId}:${i}`,
    courseId,
    noteId,
    unitId,
    title: document.title,
    text,
    embedding: vectors[i],
    createdAt: Date.now(),
  }));

  await putRecords(records);
  return records.length;
}

export interface IndexableNote {
  id: string;
  unit_id: string | null;
  notes_json: NotesDocument | null;
}

/**
 * Index any notes not already present locally.
 *
 * The extension and the web app are separate origins with separate IndexedDB
 * stores, so an index built while generating in the extension is invisible here.
 * Each origin therefore rebuilds its own index from the notes the server holds.
 * Notes saved before notes_json existed have nothing to index and are skipped —
 * generation falls back to raw note text for those.
 */
export async function ensureNotesIndexed(
  courseId: string,
  notes: IndexableNote[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const indexable = notes.filter((n) => n.notes_json?.sections?.length);
  if (!indexable.length) return 0;

  const alreadyIndexed = new Set(await indexedNoteIds(courseId));
  const pending = indexable.filter((n) => !alreadyIndexed.has(n.id));
  if (!pending.length) return 0;

  let done = 0;
  for (const note of pending) {
    try {
      await indexNote({
        courseId,
        noteId: note.id,
        unitId: note.unit_id,
        document: note.notes_json as NotesDocument,
      });
    } catch {
      // Indexing is an optimization; retrieval falls back to raw text.
    }
    done++;
    onProgress?.(done, pending.length);
  }
  return done;
}

export interface RetrievedContext {
  text: string;
  chunksUsed: number;
}

/**
 * Retrieve context for a query. Returns empty when nothing is indexed yet, so
 * callers can fall back to using raw note text.
 */
export async function retrieveContext(
  query: string,
  filters: SearchFilters,
  opts: { topK?: number; maxChars?: number } = {}
): Promise<RetrievedContext> {
  const { topK = 8, maxChars = 6000 } = opts;

  let queryVector: number[];
  try {
    queryVector = await getEmbedder().embedQuery(query);
  } catch {
    return { text: '', chunksUsed: 0 };
  }

  const hits = await search(queryVector, filters, topK);
  if (!hits.length) return { text: '', chunksUsed: 0 };

  const parts: string[] = [];
  let total = 0;
  for (const hit of hits) {
    if (total + hit.text.length > maxChars) break;
    parts.push(hit.text);
    total += hit.text.length;
  }

  return { text: parts.join('\n\n'), chunksUsed: parts.length };
}
