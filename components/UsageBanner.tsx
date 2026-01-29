'use client';

import { useRouter } from 'next/navigation';

interface UsageBannerProps {
  apiKeyStatus: 'valid' | 'invalid' | 'none' | 'missing' | 'loading';
}

export default function UsageBanner({ apiKeyStatus }: UsageBannerProps) {
  const router = useRouter();
  if (apiKeyStatus === 'valid' || apiKeyStatus === 'loading') return null;

  // Treat 'missing' the same as 'none'
  const status = apiKeyStatus === 'missing' ? 'none' : apiKeyStatus;

  return (
    <div
      className="h-12 border-b flex items-center justify-center px-6 transition-colors"
      style={{
        background: `linear-gradient(90deg, var(--accent-light) 0%, transparent 100%)`,
        borderColor: 'rgba(191, 87, 0, 0.2)'
      }}
    >
      {status === 'none' && (
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
            onClick={() => router.push('/settings')}
          >
            Get Started →
          </button>
        </div>
      )}

      {status === 'invalid' && (
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
            onClick={() => router.push('/settings')}
          >
            Update API Key →
          </button>
        </div>
      )}
    </div>
  );
}
