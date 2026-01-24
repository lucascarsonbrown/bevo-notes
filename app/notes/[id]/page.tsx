'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';

interface Note {
  id: string;
  title: string;
  lecture_date: string | null;
  notes_html: string;
  created_at: string;
  folder_id: string | null;
  folder: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
}

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const noteId = params.id as string;

  // Fetch note from API
  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await fetch(`/api/notes/${noteId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Note not found');
          } else if (res.status === 401) {
            router.push('/login');
            return;
          } else {
            setError('Failed to load note');
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        setNote(data);
        setLoading(false);
      } catch {
        setError('Failed to load note');
        setLoading(false);
      }
    };

    fetchNote();
  }, [noteId, router]);

  const formattedDate = note
    ? new Date(note.lecture_date || note.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const handleDelete = async () => {
    if (!note) return;

    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/dashboard');
      }
    } catch {
      console.error('Failed to delete note');
    }
  };

  const handleExport = (format: 'pdf' | 'markdown' | 'html') => {
    if (!note) return;

    if (format === 'markdown') {
      // Convert HTML to basic markdown
      let content = note.notes_html
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<ul[^>]*>|<\/ul>/gi, '\n')
        .replace(/<[^>]+>/g, '');

      content = `# ${note.title}\n\n*${formattedDate}*\n\n${content}`;
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === 'html') {
      const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${note.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #1a1a1a; font-size: 2.25rem; margin-top: 2rem; margin-bottom: 1rem; }
    h2 { color: #1a1a1a; font-size: 1.875rem; margin-top: 1.75rem; margin-bottom: 0.875rem; }
    h3 { color: #1a1a1a; font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    .date { color: #6b7280; margin-bottom: 2rem; }
    p { color: #374151; margin-bottom: 1rem; }
    li { color: #374151; margin-left: 1.5rem; }
    pre { background-color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
    code { font-family: monospace; font-size: 0.875rem; }
    strong { color: #1a1a1a; }
  </style>
</head>
<body>
  <p class="date">${formattedDate}</p>
  ${note.notes_html}
</body>
</html>`;
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${note.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #1a1a1a; font-size: 2.25rem; margin-top: 2rem; margin-bottom: 1rem; }
    h2 { color: #1a1a1a; font-size: 1.875rem; margin-top: 1.75rem; margin-bottom: 0.875rem; }
    h3 { color: #1a1a1a; font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    .date { color: #6b7280; margin-bottom: 2rem; }
    p { color: #374151; margin-bottom: 1rem; }
    li { color: #374151; margin-left: 1.5rem; }
    pre { background-color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
    code { font-family: monospace; font-size: 0.875rem; }
    strong { color: #1a1a1a; }
    @media print {
      body { margin: 1cm; }
    }
  </style>
</head>
<body>
  <p class="date">${formattedDate}</p>
  ${note.notes_html}
</body>
</html>`);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }

    setShowExportMenu(false);
  };

  // Loading state
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
          <p style={{ color: 'var(--text-secondary)' }}>Loading note...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !note) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="text-center">
          <p className="text-xl mb-4" style={{ color: 'var(--text-primary)' }}>
            {error || 'Note not found'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
          >
            Back to Dashboard
          </button>
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
          {/* Left: Back Button */}
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

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {/* Export Button with Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-4 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              >
                Export {showExportMenu ? '▲' : '▼'}
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 rounded-lg border shadow-lg overflow-hidden z-10"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span>Export as PDF</span>
                  </button>

                  <div className="h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

                  <button
                    onClick={() => handleExport('markdown')}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span>Markdown (.md)</span>
                  </button>

                  <div className="h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

                  <button
                    onClick={() => handleExport('html')}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span>HTML (.html)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Delete Button */}
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="pt-16 pb-12">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              {/* Folder Badge */}
              {note.folder && (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold mb-4"
                  style={{
                    backgroundColor: note.folder.color,
                    color: 'white',
                  }}
                >
                  {note.folder.icon && <span>{note.folder.icon}</span>}
                  <span>{note.folder.name}</span>
                </div>
              )}

              {/* Title */}
              <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                {note.title}
              </h1>

              {/* Date */}
              <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                {formattedDate}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px mb-8" style={{ backgroundColor: 'var(--border-color)' }}></div>

            {/* Note Content - render HTML directly */}
            <div
              className="prose prose-lg max-w-none note-content"
              style={{
                color: 'var(--text-primary)',
                lineHeight: '1.8',
              }}
              dangerouslySetInnerHTML={{ __html: note.notes_html }}
            />
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDelete}
          itemType="note"
          itemName={note.title}
        />
      </div>

      <style jsx global>{`
        .note-content h1 {
          font-size: 2rem;
          font-weight: bold;
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          color: var(--text-primary);
        }
        .note-content h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin-top: 1.25rem;
          margin-bottom: 0.75rem;
          color: var(--text-primary);
        }
        .note-content p {
          margin-bottom: 1rem;
          color: var(--text-secondary);
        }
        .note-content ul,
        .note-content ol {
          margin-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .note-content li {
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }
        .note-content sup {
          vertical-align: super;
          font-size: 0.75em;
        }
        .note-content sub {
          vertical-align: sub;
          font-size: 0.75em;
        }
      `}</style>
    </div>
  );
}
