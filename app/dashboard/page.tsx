'use client';

import { useState, useEffect } from 'react';
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

// Initial mock data for development
const initialFolders: Folder[] = [
  { id: '1', name: 'CS 331', icon: '📘', color: '#bf5700', count: 5 },
  { id: '2', name: 'Chemistry 101', icon: '🧪', color: '#10b981', count: 3 },
  { id: '3', name: 'Calculus II', icon: '📐', color: '#3b82f6', count: 8 },
  { id: '4', name: 'Statistics', icon: '📊', color: '#8b5cf6', count: 2 },
];

const initialNotes: Note[] = [
  {
    id: '1',
    title: 'Recursion and Recurrence Relations',
    date: '2024-10-15',
    folderId: '1',
    preview: 'Introduction to recursive algorithms and how to solve recurrence relations using the Master Theorem...',
  },
  {
    id: '2',
    title: 'Chemical Bonding',
    date: '2024-10-14',
    folderId: '2',
    preview: 'Overview of ionic, covalent, and metallic bonds. Discussion of electronegativity and bond polarity...',
  },
  {
    id: '3',
    title: 'Integration by Parts',
    date: '2024-10-13',
    folderId: '3',
    preview: 'Derivation and application of integration by parts formula. Multiple examples including trigonometric functions...',
  },
  {
    id: '4',
    title: 'Graph Algorithms - DFS and BFS',
    date: '2024-10-12',
    folderId: '1',
    preview: 'Depth-first search and breadth-first search traversal algorithms. Time complexity analysis and applications...',
  },
  {
    id: '5',
    title: 'Hypothesis Testing',
    date: '2024-10-11',
    folderId: '4',
    preview: 'Introduction to null and alternative hypotheses. P-values, significance levels, and Type I/II errors...',
  },
  {
    id: '6',
    title: 'Dynamic Programming',
    date: '2024-10-10',
    folderId: '1',
    preview: 'Memoization and tabulation approaches. Classic problems: Fibonacci, coin change, longest common subsequence...',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [notes, setNotes] = useState<Note[]>(initialNotes);

  // Modal states
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToMove, setNoteToMove] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUserEmail(user.email || null);
      setLoading(false);
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUserEmail(session.user.email || null);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  // Calculate folder counts
  const foldersWithCounts = folders.map((folder) => ({
    ...folder,
    count: notes.filter((note) => note.folderId === folder.id).length
  }));

  const unorganizedCount = notes.filter((note) => !note.folderId).length;

  // Filter notes based on selected folder and search
  const filteredNotes = notes.filter((note) => {
    const matchesFolder =
      !selectedFolder ||
      selectedFolder === 'all' ||
      (selectedFolder === 'unorganized' && !note.folderId) ||
      note.folderId === selectedFolder;
    const matchesSearch =
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.preview.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  // Folder CRUD operations
  const handleCreateFolder = (name: string, icon: string, color: string) => {
    const newFolder: Folder = {
      id: Date.now().toString(),
      name,
      icon,
      color,
      count: 0
    };
    setFolders([...folders, newFolder]);
  };

  const handleDeleteFolder = (folderId: string) => {
    // Move notes from deleted folder to unorganized
    setNotes(notes.map((note) => (note.folderId === folderId ? { ...note, folderId: undefined } : note)));
    setFolders(folders.filter((f) => f.id !== folderId));
    if (selectedFolder === folderId) {
      setSelectedFolder(null);
    }
  };

  // Note operations
  const handleMoveNote = (noteId: string, folderId: string | undefined) => {
    setNotes(notes.map((note) => (note.id === noteId ? { ...note, folderId } : note)));
  };

  const handleDeleteNote = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      setNoteToDelete({ id: note.id, title: note.title });
      setIsDeleteModalOpen(true);
    }
  };

  const confirmDeleteNote = () => {
    if (noteToDelete) {
      setNotes(notes.filter((n) => n.id !== noteToDelete.id));
      setNoteToDelete(null);
    }
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}></div>
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
            folders={foldersWithCounts}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
            unorganizedCount={unorganizedCount}
            onCreateFolder={() => setIsCreateFolderModalOpen(true)}
          />

          {/* Main Content */}
          <main className="flex-1 ml-60">
            {/* Usage Banner (show if API key not configured) */}
            <UsageBanner
              apiKeyStatus="valid"
            />

            {/* Notes Grid */}
            <NotesGrid
              notes={filteredNotes}
              folders={foldersWithCounts}
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
          folders={foldersWithCounts}
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
