import {
  CreateMLCEngine,
  type MLCEngineInterface,
  type InitProgressReport,
} from '@mlc-ai/web-llm';
import type { ModelSpec } from './models';

/**
 * WebLLM engine singleton.
 *
 * One engine per model id, cached for the lifetime of the page — reloading
 * weights costs seconds even when they are already in the browser cache, and
 * the first load costs a ~880 MB download.
 */

export type ProgressHandler = (report: { progress: number; text: string }) => void;

const engines = new Map<string, Promise<MLCEngineInterface>>();

export function getEngine(
  spec: ModelSpec,
  onProgress?: ProgressHandler
): Promise<MLCEngineInterface> {
  const existing = engines.get(spec.id);
  if (existing) return existing;

  const created = CreateMLCEngine(spec.id, {
    initProgressCallback: (report: InitProgressReport) => {
      onProgress?.({ progress: report.progress, text: report.text });
    },
  }).catch((err) => {
    // Don't cache a failed load — the user may retry after freeing memory.
    engines.delete(spec.id);
    throw err;
  });

  engines.set(spec.id, created);
  return created;
}

/** True when the model's weights are already cached, so loading won't re-download. */
export function isEngineLoaded(spec: ModelSpec): boolean {
  return engines.has(spec.id);
}

export async function unloadEngine(spec: ModelSpec): Promise<void> {
  const pending = engines.get(spec.id);
  if (!pending) return;
  engines.delete(spec.id);
  try {
    const engine = await pending;
    await engine.unload();
  } catch {
    // Already broken or never finished loading; dropping the reference is enough.
  }
}

/**
 * Generate against a JSON schema using WebLLM's constrained decoding.
 *
 * Constrained decoding is the single largest quality lever available on a 1B
 * model: it makes malformed output structurally impossible. It guarantees shape,
 * never correctness of content.
 */
export async function generateJSON<T>(
  engine: MLCEngineInterface,
  opts: {
    system: string;
    user: string;
    schema: object;
    maxTokens: number;
    temperature?: number;
  }
): Promise<T> {
  const completion = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens,
    response_format: {
      type: 'json_object',
      schema: JSON.stringify(opts.schema),
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Model returned an empty response');

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Model returned unparseable JSON');
  }
}
