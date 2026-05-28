'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/hooks/useTheme';
import { createClient } from '@/lib/supabase/client';
import { SubscriptionTier } from '@/lib/usage';

interface UserData {
  email: string;
  tier: SubscriptionTier;
  stripe_customer_id: string | null;
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  pro: 'Pro',
};

const TIER_COLORS: Record<SubscriptionTier, string> = {
  free: '#6b7280',
  pro: '#bf5700',
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDark, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const res = await fetch('/api/usage');
      const usage = res.ok ? await res.json() : null;

      setUserData({
        email: user.email ?? '',
        tier: (usage?.tier as SubscriptionTier) ?? 'free',
        stripe_customer_id: null,
      });
      setLoading(false);
    };
    init();
  }, [router, supabase]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleUpgrade = () => {
    router.push('/pricing');
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

  const tier = userData?.tier ?? 'free';

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

            {/* Subscription */}
            <section
              className="rounded-xl border p-6 mb-6"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            >
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Subscription
              </h2>

              <div className="flex items-center gap-3 mb-4">
                <span
                  className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: TIER_COLORS[tier] }}
                >
                  {TIER_LABELS[tier]}
                </span>
                {tier === 'free' && (
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Free plan — limited usage
                  </span>
                )}
                {tier === 'pro' && (
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Pro plan — active
                  </span>
                )}
              </div>

              {tier === 'free' && (
                <div>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Upgrade to get more notes, quizzes, and textbook uploads.
                  </p>
                  <button
                    onClick={handleUpgrade}
                    className="px-5 py-2 rounded-lg font-semibold text-white transition-all"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
                  >
                    View Plans →
                  </button>
                </div>
              )}

              {tier !== 'free' && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  To manage or cancel your subscription, visit the{' '}
                  <button
                    onClick={() => fetch('/api/stripe/portal', { method: 'POST' }).then(r => r.json()).then(d => d.url && window.open(d.url, '_blank'))}
                    className="underline"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    billing portal
                  </button>
                  .
                </p>
              )}
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
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
