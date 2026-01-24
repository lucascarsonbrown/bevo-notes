'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ApiKeyStatus {
  has_key: boolean;
  is_valid: boolean;
  last_verified: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Check authentication and fetch API key status
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUserEmail(user.email || null);

      // Fetch API key status
      try {
        const res = await fetch('/api/user/api-key/status');
        if (res.ok) {
          const data = await res.json();
          setApiKeyStatus(data);
        }
      } catch {
        console.error('Failed to fetch API key status');
      }

      setLoading(false);
    };

    init();
  }, [router, supabase]);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/user/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to save API key' });
        setSaving(false);
        return;
      }

      setMessage({ type: 'success', text: 'API key saved and validated successfully!' });
      setApiKey('');
      setApiKeyStatus({ has_key: true, is_valid: true, last_verified: new Date().toISOString() });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save API key. Please try again.' });
    }

    setSaving(false);
  };

  const handleDeleteApiKey = async () => {
    if (!confirm('Are you sure you want to delete your API key? You will need to add a new one to generate notes.')) {
      return;
    }

    setDeleting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/user/api-key', {
        method: 'DELETE',
      });

      if (!res.ok) {
        setMessage({ type: 'error', text: 'Failed to delete API key' });
        setDeleting(false);
        return;
      }

      setMessage({ type: 'success', text: 'API key deleted successfully' });
      setApiKeyStatus({ has_key: false, is_valid: false, last_verified: null });
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete API key' });
    }

    setDeleting(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="text-center">
          <div
            className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
          ></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Top Bar */}
        <div
          className="fixed top-0 left-0 right-0 h-16 border-b flex items-center justify-between px-6 z-10"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ← Back to Dashboard
          </button>

          <button
            onClick={() => setIsDark(!isDark)}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Content */}
        <div className="pt-16 pb-12">
          <div className="max-w-2xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
              Settings
            </h1>

            {/* Account Section */}
            <section
              className="rounded-xl border p-6 mb-6"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
              }}
            >
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Account
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Email
                  </label>
                  <p className="mt-1" style={{ color: 'var(--text-primary)' }}>
                    {userEmail}
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg border font-medium transition-colors"
                  style={{
                    borderColor: '#dc2626',
                    color: '#dc2626',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Sign Out
                </button>
              </div>
            </section>

            {/* API Key Section */}
            <section
              className="rounded-xl border p-6"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
              }}
            >
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Gemini API Key
              </h2>

              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Your Gemini API key is used to generate lecture notes. Get a free key from{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-primary)' }}
                  className="underline"
                >
                  Google AI Studio
                </a>
                .
              </p>

              {/* Current Status */}
              {apiKeyStatus && (
                <div
                  className="rounded-lg p-4 mb-4"
                  style={{
                    backgroundColor: apiKeyStatus.has_key
                      ? apiKeyStatus.is_valid
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(107, 114, 128, 0.1)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>
                      {apiKeyStatus.has_key
                        ? apiKeyStatus.is_valid
                          ? '✓'
                          : '⚠️'
                        : '○'}
                    </span>
                    <span
                      className="font-medium"
                      style={{
                        color: apiKeyStatus.has_key
                          ? apiKeyStatus.is_valid
                            ? '#10b981'
                            : '#f59e0b'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {apiKeyStatus.has_key
                        ? apiKeyStatus.is_valid
                          ? 'API key configured and valid'
                          : 'API key configured but invalid'
                        : 'No API key configured'}
                    </span>
                  </div>
                  {apiKeyStatus.last_verified && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Last verified: {new Date(apiKeyStatus.last_verified).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Message */}
              {message && (
                <div
                  className="rounded-lg p-3 mb-4"
                  style={{
                    backgroundColor:
                      message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                    color: message.type === 'success' ? '#10b981' : '#dc2626',
                  }}
                >
                  {message.text}
                </div>
              )}

              {/* Add/Update API Key Form */}
              <form onSubmit={handleSaveApiKey} className="space-y-4">
                <div>
                  <label
                    htmlFor="apiKey"
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {apiKeyStatus?.has_key ? 'Update API Key' : 'Add API Key'}
                  </label>
                  <input
                    type="password"
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="w-full px-4 py-2 rounded-lg border transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: 'white',
                    }}
                  >
                    {saving ? 'Validating...' : apiKeyStatus?.has_key ? 'Update Key' : 'Save Key'}
                  </button>

                  {apiKeyStatus?.has_key && (
                    <button
                      type="button"
                      onClick={handleDeleteApiKey}
                      disabled={deleting}
                      className="px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-50"
                      style={{
                        borderColor: '#dc2626',
                        color: '#dc2626',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {deleting ? 'Deleting...' : 'Delete Key'}
                    </button>
                  )}
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
