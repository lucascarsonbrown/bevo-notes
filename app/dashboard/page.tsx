'use client';

import { useState } from 'react';
import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import NotesGrid from '@/components/NotesGrid';
import UsageBanner from '@/components/UsageBanner';

// Mock data for development
const mockFolders = [
  { id: '1', name: 'CS 331', icon: '📘', color: '#bf5700', count: 5 },
  { id: '2', name: 'Chemistry 101', icon: '🧪', color: '#10b981', count: 3 },
  { id: '3', name: 'Calculus II', icon: '📐', color: '#3b82f6', count: 8 },
  { id: '4', name: 'Statistics', icon: '📊', color: '#8b5cf6', count: 2 },
];

const mockNotes = [
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
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);

  // Filter notes based on selected folder and search
  const filteredNotes = mockNotes.filter((note) => {
    const matchesFolder = !selectedFolder || selectedFolder === 'all' || note.folderId === selectedFolder;
    const matchesSearch = !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.preview.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-bg-primary text-text-primary transition-colors">
        {/* Top Navigation */}
        <TopNav
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isDark={isDark}
          onThemeToggle={() => setIsDark(!isDark)}
        />

        <div className="flex pt-16">
          {/* Sidebar */}
          <Sidebar
            folders={mockFolders}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
            unorganizedCount={0}
          />

          {/* Main Content */}
          <main className="flex-1 ml-60">
            {/* Usage Banner (show for trial users) */}
            <UsageBanner
              planType="trial"
              notesUsed={2}
              notesLimit={3}
            />

            {/* Notes Grid */}
            <NotesGrid
              notes={filteredNotes}
              folders={mockFolders}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
