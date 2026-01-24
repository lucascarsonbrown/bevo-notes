'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import NotesGrid from '@/components/NotesGrid';
import UsageBanner from '@/components/UsageBanner';
import CreateFolderModal from '@/components/CreateFolderModal';
import MoveFolderModal from '@/components/MoveFolderModal';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';

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

interface ApiNote {
  id: string;
  title: string;
  lecture_date: string | null;
  preview: string;
  created_at: string;
  folder_id: string | null;
  folder: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
}

interface ApiFolder {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  noteCount: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [unorganizedCount, setUnorganizedCount] = useState(0);
  const [apiKeyStatus, setApiKeyStatus] = useState<'loading' | 'valid' | 'missing' | 'invalid'>('loading');

  // Modal states
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToMove, setNoteToMove] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);

  // Fetch notes from API
  const fetchNotes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedFolder && selectedFolder !== 'all') {
        params.set('folder_id', selectedFolder);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const res = await fetch(`/api/notes?${params.toString()}`);
      if (!res.ok) return;

      const data = await res.json();
      const transformedNotes: Note[] = data.notes.map((note: ApiNote) => ({
        id: note.id,
        title: note.title,
        date: note.lecture_date || note.created_at,
        folderId: note.folder_id || undefined,
        preview: note.preview,
      }));
      setNotes(transformedNotes);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  }, [selectedFolder, searchQuery]);

  // Fetch folders from API
  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders');
      if (!res.ok) return;

      const data = await res.json();
      const transformedFolders: Folder[] = data.folders.map((folder: ApiFolder) => ({
        id: folder.id,
        name: folder.name,
        icon: folder.icon || '',
        color: folder.color,
        count: folder.noteCount,
      }));
      setFolders(transformedFolders);
      setUnorganizedCount(data.unorganizedCount);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  }, []);

  // Check API key status
  const checkApiKeyStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/user/api-key/status');
      if (!res.ok) {
        setApiKeyStatus('missing');
        return;
      }

      const data = await res.json();
      if (!data.has_key) {
        setApiKeyStatus('missing');
      } else if (!data.is_valid) {
        setApiKeyStatus('invalid');
      } else {
        setApiKeyStatus('valid');
      }
    } catch {
      setApiKeyStatus('missing');
    }
  }, []);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUserEmail(user.email || null);
      setLoading(false);

      // Fetch data after auth is confirmed
      await Promise.all([fetchNotes(), fetchFolders(), checkApiKeyStatus()]);
    };

    checkAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUserEmail(session.user.email || null);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase, fetchNotes, fetchFolders, checkApiKeyStatus]);

  // Refetch notes when filter changes
  useEffect(() => {
    if (!loading) {
      fetchNotes();
    }
  }, [selectedFolder, searchQuery, loading, fetchNotes]);

  // Folder CRUD operations
  const handleCreateFolder = async (name: string, icon: string, color: string) => {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, color }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to create folder');
        return;
      }

      await fetchFolders();
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
      });

      if (!res.ok) return;

      await Promise.all([fetchFolders(), fetchNotes()]);

      if (selectedFolder === folderId) {
        setSelectedFolder(null);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  // Note operations
  const handleMoveNote = async (noteId: string, folderId: string | undefined) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId || null }),
      });

      if (!res.ok) return;

      await Promise.all([fetchNotes(), fetchFolders()]);
    } catch (error) {
      console.error('Failed to move note:', error);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      setNoteToDelete({ id: note.id, title: note.title });
      setIsDeleteModalOpen(true);
    }
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;

    try {
      const res = await fetch(`/api/notes/${noteToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) return;

      await Promise.all([fetchNotes(), fetchFolders()]);
      setNoteToDelete(null);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  // Show loading state while checking authentication
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
      <div className="min-h-screen bg-bg-primary text-text-primary transition-colors">
        {/* Top Navigation */}
        <TopNav
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isDark={isDark}
          onThemeToggle={() => setIsDark(!isDark)}
          userEmail={userEmail}
        />

        <div className="flex pt-16">
          {/* Sidebar */}
          <Sidebar
            folders={folders}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
            unorganizedCount={unorganizedCount}
            onCreateFolder={() => setIsCreateFolderModalOpen(true)}
            onDeleteFolder={handleDeleteFolder}
          />

          {/* Main Content */}
          <main className="flex-1 ml-60">
            {/* Usage Banner (show if API key not configured) */}
            <UsageBanner apiKeyStatus={apiKeyStatus} />

            {/* Notes Grid */}
            <NotesGrid
              notes={notes}
              folders={folders}
              onDeleteNote={handleDeleteNote}
              onMoveNote={(note) => {
                setNoteToMove(note);
                setIsMoveModalOpen(true);
              }}
            />
          </main>
        </div>

        {/* Modals */}
        <CreateFolderModal
          isOpen={isCreateFolderModalOpen}
          onClose={() => setIsCreateFolderModalOpen(false)}
          onCreateFolder={handleCreateFolder}
        />

        <MoveFolderModal
          isOpen={isMoveModalOpen}
          onClose={() => {
            setIsMoveModalOpen(false);
            setNoteToMove(null);
          }}
          note={noteToMove}
          folders={folders}
          onMoveNote={handleMoveNote}
        />

        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setNoteToDelete(null);
          }}
          onConfirm={confirmDeleteNote}
          itemType="note"
          itemName={noteToDelete?.title || ''}
        />
      </div>
    </div>
  );
}
