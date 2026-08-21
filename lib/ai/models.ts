/**
 * Model registry.
 *
 * vramMB values are taken from WebLLM's prebuiltAppConfig and are what the
 * capability gate compares against the adapter's reported limits — so we never
 * start a ~1 GB download onto hardware that cannot hold the weights.
 */

export interface ModelSpec {
  id: string;
  vramMB: number;
  /** Total context window, shared between prompt and completion. */
  contextTokens: number;
}

export const GENERATION_MODELS = {
  full: {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    vramMB: 879.04,
    contextTokens: 4096,
  },
  /**
   * Smaller than Qwen2.5-0.5B (945 MB) despite double the parameters — the 0.5B
   * model's larger vocabulary embedding outweighs its parameter savings.
   */
  reduced: {
    id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    vramMB: 376.06,
    contextTokens: 4096,
  },
} as const satisfies Record<string, ModelSpec>;

export const EMBEDDING_MODEL: ModelSpec = {
  id: 'snowflake-arctic-embed-s-q0f32-MLC-b4',
  vramMB: 238.71,
  contextTokens: 512,
};

/**
 * Per-pass token budget against a 4096-token window that must hold prompt and
 * completion together. A 50k-char transcript lands at roughly 5 passes.
 */
export const BUDGET = {
  systemPromptTokens: 350,
  outputReserveTokens: 1000,
  /** ~4 characters per token for English prose. */
  charsPerToken: 4,
} as const;

export function transcriptCharsPerPass(spec: ModelSpec): number {
  const usable =
    spec.contextTokens - BUDGET.systemPromptTokens - BUDGET.outputReserveTokens;
  return Math.max(1000, usable * BUDGET.charsPerToken);
}
