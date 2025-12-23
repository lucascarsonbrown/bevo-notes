'use client';

import { useState, useRef, useEffect } from 'react';

interface Note {
  id: string;
  title: string;
  date: string;
  folderId?: string;
  preview: string;
}

interface ExportDropdownProps {
  note: Note;
}

export default function ExportDropdown({ note }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = (format: 'pdf' | 'markdown' | 'html') => {
    const formattedDate = new Date(note.date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    if (format === 'markdown') {
      // Export as Markdown
      const content = `# ${note.title}\n\n*${formattedDate}*\n\n${note.preview}`;
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
    h1 { color: #1a1a1a; margin-bottom: 0.5rem; }
    .date { color: #6b7280; margin-bottom: 2rem; }
    .content { color: #374151; }
  </style>
</head>
<body>
  <h1>${note.title}</h1>
  <p class="date">${formattedDate}</p>
  <div class="content">${note.preview}</div>
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
    h1 { color: #1a1a1a; margin-bottom: 0.5rem; }
    .date { color: #6b7280; margin-bottom: 2rem; }
    .content { color: #374151; }
    @media print {
      body { margin: 1cm; }
    }
  </style>
</head>
<body>
  <h1>${note.title}</h1>
  <p class="date">${formattedDate}</p>
  <div class="content">${note.preview}</div>
</body>
</html>`);
        printWindow.document.close();
        printWindow.focus();

        // Small delay to ensure content is loaded before printing
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }

    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="text-sm font-medium flex items-center gap-1.5 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
      >
        📤 Export {isOpen ? '▲' : '▼'}
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-40 rounded-lg border shadow-lg overflow-hidden z-10"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExport('pdf');
            }}
            className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>📄</span>
            <span>Export as PDF</span>
          </button>

          <div className="h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExport('markdown');
            }}
            className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>📝</span>
            <span>Markdown (.md)</span>
          </button>

          <div className="h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExport('html');
            }}
            className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>🌐</span>
            <span>HTML (.html)</span>
          </button>
        </div>
      )}
    </div>
  );
}
