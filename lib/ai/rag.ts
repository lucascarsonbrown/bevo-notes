import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { WebLLMEmbeddings } from './embeddings';
import { putRecords, search, type SearchFilters, type VectorRecord } from './vectorstore';
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
