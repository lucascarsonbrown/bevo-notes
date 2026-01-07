'use client';

interface UsageBannerProps {
  apiKeyStatus: 'valid' | 'invalid' | 'none';
}

export default function UsageBanner({ apiKeyStatus }: UsageBannerProps) {
  if (apiKeyStatus === 'valid') return null;

  return (
    <div
      className="h-12 border-b flex items-center justify-center px-6 transition-colors"
      style={{
        background: `linear-gradient(90deg, var(--accent-light) 0%, transparent 100%)`,
        borderColor: 'rgba(191, 87, 0, 0.2)'
      }}
    >
      {apiKeyStatus === 'none' && (
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
            🔑 Set up your Google Gemini API key to start generating notes
          </span>
          <button
            className="px-4 py-1.5 rounded-md text-sm font-medium text-white transition-all"
            style={{
              backgroundColor: 'var(--accent-primary)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
          >
            Get Started →
          </button>
        </div>
      )}

      {apiKeyStatus === 'invalid' && (
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
            ⚠️ Your API key is invalid or expired. Please update it to continue.
          </span>
          <button
            className="px-4 py-1.5 rounded-md text-sm font-medium text-white transition-all"
            style={{
              backgroundColor: 'var(--accent-primary)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
          >
            Update API Key →
          </button>
        </div>
      )}
    </div>
  );
}
