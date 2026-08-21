import { hasModelInCache } from '@mlc-ai/web-llm';
import { getEngine, isEngineLoaded, type ProgressHandler } from './engine';
import type { Capability } from './capability';
import type { ModelSpec } from './models';

/**
 * Warms the generation model in the background so the first note doesn't start
 * with a ~880 MB download.
 *
 * Two distinct costs are being hidden here, and they behave differently:
 *
 *  - **Download** — weights land in Cache Storage. Paid once per origin, then
 *    never again unless the user clears site data.
 *  - **Load** — weights are read out of that cache, compiled, and uploaded to
 *    the GPU. Paid once per *page load*, and still costs seconds.
 *
 * Prewarming pays both up front, on idle, so `getEngine` later resolves from the
 * singleton immediately. Nothing else has to change: generation already goes
 * through `getEngine`, so it picks up the warmed engine automatically.
 */

const PREFERENCE_KEY = 'bevo-preload';

export type PreloadStatus =
  | 'idle'
  | 'skipped'
  | 'downloading'
  | 'ready'
  | 'error';

export interface PreloadState {
  status: PreloadStatus;
  /** 0–1, from WebLLM's init progress. */
  progress: number;
  text: string;
  /** True when weights were already in Cache Storage, so no download was needed. */
  cached: boolean;
  reason?: PreloadSkipReason;
  error?: string;
}

export type PreloadSkipReason =
  | 'readonly'
  | 'disabled'
  | 'save-data'
  | 'slow-network';

export function preloadEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(PREFERENCE_KEY) !== 'off';
}

export function setPreloadEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PREFERENCE_KEY, enabled ? 'auto' : 'off');
}

/** Whether the weights are already in Cache Storage for this origin. */
export async function isModelCached(spec: ModelSpec): Promise<boolean> {
  try {
    return await hasModelInCache(spec.id);
  } catch {
    // Unknown model id or no Cache Storage — treat as a cold start.
    return false;
  }
}

interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Reasons not to spend a gigabyte of someone's bandwidth unasked. An already
 * cached model bypasses all of them — warming it costs no network at all.
 */
function skipReason(): PreloadSkipReason | null {
  if (!preloadEnabled()) return 'disabled';
  if (typeof navigator === 'undefined') return null;
  const conn = (navigator as Navigator & { connection?: ConnectionLike }).connection;
  if (!conn) return null;
  if (conn.saveData) return 'save-data';
  if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
    return 'slow-network';
  }
  return null;
}

let inFlight: Promise<void> | null = null;

/**
 * Start the background warm-up. Safe to call repeatedly — the first call owns
 * the work and later ones attach to it.
 *
 * `force` bypasses the bandwidth guards, for when the user asks for the
 * download explicitly.
 */
export function prewarm(
  capability: Capability,
  onState: (state: PreloadState) => void,
  opts: { force?: boolean } = {}
): Promise<void> {
  if (inFlight) return inFlight;

  const spec = capability.model;
  if (!spec || capability.mode === 'readonly') {
    onState({ status: 'skipped', progress: 0, text: '', cached: false, reason: 'readonly' });
    return Promise.resolve();
  }

  if (isEngineLoaded(spec)) {
    onState({ status: 'ready', progress: 1, text: '', cached: true });
    return Promise.resolve();
  }

  inFlight = (async () => {
    const cached = await isModelCached(spec);

    if (!cached && !opts.force) {
      const skip = skipReason();
      if (skip) {
        onState({ status: 'skipped', progress: 0, text: '', cached: false, reason: skip });
        return;
      }
    }

    onState({
      status: 'downloading',
      progress: 0,
      text: cached ? 'Loading model…' : 'Downloading model…',
      cached,
    });

    const report: ProgressHandler = ({ progress, text }) => {
      onState({ status: 'downloading', progress, text, cached });
    };

    try {
      await getEngine(spec, report);
      onState({ status: 'ready', progress: 1, text: '', cached });
    } catch (err) {
      // A failed warm-up is not a user-facing failure: generation will retry the
      // load itself, and readonly is still the only true floor.
      inFlight = null;
      onState({
        status: 'error',
        progress: 0,
        text: '',
        cached,
        error: err instanceof Error ? err.message : 'Model failed to load',
      });
    }
  })();

  return inFlight;
}

/** Runs `fn` when the browser is idle, so the warm-up never competes with first paint. */
export function whenIdle(fn: () => void, timeoutMs = 3000): () => void {
  if (typeof window === 'undefined') return () => {};

  const idle = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (idle.requestIdleCallback) {
    const handle = idle.requestIdleCallback(fn, { timeout: timeoutMs });
    return () => idle.cancelIdleCallback?.(handle);
  }

  const timer = window.setTimeout(fn, timeoutMs);
  return () => window.clearTimeout(timer);
}
