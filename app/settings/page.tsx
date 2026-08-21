'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/hooks/useTheme';
import { useAICapability } from '@/lib/ai/AICapabilityProvider';
import { createClient } from '@/lib/supabase/client';

interface UserData {
  email: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDark, toggle: toggleTheme } = useTheme();
  const { isReadOnly, preload, autoPreload, setAutoPreload, startPreload } = useAICapability();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      setUserData({ email: user.email ?? '' });
      setLoading(false);
    };
    init();
  }, [router, supabase]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div
          className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Top Bar */}
        <div
          className="fixed top-0 left-0 right-0 h-16 border-b flex items-center justify-between px-6 z-10"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            ← Back to Dashboard
          </button>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="pt-16 pb-12">
          <div className="max-w-2xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
              Settings
            </h1>

            {/* Account */}
            <section
              className="rounded-xl border p-6 mb-6"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            >
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Account
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Email</label>
                  <p className="mt-1" style={{ color: 'var(--text-primary)' }}>{userData?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg border font-medium transition-colors"
                  style={{ borderColor: '#dc2626', color: '#dc2626' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Sign Out
                </button>
              </div>
            </section>

            {/* Preferences */}
            <section
              className="rounded-xl border p-6"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            >
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Preferences
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Theme</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Currently: {isDark ? 'Dark' : 'Light'}
                  </p>
                </div>
                <button
                  onClick={toggleTheme}
                  className="px-4 py-2 rounded-lg border font-medium transition-colors"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {isDark ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
                </button>
              </div>

              {!isReadOnly && (
                <div
                  className="flex items-center justify-between mt-6 pt-6 border-t"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="pr-4">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      Preload the model
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {preload.status === 'ready'
                        ? 'Loaded and ready — generation will start immediately.'
                        : 'Downloads the note-generation model (~880 MB, once) in the background so your first lecture doesn\u2019t wait on it. Skipped automatically on metered or very slow connections.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {preload.status !== 'ready' && (
                      <button
                        onClick={startPreload}
                        className="px-4 py-2 rounded-lg border font-medium transition-colors"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        {preload.status === 'downloading'
                          ? `${Math.round(preload.progress * 100)}%`
                          : 'Download now'}
                      </button>
                    )}
                    <button
                      onClick={() => setAutoPreload(!autoPreload)}
                      className="px-4 py-2 rounded-lg border font-medium transition-colors"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      {autoPreload ? 'Automatic: On' : 'Automatic: Off'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
