'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/hooks/useTheme';
import { createClient } from '@/lib/supabase/client';
import { SubscriptionTier } from '@/lib/usage';

const FREE_FEATURES = [
  '1 course',
  '6 AI lecture notes',
  '5 quizzes',
  '1 syllabus upload',
  'No textbook uploads',
];

const PRO_FEATURES = [
  'Unlimited courses',
  'Unlimited AI lecture notes',
  'Up to 100 quizzes / month',
  'Unlimited syllabus uploads',
  'Textbook uploads',
  'Semantic quiz retrieval (RAG)',
];

function CheckIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#bf5700" fillOpacity="0.15" />
      <path d="M5 8l2 2 4-4" stroke="#bf5700" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isDark, toggle: toggleTheme } = useTheme();

  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthed(true);
        fetch('/api/usage').then(r => r.ok ? r.json() : null).then(d => d && setCurrentTier(d.tier));
      }
    });
  }, [supabase]);

  const handleSubscribe = async () => {
    if (!authed) { router.push('/login'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Top bar */}
        <div
          className="fixed top-0 left-0 right-0 h-16 border-b flex items-center justify-between px-6 z-10"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
        >
          <button
            onClick={() => router.push(authed ? '/dashboard' : '/')}
            className="flex items-center gap-2 font-semibold text-lg"
            style={{ color: 'var(--text-primary)' }}
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              B
            </span>
            Bevo Notes
          </button>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="pt-24 pb-20 px-6">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-14">
              <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Simple, honest pricing
              </h1>
              <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                We manage the AI — you just study. No API keys needed.
              </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Free */}
              <div
                className="rounded-2xl border p-8"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              >
                <div className="mb-6">
                  <p className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Free
                  </p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>$0</span>
                    <span className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>/month</span>
                  </div>
                  <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                    Get started with no credit card
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                      {f.startsWith('No ') ? <LockIcon /> : <CheckIcon />}
                      {f}
                    </li>
                  ))}
                </ul>

                <div
                  className="w-full py-2.5 rounded-lg text-center text-sm font-medium border"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  {currentTier === 'free' ? 'Current plan' : 'Free forever'}
                </div>
              </div>

              {/* Pro */}
              <div
                className="rounded-2xl border-2 p-8 relative"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--accent-primary)' }}
              >
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  Most popular
                </div>
                <div className="mb-6">
                  <p className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--accent-primary)' }}>
                    Pro
                  </p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>$10</span>
                    <span className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>/month</span>
                  </div>
                  <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                    Everything unlimited
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                      <CheckIcon />
                      {f}
                    </li>
                  ))}
                </ul>

                {currentTier === 'pro' ? (
                  <div
                    className="w-full py-2.5 rounded-lg text-center text-sm font-medium border-2"
                    style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                  >
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
                    onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
                  >
                    {loading ? 'Redirecting...' : 'Get Pro →'}
                  </button>
                )}
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-sm mt-10" style={{ color: 'var(--text-secondary)' }}>
              Cancel any time. Questions? Email us at{' '}
              <a href="mailto:hello@bevonotes.com" style={{ color: 'var(--accent-primary)' }}>
                hello@bevonotes.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
