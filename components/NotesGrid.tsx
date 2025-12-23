'use client';

import NoteCard from './NoteCard';

interface Note {
  id: string;
  title: string;
  date: string;
  folderId?: string;
  preview: string;
}

interface Folder {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
}

interface NotesGridProps {
  notes: Note[];
  folders: Folder[];
}

export default function NotesGrid({ notes, folders }: NotesGridProps) {
  if (notes.length === 0) {
    return (
      <div className="p-8">
        <div
          className="max-w-md mx-auto p-12 rounded-xl border text-center"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            No notes yet!
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Install the Chrome extension and generate your first notes.
          </p>
          <button
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
            style={{
              backgroundColor: 'var(--accent-primary)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
          >
            Install Extension →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {notes.map((note) => {
          const folder = folders.find((f) => f.id === note.folderId);
          return (
            <NoteCard
              key={note.id}
              note={note}
              folder={folder}
            />
          );
        })}
      </div>
    </div>
  );
}
