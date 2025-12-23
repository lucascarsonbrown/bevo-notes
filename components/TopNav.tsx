'use client';

interface TopNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isDark: boolean;
  onThemeToggle: () => void;
}

export default function TopNav({ searchQuery, onSearchChange, isDark, onThemeToggle }: TopNavProps) {
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
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{
              background: 'linear-gradient(135deg, #bf5700 0%, #a04a00 100%)'
            }}
          >
            U
          </button>
        </div>
      </div>
    </nav>
  );
}
