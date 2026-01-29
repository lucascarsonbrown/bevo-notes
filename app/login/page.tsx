'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { isValidUTEmail, getEmailValidationMessage } from '@/lib/utils/email-validation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Validate UT Austin email
    if (!isValidUTEmail(email)) {
      setMessage({
        type: 'error',
        text: getEmailValidationMessage(),
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Check your email for the magic link!',
      });
      setEmail('');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'An error occurred. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--accent-primary)' }}>
            Bevo Notes
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            AI-powered lecture notes for UT Austin students
          </p>
        </div>

        {/* Login Card */}
        <div
          className="rounded-xl border p-8 shadow-lg"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
            Sign In
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                UT Austin Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="youreid@utexas.edu"
                required
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {message && (
              <div
                className="px-4 py-3 rounded-lg text-sm"
                style={{
                  backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: message.type === 'success' ? '#10b981' : '#ef4444',
                  borderLeft: `3px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
                }}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 rounded-lg font-medium text-white transition-all"
              style={{
                backgroundColor: loading ? 'var(--text-secondary)' : 'var(--accent-primary)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
              }}
            >
              {loading ? 'Sending magic link...' : 'Send Magic Link'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>We'll send you a magic link to sign in.</p>
            <p className="mt-1">Any email ending in utexas.edu is accepted</p>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>
            Don't have the extension yet?{' '}
            <a
              href="https://github.com/lucasbrown/bevo-notes#installation"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              View installation instructions
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
