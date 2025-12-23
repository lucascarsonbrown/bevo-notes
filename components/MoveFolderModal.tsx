'use client';

import { useState, useEffect } from 'react';

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

interface MoveFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
  folders: Folder[];
  onMoveNote: (noteId: string, folderId: string | undefined) => void;
}

export default function MoveFolderModal({ isOpen, onClose, note, folders, onMoveNote }: MoveFolderModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);

  // Initialize selectedFolderId when modal opens with a new note
  useEffect(() => {
    if (isOpen && note) {
      setSelectedFolderId(note.folderId);
    }
  }, [isOpen, note]);

  if (!isOpen || !note) return null;

  const handleMove = () => {
    onMoveNote(note.id, selectedFolderId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border shadow-xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Move to Folder
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ✕
          </button>
        </div>

        {/* Note Preview */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Moving note:
          </p>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {note.title}
          </p>
        </div>

        {/* Folder Selection */}
        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {/* Unorganized Option */}
            <button
              onClick={() => setSelectedFolderId(undefined)}
              className="w-full p-3 rounded-lg border transition-all flex items-center gap-3"
              style={{
                backgroundColor: selectedFolderId === undefined ? 'var(--accent-light)' : 'var(--bg-secondary)',
                borderColor: selectedFolderId === undefined ? 'var(--accent-primary)' : 'transparent'
              }}
            >
              <span className="text-xl">📋</span>
              <span className="flex-1 text-left font-medium" style={{ color: 'var(--text-primary)' }}>
                Unorganized
              </span>
              {selectedFolderId === undefined && (
                <span style={{ color: 'var(--accent-primary)' }}>✓</span>
              )}
            </button>

            {/* Folder Options */}
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className="w-full p-3 rounded-lg border transition-all flex items-center gap-3"
                style={{
                  backgroundColor: selectedFolderId === folder.id ? 'var(--accent-light)' : 'var(--bg-secondary)',
                  borderColor: selectedFolderId === folder.id ? 'var(--accent-primary)' : 'transparent'
                }}
              >
                <span className="text-xl">{folder.icon}</span>
                <span className="flex-1 text-left font-medium" style={{ color: 'var(--text-primary)' }}>
                  {folder.name}
                </span>
                {selectedFolderId === folder.id && (
                  <span style={{ color: 'var(--accent-primary)' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white transition-all"
            style={{ backgroundColor: 'var(--accent-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
          >
            Move Note
          </button>
        </div>
      </div>
    </div>
  );
}
