'use client';

interface UsageBannerProps {
  planType: 'trial' | 'expired' | 'pro' | null;
  notesUsed?: number;
  notesLimit?: number;
}

export default function UsageBanner({ planType, notesUsed = 0, notesLimit = 3 }: UsageBannerProps) {
  if (planType === 'pro' || !planType) return null;

  return (
    <div
      className="h-12 border-b flex items-center justify-center px-6 transition-colors"
      style={{
        background: `linear-gradient(90deg, var(--accent-light) 0%, transparent 100%)`,
        borderColor: 'rgba(191, 87, 0, 0.2)'
      }}
    >
      {planType === 'trial' && (
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
            ⚡ Free Trial: <strong>{notesUsed} of {notesLimit}</strong> notes used
          </span>
          <button
            className="px-4 py-1.5 rounded-md text-sm font-medium text-white transition-all"
            style={{
              backgroundColor: 'var(--accent-primary)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
          >
            Subscribe for $4.99/month →
          </button>
        </div>
      )}

      {planType === 'expired' && (
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
            ⚠️ Trial expired. Subscribe to continue generating notes.
          </span>
          <button
            className="px-4 py-1.5 rounded-md text-sm font-medium text-white transition-all"
            style={{
              backgroundColor: 'var(--accent-primary)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
          >
            Subscribe Now →
          </button>
        </div>
      )}
    </div>
  );
}
