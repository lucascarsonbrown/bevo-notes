'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAICapability } from '@/lib/ai/AICapabilityProvider';
import { generateQuiz } from '@/lib/ai/quiz';
import { ensureNotesIndexed, type IndexableNote } from '@/lib/ai/rag';
import ReadOnlyNotice from '@/components/ReadOnlyNotice';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import { useTheme } from '@/lib/hooks/useTheme';

interface Material {
  id: string;
  title: string;
  type: 'syllabus' | 'textbook' | 'custom_notes';
  file_path: string;
  file_size_bytes: number | null;
  is_processed: boolean;
  created_at: string;
  unit_id: string | null;
}

interface Unit {
  id: string;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
  noteCount: number;
}

interface Note {
  id: string;
  title: string;
  lecture_date: string | null;
  created_at: string;
  preview: string;
  unit_id: string | null;
}

interface Course {
  id: string;
  course_code: string;
  course_name: string;
  semester: string | null;
  year: number | null;
  professor: string | null;
  color: string;
  icon: string;
}

export default function CoursePage() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [course, setCourse] = useState<Course | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDark, toggle: toggleTheme } = useTheme();
  const initialTab = (searchParams.get('tab') as 'units' | 'all-notes' | 'materials' | 'study') || 'units';
  const [activeTab, setActiveTab] = useState<'units' | 'all-notes' | 'materials' | 'study'>(initialTab);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Create unit state
  const [isCreatingUnit, setIsCreatingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitDesc, setNewUnitDesc] = useState('');
  const [savingUnit, setSavingUnit] = useState(false);

  // Delete state
  const [unitToDelete, setUnitToDelete] = useState<{ id: string; name: string } | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);

  const fetchCourse = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) { setError('Course not found'); return; }
      const data = await res.json();
      setCourse(data);
    } catch {
      setError('Failed to load course');
    }
  }, [courseId]);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/units`);
      if (!res.ok) return;
      const data = await res.json();
      setUnits(data.units);
    } catch {
      console.error('Failed to fetch units');
    }
  }, [courseId]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?course_id=${courseId}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotes(data.notes);
    } catch {
      console.error('Failed to fetch notes');
    }
  }, [courseId]);

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await fetch(`/api/materials?course_id=${courseId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMaterials(data.materials);
    } catch {
      console.error('Failed to fetch materials');
    }
  }, [courseId]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      await Promise.all([fetchCourse(), fetchUnits(), fetchNotes(), fetchMaterials()]);
      setLoading(false);
    };
    init();
  }, [router, supabase, fetchCourse, fetchUnits, fetchNotes, fetchMaterials]);

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    setSavingUnit(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUnitName.trim(), description: newUnitDesc.trim() || null }),
      });
      if (res.ok) {
        await fetchUnits();
        setNewUnitName('');
        setNewUnitDesc('');
        setIsCreatingUnit(false);
      }
    } catch (err) {
      console.error('Failed to create unit:', err);
    }
    setSavingUnit(false);
  };

  const handleDeleteUnit = async () => {
    if (!unitToDelete) return;
    try {
      await fetch(`/api/units/${unitToDelete.id}`, { method: 'DELETE' });
      await Promise.all([fetchUnits(), fetchNotes()]);
      setUnitToDelete(null);
    } catch (err) {
      console.error('Failed to delete unit:', err);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await fetch(`/api/notes/${noteToDelete.id}`, { method: 'DELETE' });
      await Promise.all([fetchNotes(), fetchUnits()]);
      setNoteToDelete(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleAssignUnit = async (noteId: string, unitId: string | null) => {
    try {
      await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId }),
      });
      await Promise.all([fetchNotes(), fetchUnits()]);
    } catch (err) {
      console.error('Failed to assign unit:', err);
    }
  };

  const unassignedNotes = notes.filter((n) => !n.unit_id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <p className="text-xl mb-4" style={{ color: 'var(--text-primary)' }}>{error || 'Course not found'}</p>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: 'var(--accent-primary)' }}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Top Bar */}
        <div className="fixed top-0 left-0 right-0 h-16 border-b flex items-center justify-between px-6 z-10"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
          <button onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
            ← Dashboard
          </button>
          <button onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="pt-16">
          {/* Course Header */}
          <div className="border-b" style={{ borderColor: 'var(--border-color)', borderTop: `4px solid ${course.color}` }}>
            <div className="max-w-5xl mx-auto px-6 py-6">
              <div className="flex items-start gap-4">
                <span className="text-4xl">{course.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-0.5" style={{ color: course.color }}>{course.course_code}</p>
                  <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{course.course_name}</h1>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {[course.semester && `${course.semester} ${course.year}`, course.professor].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{units.length} unit{units.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="max-w-5xl mx-auto px-6">
              <div className="flex gap-1 -mb-px">
                {(['units', 'all-notes', 'materials', 'study'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
                    style={{
                      borderColor: activeTab === tab ? course.color : 'transparent',
                      color: activeTab === tab ? course.color : 'var(--text-secondary)',
                    }}>
                    {tab === 'units' ? 'Units'
                      : tab === 'all-notes' ? 'All Notes'
                      : tab === 'materials' ? `Materials${materials.length > 0 ? ` (${materials.length})` : ''}`
                      : '✦ Study'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-5xl mx-auto px-6 py-8">
            {activeTab === 'units' && (
              <div className="space-y-4">
                {/* Units list */}
                {units.map((unit) => {
                  const unitNotes = notes.filter((n) => n.unit_id === unit.id);
                  return (
                    <UnitSection
                      key={unit.id}
                      unit={unit}
                      notes={unitNotes}
                      units={units}
                      onDeleteUnit={() => setUnitToDelete({ id: unit.id, name: unit.name })}
                      onDeleteNote={(note) => setNoteToDelete({ id: note.id, title: note.title })}
                      onNoteClick={(noteId) => router.push(`/notes/${noteId}`)}
                      onAssignUnit={handleAssignUnit}
                    />
                  );
                })}

                {/* Unassigned notes */}
                {unassignedNotes.length > 0 && (
                  <UnitSection
                    unit={null}
                    notes={unassignedNotes}
                    units={units}
                    onDeleteUnit={() => {}}
                    onDeleteNote={(note) => setNoteToDelete({ id: note.id, title: note.title })}
                    onNoteClick={(noteId) => router.push(`/notes/${noteId}`)}
                    onAssignUnit={handleAssignUnit}
                  />
                )}

                {/* Create unit form / button */}
                {isCreatingUnit ? (
                  <form onSubmit={handleCreateUnit}
                    className="rounded-xl border p-5"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={newUnitName}
                        onChange={(e) => setNewUnitName(e.target.value)}
                        placeholder="Unit name (e.g. Unit 1: Memory Management)"
                        className="w-full px-3 py-2.5 rounded-lg border transition-colors text-sm"
                        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                        autoFocus
                      />
                      <input
                        type="text"
                        value={newUnitDesc}
                        onChange={(e) => setNewUnitDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="w-full px-3 py-2.5 rounded-lg border transition-colors text-sm"
                        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      />
                      <div className="flex gap-2">
                        <button type="submit" disabled={savingUnit || !newUnitName.trim()}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                          style={{ backgroundColor: course.color }}>
                          {savingUnit ? 'Saving...' : 'Create Unit'}
                        </button>
                        <button type="button" onClick={() => { setIsCreatingUnit(false); setNewUnitName(''); setNewUnitDesc(''); }}
                          className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => setIsCreatingUnit(true)}
                    className="w-full rounded-xl border-2 border-dashed py-5 text-sm font-medium transition-all"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = course.color; e.currentTarget.style.color = course.color; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                    + Add Unit
                  </button>
                )}

                {units.length === 0 && unassignedNotes.length === 0 && !isCreatingUnit && (
                  <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    <p className="text-sm">No units yet. Create a unit to organize your notes.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'all-notes' && (
              <div>
                {notes.length === 0 ? (
                  <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
                    <div className="text-4xl mb-3">📝</div>
                    <p className="text-sm">No notes yet. Use the Chrome extension to generate notes from lectures.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <NoteRow
                        key={note.id}
                        note={note}
                        units={units}
                        onClick={() => router.push(`/notes/${note.id}`)}
                        onDelete={() => setNoteToDelete({ id: note.id, title: note.title })}
                        onAssignUnit={handleAssignUnit}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'materials' && (
              <MaterialsTab
                courseId={courseId}
                materials={materials}
                units={units}
                courseColor={course.color}
                onUploaded={fetchMaterials}
                isUploadModalOpen={isUploadModalOpen}
                setIsUploadModalOpen={setIsUploadModalOpen}
              />
            )}

            {activeTab === 'study' && (
              <StudyTab
                courseId={courseId}
                courseColor={course.color}
                units={units}
                notes={notes}
              />
            )}
          </div>
        </div>

        <DeleteConfirmationModal
          isOpen={!!unitToDelete}
          onClose={() => setUnitToDelete(null)}
          onConfirm={handleDeleteUnit}
          itemType="unit"
          itemName={unitToDelete?.name || ''}
        />

        <DeleteConfirmationModal
          isOpen={!!noteToDelete}
          onClose={() => setNoteToDelete(null)}
          onConfirm={handleDeleteNote}
          itemType="note"
          itemName={noteToDelete?.title || ''}
        />
      </div>
    </div>
  );
}

function MaterialsTab({
  courseId,
  materials,
  units,
  courseColor,
  onUploaded,
  isUploadModalOpen,
  setIsUploadModalOpen,
}: {
  courseId: string;
  materials: Material[];
  units: Unit[];
  courseColor: string;
  onUploaded: () => void;
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (v: boolean) => void;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'syllabus' | 'textbook' | 'custom_notes'>('syllabus');
  const [unitId, setUnitId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const typeLabels: Record<string, string> = {
    syllabus: '📋 Syllabus',
    textbook: '📖 Textbook',
    custom_notes: '📄 Notes/Handout',
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setUploading(true);
    setError(null);
    setUploadProgress(10);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${courseId}/${Date.now()}.${ext}`;

      setUploadProgress(30);
      const { error: storageError } = await supabase.storage
        .from('materials')
        .upload(filePath, file, { upsert: false });

      if (storageError) throw new Error(storageError.message);
      setUploadProgress(70);

      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          unit_id: unitId || null,
          type,
          title: title.trim(),
          file_path: filePath,
          file_size_bytes: file.size,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save material');
      }

      const saved = await res.json();
      setUploadProgress(85);

      // Trigger text extraction
      await fetch(`/api/materials/${saved.id}/process`, { method: 'POST' });

      setUploadProgress(100);
      setTitle('');
      setType('syllabus');
      setUnitId('');
      setFile(null);
      setIsUploadModalOpen(false);
      onUploaded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this material?')) return;
    await fetch(`/api/materials/${id}`, { method: 'DELETE' });
    onUploaded();
  };

  const handleDownload = async (id: string, title: string) => {
    const res = await fetch(`/api/materials/${id}`);
    if (!res.ok) return;
    const { url } = await res.json();
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.download = title;
    a.click();
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Syllabi, textbooks, and handouts for this course.
        </p>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
          style={{ backgroundColor: courseColor }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          + Upload Material
        </button>
      </div>

      {/* Upload form */}
      {isUploadModalOpen && (
        <form
          onSubmit={handleUpload}
          className="rounded-xl border p-5 mb-6 space-y-4"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Upload Material</h3>

          {/* File picker */}
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>File (PDF, DOCX, TXT)</label>
            <input
              type="file"
              accept=".txt,.md"
              onChange={handleFileChange}
              required
              className="w-full text-sm rounded-lg border px-3 py-2 transition-colors"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Title */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CS 429 Syllabus"
                required
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="syllabus">Syllabus</option>
                <option value="textbook">Textbook</option>
                <option value="custom_notes">Notes / Handout</option>
              </select>
            </div>
          </div>

          {/* Unit (optional) */}
          {units.length > 0 && (
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Assign to unit (optional)</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="">No unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Progress bar */}
          {uploading && (
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, backgroundColor: courseColor }}
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all"
              style={{ backgroundColor: courseColor }}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => { setIsUploadModalOpen(false); setError(null); setFile(null); setTitle(''); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Materials list */}
      {materials.length === 0 && !isUploadModalOpen ? (
        <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
          <div className="text-4xl mb-3">📎</div>
          <p className="text-sm">No materials yet. Upload a syllabus, textbook, or handout.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((m) => {
            const unit = units.find((u) => u.id === m.unit_id);
            return (
              <div
                key={m.id}
                className="flex items-center justify-between px-5 py-3.5 rounded-xl border group transition-colors"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">{m.type === 'syllabus' ? '📋' : m.type === 'textbook' ? '📖' : '📄'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.title}</p>
                      {!m.is_processed && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                          Processing…
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {typeLabels[m.type]}
                      {unit ? ` · ${unit.name}` : ''}
                      {m.file_size_bytes ? ` · ${formatSize(m.file_size_bytes)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                  <button
                    onClick={() => handleDownload(m.id, m.title)}
                    className="opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)'; e.currentTarget.style.color = '#dc2626'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UnitSection({
  unit,
  notes,
  units,
  onDeleteUnit,
  onDeleteNote,
  onNoteClick,
  onAssignUnit,
}: {
  unit: Unit | null;
  notes: Note[];
  units: Unit[];
  onDeleteUnit: () => void;
  onDeleteNote: (note: Note) => void;
  onNoteClick: (noteId: string) => void;
  onAssignUnit: (noteId: string, unitId: string | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
      {/* Unit header */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer group"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs transition-transform" style={{ color: 'var(--text-secondary)', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: unit ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {unit ? unit.name : 'Unassigned Notes'}
            </p>
            {unit?.description && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{unit.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
          {unit && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteUnit(); }}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-xs transition-all"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)'; e.currentTarget.style.color = '#dc2626'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      {!collapsed && (
        <div style={{ backgroundColor: 'var(--bg-primary)' }}>
          {notes.length === 0 ? (
            <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              No notes assigned to this unit yet.
            </p>
          ) : (
            notes.map((note, i) => (
              <div key={note.id}>
                {i > 0 && <div className="h-px mx-5" style={{ backgroundColor: 'var(--border-color)' }} />}
                <NoteRow
                  note={note}
                  units={units}
                  onClick={() => onNoteClick(note.id)}
                  onDelete={() => onDeleteNote(note)}
                  onAssignUnit={onAssignUnit}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NoteRow({
  note,
  units,
  onClick,
  onDelete,
  onAssignUnit,
}: {
  note: Note;
  units: Unit[];
  onClick: () => void;
  onDelete: () => void;
  onAssignUnit?: (noteId: string, unitId: string | null) => void;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const unit = units.find((u) => u.id === note.unit_id);
  const date = new Date(note.lecture_date || note.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div
      className="flex items-center justify-between px-5 py-3 cursor-pointer group transition-colors relative"
      onClick={onClick}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; setShowAssign(false); }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{note.title}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
          {date}{unit ? ` · ${unit.name}` : ''}
          {note.preview ? ` · ${note.preview.slice(0, 80)}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-4 opacity-0 group-hover:opacity-100 transition-all">
        {onAssignUnit && units.length > 0 && (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowAssign(!showAssign)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)' }}
            >
              {note.unit_id ? 'Move' : '+ Assign unit'}
            </button>
            {showAssign && (
              <div
                className="absolute right-0 top-full mt-1 rounded-lg border shadow-lg z-20 py-1 min-w-40"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
              >
                {note.unit_id && (
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={() => { onAssignUnit(note.id, null); setShowAssign(false); }}
                  >
                    Remove from unit
                  </button>
                )}
                {units.map((u) => (
                  <button
                    key={u.id}
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                    style={{
                      color: u.id === note.unit_id ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontWeight: u.id === note.unit_id ? 600 : 400,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={() => { onAssignUnit(note.id, u.id); setShowAssign(false); }}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)'; e.currentTarget.style.color = '#dc2626'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
          🗑️
        </button>
      </div>
    </div>
  );
}

interface StudyTool {
  id: string;
  query: string;
  format: 'flashcard' | 'multiple_choice' | 'free_response';
  mode: string | null;
  unit_id: string | null;
  created_at: string;
  questions: unknown;
}

function StudyTab({
  courseId,
  courseColor,
  units,
  notes,
}: {
  courseId: string;
  courseColor: string;
  units: Unit[];
  notes: Note[];
}) {
  const router = useRouter();
  const [tools, setTools] = useState<StudyTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [courseMaterials, setCourseMaterials] = useState<Material[]>([]);

  // Generate form state
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<'flashcard' | 'multiple_choice' | 'free_response'>('flashcard');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<string>('');
  const { capability, isReadOnly, explanation } = useAICapability();

  const fetchTools = async () => {
    try {
      const res = await fetch(`/api/study?course_id=${courseId}`);
      if (!res.ok) return;
      const data = await res.json();
      setTools(data.tools);
    } catch {
      console.error('Failed to fetch study tools');
    } finally {
      setLoadingTools(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await fetch(`/api/materials?course_id=${courseId}`);
      if (!res.ok) return;
      const data = await res.json();
      setCourseMaterials(data.materials || []);
    } catch {
      console.error('Failed to fetch materials');
    }
  };

  useEffect(() => {
    fetchTools();
    fetchMaterials();
  }, [courseId]);

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  const toggleMaterial = (materialId: string) => {
    setSelectedMaterialIds((prev) =>
      prev.includes(materialId) ? prev.filter((id) => id !== materialId) : [...prev, materialId]
    );
  };

  const nothingSelected = selectedUnitIds.length === 0 && selectedMaterialIds.length === 0;

  /** Gather raw text plus the notes themselves, so they can also be indexed locally. */
  const collectSource = async (): Promise<{ text: string; notes: IndexableNote[] }> => {
    const parts: string[] = [];
    const collected: IndexableNote[] = [];

    if (selectedUnitIds.length) {
      const res = await fetch(`/api/notes?course_id=${courseId}&include_content=1&limit=200`);
      if (res.ok) {
        const data = await res.json();
        const selected = (data.notes || []).filter(
          (n: { unit_id: string | null }) => n.unit_id && selectedUnitIds.includes(n.unit_id)
        );
        for (const note of selected) {
          collected.push({ id: note.id, unit_id: note.unit_id, notes_json: note.notes_json ?? null });
          const text = (note.notes_html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text) parts.push(`=== ${note.title} ===\n${text}`);
        }
      }
    }

    for (const materialId of selectedMaterialIds) {
      const res = await fetch(`/api/materials/${materialId}`);
      if (!res.ok) continue;
      const data = await res.json();
      const material = data.material ?? data;
      if (material?.content_text) parts.push(`=== ${material.title} ===\n${material.content_text}`);
    }

    return { text: parts.join('\n\n'), notes: collected };
  };

  // Generation runs on this device; the API call afterwards only persists the result.
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nothingSelected) { setGenError('Select at least one unit or material.'); return; }
    if (!capability || capability.mode === 'readonly') { setGenError(explanation); return; }
    setGenerating(true);
    setGenError(null);
    setGenStatus('Gathering your notes…');
    try {
      const { text: fallbackText, notes: sourceNotes } = await collectSource();

      // Build the local index for anything not yet embedded on this origin.
      if (capability.embeddingModel) {
        await ensureNotesIndexed(courseId, sourceNotes, (done, total) =>
          setGenStatus(`Indexing notes — ${done} of ${total}`)
        ).catch(() => undefined);
      }

      const { questions } = await generateQuiz({
        capability,
        format,
        count,
        courseId,
        unitIds: selectedUnitIds,
        query,
        fallbackText,
        onProgress: setGenStatus,
      });

      setGenStatus('Saving…');
      const res = await fetch('/api/study/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, unit_ids: selectedUnitIds, format, query, questions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      router.push(`/courses/${courseId}/study/${data.id}`);
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Something went wrong');
      setGenerating(false);
      setGenStatus('');
    }
  };

  const formatLabel = { flashcard: '🃏 Flashcards', multiple_choice: '📋 Quiz (MCQ)', free_response: '✏️ Free Response' };
  const formatIcon = { flashcard: '🃏', multiple_choice: '📋', free_response: '✏️' };
  const materialTypeIcon = { syllabus: '📋', textbook: '📖', custom_notes: '📄' };

  return (
    <div className="space-y-8">
      {/* Generate form */}
      <div className="rounded-xl border p-6 space-y-5" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <div>
          <h2 className="font-semibold text-base mb-0.5" style={{ color: 'var(--text-primary)' }}>Generate a study tool</h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Built on your device from your notes and materials</p>
        </div>

        <ReadOnlyNotice />

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Natural language prompt */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>What do you want to study? (optional)</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`e.g. "Focus on memory management and pointers"`}
              className="w-full px-3 py-2.5 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Format</label>
            <div className="flex gap-2">
              {(['flashcard', 'multiple_choice', 'free_response'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className="flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all"
                  style={{
                    borderColor: format === f ? courseColor : 'var(--border-color)',
                    color: format === f ? courseColor : 'var(--text-secondary)',
                    backgroundColor: format === f ? `${courseColor}15` : 'var(--bg-primary)',
                  }}
                >
                  {formatLabel[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Units */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Units (notes)</label>
            {units.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No units yet — create units and assign notes first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {units.map((u) => {
                  const selected = selectedUnitIds.includes(u.id);
                  const unitNoteCount = notes.filter((n) => n.unit_id === u.id).length;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUnit(u.id)}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                      style={{
                        borderColor: selected ? courseColor : 'var(--border-color)',
                        color: selected ? courseColor : 'var(--text-secondary)',
                        backgroundColor: selected ? `${courseColor}15` : 'var(--bg-primary)',
                      }}
                    >
                      {selected ? '✓ ' : ''}{u.name} <span className="opacity-60">({unitNoteCount})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Materials */}
          {courseMaterials.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Materials (syllabi, textbooks, handouts)</label>
              <div className="flex flex-wrap gap-2">
                {courseMaterials.map((m) => {
                  const selected = selectedMaterialIds.includes(m.id);
                  const unprocessed = !m.is_processed;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => !unprocessed && toggleMaterial(m.id)}
                      disabled={unprocessed}
                      title={unprocessed ? 'Still extracting text — check back in a moment' : undefined}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderColor: selected ? courseColor : 'var(--border-color)',
                        color: selected ? courseColor : 'var(--text-secondary)',
                        backgroundColor: selected ? `${courseColor}15` : 'var(--bg-primary)',
                      }}
                    >
                      {unprocessed ? '⏳ ' : selected ? '✓ ' : ''}{materialTypeIcon[m.type]} {m.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Count */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Number of {format === 'flashcard' ? 'cards' : 'questions'}: <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>
            </label>
            <input
              type="range"
              min={3}
              max={30}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-current"
              style={{ accentColor: courseColor }}
            />
            <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              <span>3</span><span>30</span>
            </div>
          </div>

          {genError && <p className="text-xs text-red-500">{genError}</p>}

          <button
            type="submit"
            disabled={generating || nothingSelected || isReadOnly}
            title={isReadOnly ? explanation : undefined}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: courseColor }}
          >
            {generating ? (genStatus || 'Generating…') : `Generate ${formatLabel[format]}`}
          </button>
        </form>
      </div>

      {/* Past tools */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Past study tools</h3>
        {loadingTools ? (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : tools.length === 0 ? (
          <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>
            <div className="text-3xl mb-2">🎓</div>
            <p className="text-sm">No study tools yet. Generate one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tools.map((tool) => {
              const unit = units.find((u) => u.id === tool.unit_id);
              const date = new Date(tool.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const qCount = Array.isArray(tool.questions) ? tool.questions.length : 0;
              return (
                <button
                  key={tool.id}
                  onClick={() => router.push(`/courses/${courseId}/study/${tool.id}`)}
                  className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl border text-left transition-colors group"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = courseColor}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{formatIcon[tool.format]}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {tool.query || `${formatLabel[tool.format]}`}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {qCount} {tool.format === 'flashcard' ? 'cards' : 'questions'}{unit ? ` · ${unit.name}` : ''} · {date}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>→</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
