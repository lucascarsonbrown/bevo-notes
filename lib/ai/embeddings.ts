import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import { CreateMLCEngine, type MLCEngineInterface } from '@mlc-ai/web-llm';
import { EMBEDDING_MODEL } from './models';
import type { ProgressHandler } from './engine';

/**
 * LangChain Embeddings backed by WebLLM's arctic-embed model.
 *
 * Runs on the same WebGPU device as generation. Query and document vectors must
 * come from this one model — mixing embedding models silently destroys
 * retrieval quality rather than erroring.
 */
export class WebLLMEmbeddings extends Embeddings {
  private enginePromise: Promise<MLCEngineInterface> | null = null;
  private onProgress?: ProgressHandler;

  constructor(fields?: EmbeddingsParams & { onProgress?: ProgressHandler }) {
    super(fields ?? {});
    this.onProgress = fields?.onProgress;
  }

  private engine(): Promise<MLCEngineInterface> {
    if (!this.enginePromise) {
      this.enginePromise = CreateMLCEngine(EMBEDDING_MODEL.id, {
        initProgressCallback: (r) =>
          this.onProgress?.({ progress: r.progress, text: r.text }),
      }).catch((err) => {
        this.enginePromise = null;
        throw err;
      });
    }
    return this.enginePromise;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const engine = await this.engine();
    const response = await engine.embeddings.create({ input: texts });
    return response.data.map((d) => d.embedding as number[]);
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embedDocuments([text]);
    return vector;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
