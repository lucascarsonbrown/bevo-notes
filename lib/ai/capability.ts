import { GENERATION_MODELS, EMBEDDING_MODEL, type ModelSpec } from './models';

/**
 * Hardware gate for browser inference.
 *
 * Runs before any download. Browser support is no longer the main constraint —
 * memory is. Weights must fit in GPU-addressable memory alongside the KV cache,
 * which on integrated graphics and Apple Silicon comes out of shared system RAM.
 * Chrome also blocklists known-bad drivers, so an adapter request can fail even
 * where `navigator.gpu` exists.
 */

export type CapabilityMode = 'full' | 'reduced' | 'readonly';

export type ReadonlyReason =
  | 'no-webgpu'
  | 'no-adapter'
  | 'insufficient-memory'
  | 'detection-failed';

export interface Capability {
  mode: CapabilityMode;
  /** Set only when mode is 'readonly'. */
  reason?: ReadonlyReason;
  /** Generation model to load, or null in readonly mode. */
  model: ModelSpec | null;
  embeddingModel: ModelSpec | null;
  /** Largest single allocation the adapter reported, in MB. */
  availableMB: number | null;
}

/** Minimal structural types — avoids depending on @webgpu/types. */
interface GPUAdapterLike {
  limits: { maxBufferSize: number; maxStorageBufferBindingSize: number };
}
interface GPULike {
  requestAdapter(): Promise<GPUAdapterLike | null>;
}

const READONLY = (reason: ReadonlyReason): Capability => ({
  mode: 'readonly',
  reason,
  model: null,
  embeddingModel: null,
  availableMB: null,
});

export async function detectCapability(): Promise<Capability> {
  if (typeof navigator === 'undefined') return READONLY('detection-failed');

  const gpu = (navigator as Navigator & { gpu?: GPULike }).gpu;
  if (!gpu) return READONLY('no-webgpu');

  let adapter: GPUAdapterLike | null;
  try {
    adapter = await gpu.requestAdapter();
  } catch {
    return READONLY('detection-failed');
  }

  // Null adapter usually means a blocklisted driver rather than a missing GPU.
  if (!adapter) return READONLY('no-adapter');

  const toMB = (bytes: number) => bytes / (1024 * 1024);
  const availableMB = Math.min(
    toMB(adapter.limits.maxBufferSize),
    toMB(adapter.limits.maxStorageBufferBindingSize)
  );

  // The embedding model loads alongside the generation model for RAG.
  const needsFull = GENERATION_MODELS.full.vramMB;
  const needsReduced = GENERATION_MODELS.reduced.vramMB;

  if (availableMB >= needsFull) {
    return {
      mode: 'full',
      model: GENERATION_MODELS.full,
      embeddingModel: EMBEDDING_MODEL,
      availableMB,
    };
  }

  if (availableMB >= needsReduced) {
    return {
      mode: 'reduced',
      model: GENERATION_MODELS.reduced,
      // Skip semantic retrieval on constrained hardware rather than compete for memory.
      embeddingModel: null,
      availableMB,
    };
  }

  return { ...READONLY('insufficient-memory'), availableMB };
}

export function explainCapability(cap: Capability): string {
  switch (cap.mode) {
    case 'full':
      return 'Your device can generate notes locally.';
    case 'reduced':
      return 'Your device has limited graphics memory, so a smaller model will be used. Notes may be less detailed.';
    case 'readonly':
      switch (cap.reason) {
        case 'no-webgpu':
          return 'This browser does not support WebGPU, which is required to generate notes. Chrome, Edge, and Safari 26+ support it; Firefox does not yet on most platforms. You can still read, organize, and export your notes.';
        case 'no-adapter':
          return 'Your graphics driver is not supported for WebGPU, so notes cannot be generated on this device. You can still read, organize, and export your notes.';
        case 'insufficient-memory':
          return `This device does not have enough graphics memory to run the model${
            cap.availableMB ? ` (${Math.round(cap.availableMB)} MB available)` : ''
          }. You can still read, organize, and export your notes.`;
        default:
          return 'Could not check this device for note generation support. You can still read, organize, and export your notes.';
      }
  }
}
