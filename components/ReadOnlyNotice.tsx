'use client';

import { useAICapability } from '@/lib/ai/AICapabilityProvider';

/**
 * Shown where a generation control would otherwise be, on devices that can't
 * run the model. Reading, organizing, and exporting still work — only
 * generation is unavailable.
 */
export default function ReadOnlyNotice({ compact = false }: { compact?: boolean }) {
  const { isReadOnly, explanation } = useAICapability();
  if (!isReadOnly) return null;

  if (compact) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }} title={explanation}>
        Generation unavailable on this device
      </span>
    );
  }

  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-secondary)',
      }}
    >
      <strong style={{ color: 'var(--text-primary)' }}>Read-only on this device.</strong>{' '}
      {explanation}
    </div>
  );
}
