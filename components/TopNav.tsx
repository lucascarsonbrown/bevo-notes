'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TopNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isDark: boolean;
  onThemeToggle: () => void;
  userEmail?: string | null;
}

export default function TopNav({ searchQuery, onSearchChange, isDark, onThemeToggle, userEmail }: TopNavProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getInitial = () => {
    if (!userEmail) return 'U';
    return userEmail.charAt(0).toUpperCase();
  };
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 z-50 border-b transition-colors"
         style={{
           backgroundColor: 'var(--bg-secondary)',
           borderColor: 'var(--border-color)'
         }}>
      <div className="h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-base"
               style={{
                 background: 'linear-gradient(135deg, #bf5700 0%, #a04a00 100%)'
               }}>
            B
          </div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Bevo Notes
          </h1>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-8">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xl"
                 style={{ color: 'var(--text-tertiary)' }}>
              🔍
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes by title or content..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border transition-all outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={onThemeToggle}
            className="w-9 h-9 rounded-lg border flex items-center justify-center transition-all hover:bg-opacity-50"
            style={{
              borderColor: 'var(--border-color)',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span className="text-lg">{isDark ? '☀️' : '🌙'}</span>
          </button>

          {/* Profile Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, #bf5700 0%, #a04a00 100%)',
              }}
            >
              {getInitial()}
            </button>

            {showProfileMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-64 rounded-lg border shadow-xl overflow-hidden z-10"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {/* User Info */}
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Signed in as
                  </p>
                  <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
                    {userEmail || 'user@utexas.edu'}
                  </p>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      router.push('/settings');
                      setShowProfileMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>⚙️</span>
                    <span>Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      router.push('/settings#api-key');
                      setShowProfileMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>🔑</span>
                    <span>API Key Management</span>
                  </button>
                </div>

                <div className="h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

                {/* Logout */}
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: loggingOut ? 'var(--text-tertiary)' : '#dc2626' }}
                    onMouseEnter={(e) => {
                      if (!loggingOut) e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                    }}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>🚪</span>
                    <span>{loggingOut ? 'Logging out...' : 'Log Out'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
