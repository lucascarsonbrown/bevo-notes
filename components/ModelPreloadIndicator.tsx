'use client';

import { useState } from 'react';
import { useAICapability } from '@/lib/ai/AICapabilityProvider';

/**
 * Progress for the background model warm-up.
 *
 * A silent multi-hundred-megabyte download reads as a hung tab, so the first
 * (uncached) warm-up is visible and dismissible. Once weights are cached there
 * is no download left to explain, so the pill stays out of the way.
 */
export default function ModelPreloadIndicator() {
  const { preload } = useAICapability();
  const [dismissed, setDismissed] = useState(false);

  const downloading = preload.status === 'downloading' && !preload.cached;
  if (dismissed || !downloading) return null;

  const percent = Math.round(preload.progress * 100);

  return (
    <div
      className="fixed bottom-4 left-4 z-50 w-72 rounded-lg border px-4 py-3 shadow-lg"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Preparing note generation
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs leading-none"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Hide model download progress"
        >
          ✕
        </button>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--border-color)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(135deg, #bf5700 0%, #a04a00 100%)',
          }}
        />
      </div>

      <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {percent}% — downloading the model once so lectures generate instantly later.
        Closing this doesn&apos;t stop it.
      </div>
    </div>
  );
}
