'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';

// Mock data - will be replaced with real data from database
const mockNote = {
  id: '1',
  title: 'Introduction to Algorithms',
  date: '2024-03-15',
  folderId: '1',
  content: `# Introduction to Algorithms

## Overview
This lecture covered the fundamental concepts of algorithmic thinking and problem-solving strategies.

## Key Concepts

### 1. Algorithm Complexity
- **Time Complexity**: Measures how runtime scales with input size
- **Space Complexity**: Measures memory usage relative to input size
- Common notations:
  - O(1) - Constant time
  - O(log n) - Logarithmic time
  - O(n) - Linear time
  - O(n²) - Quadratic time

### 2. Big-O Notation
Big-O notation describes the upper bound of an algorithm's growth rate. It helps us:
- Compare algorithm efficiency
- Predict performance with large datasets
- Make informed design decisions

### 3. Problem-Solving Strategies
1. **Divide and Conquer**: Break problem into smaller subproblems
2. **Dynamic Programming**: Store solutions to overlapping subproblems
3. **Greedy Algorithms**: Make locally optimal choices
4. **Backtracking**: Explore all possible solutions systematically

## Example: Binary Search

Binary search is an efficient algorithm for finding an item in a sorted list:

\`\`\`python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1

    while left <= right:
        mid = (left + right) // 2

        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1

    return -1
\`\`\`

**Time Complexity**: O(log n)
**Space Complexity**: O(1)

## Practice Problems
1. Implement quicksort and analyze its complexity
2. Find the kth largest element in an unsorted array
3. Design an algorithm to detect cycles in a linked list

## Key Takeaways
- Understanding complexity helps write efficient code
- Different problems require different algorithmic approaches
- Practice is essential for developing algorithmic intuition

## Resources
- Introduction to Algorithms (CLRS textbook)
- LeetCode for practice problems
- Visualization tools: VisuAlgo.net`
};

const mockFolder = {
  id: '1',
  name: 'CS 331',
  icon: '💻',
  color: '#bf5700'
};

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const noteId = params.id as string;
  const note = mockNote; // TODO: Fetch based on noteId
  const folder = mockFolder;

  const formattedDate = new Date(note.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

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

  const handleDelete = () => {
    // TODO: Delete note from database
    router.push('/dashboard');
  };

  const handleExport = (format: 'pdf' | 'markdown' | 'html') => {
    if (format === 'markdown') {
      // Export as Markdown
      const content = `# ${note.title}\n\n*${formattedDate}*\n\n${note.content}`;
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
      // Export as HTML
      const htmlContent = note.content
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<)/gm, '<p>');

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
  <h1>${note.title}</h1>
  <p class="date">${formattedDate}</p>
  <div class="content">${htmlContent}</div>
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
      // Export as PDF using print dialog
      const htmlContent = note.content
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<)/gm, '<p>');

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
  <h1>${note.title}</h1>
  <p class="date">${formattedDate}</p>
  <div class="content">${htmlContent}</div>
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

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Top Bar */}
        <div
          className="fixed top-0 left-0 right-0 h-16 border-b flex items-center justify-between px-6 z-10"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)'
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
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                  color: 'var(--text-primary)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                📤 Export {showExportMenu ? '▲' : '▼'}
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 rounded-lg border shadow-lg overflow-hidden z-10"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-color)'
                  }}
                >
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>📄</span>
                    <span>Export as PDF</span>
                  </button>

                  <div className="h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

                  <button
                    onClick={() => handleExport('markdown')}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>📝</span>
                    <span>Markdown (.md)</span>
                  </button>

                  <div className="h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

                  <button
                    onClick={() => handleExport('html')}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>🌐</span>
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
              {folder && (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold mb-4"
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
              <h1
                className="text-4xl font-bold mb-3"
                style={{ color: 'var(--text-primary)' }}
              >
                {note.title}
              </h1>

              {/* Date */}
              <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                {formattedDate}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px mb-8" style={{ backgroundColor: 'var(--border-color)' }}></div>

            {/* Note Content */}
            <div
              className="prose prose-lg max-w-none"
              style={{
                color: 'var(--text-primary)',
                lineHeight: '1.8'
              }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: note.content
                    // Simple markdown-like rendering (basic implementation)
                    .replace(/^# (.*$)/gim, '<h1 style="color: var(--text-primary); font-size: 2.25rem; font-weight: bold; margin-top: 2rem; margin-bottom: 1rem;">$1</h1>')
                    .replace(/^## (.*$)/gim, '<h2 style="color: var(--text-primary); font-size: 1.875rem; font-weight: bold; margin-top: 1.75rem; margin-bottom: 0.875rem;">$1</h2>')
                    .replace(/^### (.*$)/gim, '<h3 style="color: var(--text-primary); font-size: 1.5rem; font-weight: bold; margin-top: 1.5rem; margin-bottom: 0.75rem;">$1</h3>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>')
                    .replace(/^- (.*$)/gim, '<li style="color: var(--text-secondary); margin-left: 1.5rem;">$1</li>')
                    .replace(/^(\d+)\. (.*$)/gim, '<li style="color: var(--text-secondary); margin-left: 1.5rem; list-style-type: decimal;">$2</li>')
                    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre style="background-color: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 1rem 0;"><code style="color: var(--text-primary); font-family: monospace; font-size: 0.875rem;">$2</code></pre>')
                    .replace(/`([^`]+)`/g, '<code style="background-color: var(--bg-secondary); color: var(--accent-primary); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.875rem;">$1</code>')
                    .replace(/\n\n/g, '</p><p style="color: var(--text-secondary); margin-bottom: 1rem;">')
                    .replace(/^(?!<)/gm, '<p style="color: var(--text-secondary); margin-bottom: 1rem;">')
                }}
              />
            </div>
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
    </div>
  );
}
