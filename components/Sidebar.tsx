'use client';

interface Folder {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
}

interface SidebarProps {
  folders: Folder[];
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
  unorganizedCount: number;
}

export default function Sidebar({ folders, selectedFolder, onSelectFolder, unorganizedCount }: SidebarProps) {
  const totalCount = folders.reduce((sum, folder) => sum + folder.count, 0) + unorganizedCount;

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-60 border-r transition-colors overflow-y-auto"
           style={{
             backgroundColor: 'var(--bg-primary)',
             borderColor: 'var(--border-color)'
           }}>
      <div className="p-4">
        {/* All Notes */}
        <button
          onClick={() => onSelectFolder('all')}
          className="w-full h-10 px-4 flex items-center gap-3 rounded-lg transition-all text-left relative"
          style={{
            backgroundColor: selectedFolder === 'all' ? 'var(--accent-light)' : 'transparent',
            color: 'var(--text-primary)',
            borderLeft: selectedFolder === 'all' ? '3px solid var(--accent-primary)' : '3px solid transparent'
          }}
          onMouseEnter={(e) => {
            if (selectedFolder !== 'all') {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedFolder !== 'all') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <span className="text-lg">📚</span>
          <span className="flex-1 text-sm">All Notes</span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {totalCount}
          </span>
        </button>

        {/* Unorganized (if any) */}
        {unorganizedCount > 0 && (
          <button
            onClick={() => onSelectFolder('unorganized')}
            className="w-full h-10 px-4 flex items-center gap-3 rounded-lg transition-all text-left relative mt-1"
            style={{
              backgroundColor: selectedFolder === 'unorganized' ? 'var(--accent-light)' : 'transparent',
              color: 'var(--text-primary)',
              borderLeft: selectedFolder === 'unorganized' ? '3px solid var(--accent-primary)' : '3px solid transparent'
            }}
            onMouseEnter={(e) => {
              if (selectedFolder !== 'unorganized') {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFolder !== 'unorganized') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <span className="text-lg">📋</span>
            <span className="flex-1 text-sm">Unorganized</span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {unorganizedCount}
            </span>
          </button>
        )}

        {/* Divider */}
        <div className="my-3 h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

        {/* User Folders */}
        <div className="space-y-1">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className="w-full h-10 px-4 flex items-center gap-3 rounded-lg transition-all text-left relative"
              style={{
                backgroundColor: selectedFolder === folder.id ? 'var(--accent-light)' : 'transparent',
                color: 'var(--text-primary)',
                borderLeft: selectedFolder === folder.id ? '3px solid var(--accent-primary)' : '3px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (selectedFolder !== folder.id) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedFolder !== folder.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span className="text-lg">{folder.icon}</span>
              <span className="flex-1 text-sm truncate">{folder.name}</span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {folder.count}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="my-3 h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

        {/* New Folder Button */}
        <button
          className="w-full h-10 px-4 flex items-center gap-3 rounded-lg transition-all text-left"
          style={{ color: 'var(--accent-primary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span className="text-lg">+</span>
          <span className="text-sm font-medium">New Folder</span>
        </button>
      </div>
    </aside>
  );
}
