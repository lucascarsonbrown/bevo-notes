import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { getEngine, generateJSON, type ProgressHandler } from './engine';
import { CHUNK_SCHEMA, TITLE_SCHEMA } from './schema';
import { chunkCues, chunkPlainText, parseVTT, cuesToText, type TranscriptChunk } from './chunk';
import { mergeChunks, fallbackTitle } from './merge';
import { renderNotes } from './render';
import { transcriptCharsPerPass, BUDGET } from './models';
import type { Capability } from './capability';
import type { ChunkResult, NotesDocument, Cue } from './types';

/**
 * Browser-side lecture note generation.
 *
 * Kept deliberately short — the per-pass budget assumes ~350 tokens of system
 * prompt, and a 1B model ignores long lists of rules anyway. Structure is
 * enforced by the JSON schema, not by asking for it in prose.
 */
const SYSTEM_PROMPT = `You turn part of a university lecture transcript into structured study notes.

Rules:
- Split the excerpt into sections by topic. One section per topic.
- heading: a short topic title.
- summary: 1-3 sentences of plain prose explaining the topic.
- definitions: terms the lecturer defined, with their meaning.
- formulas: mathematics as LaTeX in the "latex" field, plus a short explanation. Never write HTML or MathML.
- examples: worked problems, with the steps taken.
- key_points: short factual takeaways.

Only use information present in the excerpt. Do not invent content. Leave an array empty if the excerpt has nothing for it. Ignore filler, jokes, and classroom chatter.`;

const TITLE_PROMPT = `Given the section headings of one lecture, reply with a single short lecture title that covers them. Reply with JSON only.`;

export interface NoteProgress {
  phase: 'loading-model' | 'generating' | 'merging' | 'done';
  /** 0..1 within the current phase. */
  progress: number;
  message: string;
  completedChunks?: number;
  totalChunks?: number;
}

export interface GenerateNotesOptions {
  capability: Capability;
  /** Raw VTT text, if available — preferred, since timings give better splits. */
  vtt?: string;
  /** Plain transcript, used when no VTT is available. */
  transcript?: string;
  onProgress?: (p: NoteProgress) => void;
  signal?: AbortSignal;
}

export interface GenerateNotesResult {
  document: NotesDocument;
  html: string;
  /** Flattened transcript, for hashing and storage. */
  transcript: string;
  chunkCount: number;
  failedChunks: number;
}

function buildChunks(opts: GenerateNotesOptions, maxChars: number): {
  chunks: TranscriptChunk[];
  transcript: string;
} {
  if (opts.vtt?.trim()) {
    const cues: Cue[] = parseVTT(opts.vtt);
    if (cues.length) {
      return { chunks: chunkCues(cues, maxChars), transcript: cuesToText(cues) };
    }
  }

  const plain = (opts.transcript ?? '').trim();
  return { chunks: chunkPlainText(plain, maxChars), transcript: plain };
}

export async function generateNotes(
  opts: GenerateNotesOptions
): Promise<GenerateNotesResult> {
  const { capability, onProgress, signal } = opts;

  if (capability.mode === 'readonly' || !capability.model) {
    throw new Error('This device cannot generate notes.');
  }

  const spec = capability.model;
  const maxChars = transcriptCharsPerPass(spec);
  const { chunks, transcript } = buildChunks(opts, maxChars);

  if (!chunks.length) throw new Error('Transcript is empty.');

  const loadProgress: ProgressHandler = (r) =>
    onProgress?.({ phase: 'loading-model', progress: r.progress, message: r.text });

  onProgress?.({ phase: 'loading-model', progress: 0, message: 'Preparing model…' });
  const engine = await getEngine(spec, loadProgress);
  signal?.throwIfAborted();

  // Chunks are independent — drift is absorbed by dedupe at merge time, not by
  // threading shared context through the passes. Run them sequentially anyway:
  // one engine cannot serve concurrent completions, and sequential keeps the
  // progress counter honest.
  const results: ChunkResult[] = [];
  let failedChunks = 0;

  for (let i = 0; i < chunks.length; i++) {
    signal?.throwIfAborted();
    onProgress?.({
      phase: 'generating',
      progress: i / chunks.length,
      message: `Writing notes — section ${i + 1} of ${chunks.length}`,
      completedChunks: i,
      totalChunks: chunks.length,
    });

    try {
      const result = await generateJSON<ChunkResult>(engine, {
        system: SYSTEM_PROMPT,
        user: chunks[i].text,
        schema: CHUNK_SCHEMA,
        maxTokens: BUDGET.outputReserveTokens,
      });
      results.push(result);
    } catch {
      // One bad pass shouldn't lose the whole lecture.
      failedChunks++;
    }
  }

  if (!results.length) {
    throw new Error('The model could not produce notes for this lecture.');
  }

  onProgress?.({ phase: 'merging', progress: 0.9, message: 'Combining sections…' });
  const sections = mergeChunks(results);

  if (!sections.length) {
    throw new Error('The model produced no usable sections for this lecture.');
  }

  const title = await generateTitle(engine, sections.map((s) => s.heading)).catch(() =>
    fallbackTitle(sections)
  );

  const document: NotesDocument = { title, sections };
  onProgress?.({ phase: 'done', progress: 1, message: 'Done' });

  return {
    document,
    html: renderNotes(document),
    transcript,
    chunkCount: chunks.length,
    failedChunks,
  };
}

/**
 * The only model call in the reduce step, and it only sees headings — a
 * full-document merge pass would exceed the same context window the chunking
 * exists to work around.
 */
async function generateTitle(
  engine: MLCEngineInterface,
  headings: string[]
): Promise<string> {
  const result = await generateJSON<{ title: string }>(engine, {
    system: TITLE_PROMPT,
    user: headings.join('\n'),
    schema: TITLE_SCHEMA,
    maxTokens: 60,
    temperature: 0.2,
  });
  const title = result.title?.trim();
  if (!title) throw new Error('Empty title');
  return title;
}

/** SHA-256 hex of the transcript — must match the server's hash for dedupe. */
export async function hashTranscript(transcript: string): Promise<string> {
  const bytes = new TextEncoder().encode(transcript);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
