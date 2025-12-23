'use client';

import { useState } from 'react';

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

interface NoteCardProps {
  note: Note;
  folder?: Folder;
}

export default function NoteCard({ note, folder }: NoteCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formattedDate = new Date(note.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div
      className="rounded-xl border transition-all cursor-pointer"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: isHovered ? 'var(--accent-primary)' : 'var(--border-color)',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        minHeight: '200px',
        maxHeight: '280px',
        display: 'flex',
        flexDirection: 'column'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Content */}
      <div className="flex-1 p-5">
        {/* Folder Badge */}
        {folder && (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold mb-3"
            style={{
              backgroundColor: folder.color,
              color: 'white'
            }}
          >
            <span>{folder.icon}</span>
            <span>{folder.name}</span>
          </div>
        )}

        {/* Title */}
        <h3
          className="text-lg font-bold mb-1.5 line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {note.title}
        </h3>

        {/* Date */}
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {formattedDate}
        </p>

        {/* Preview */}
        <p
          className="text-sm line-clamp-3"
          style={{
            color: 'var(--text-secondary)',
            lineHeight: '1.6'
          }}
        >
          {note.preview}
        </p>
      </div>

      {/* Actions Footer */}
      <div
        className="h-11 px-5 flex items-center justify-between border-t"
        style={{
          borderColor: 'var(--border-color)'
        }}
      >
        {/* Export Dropdown */}
        <button
          className="text-sm font-medium flex items-center gap-1.5 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          📤 Export ▼
        </button>

        {/* Delete */}
        <button
          className="w-8 h-8 rounded flex items-center justify-center transition-all"
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

        {/* Open Button */}
        <button
          className="px-4 py-1.5 rounded-md text-sm font-medium text-white transition-all"
          style={{
            backgroundColor: 'var(--accent-primary)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
        >
          Open →
        </button>
      </div>
    </div>
  );
}
