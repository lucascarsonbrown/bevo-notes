'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import TopNav from '@/components/TopNav';
import UsageBanner from '@/components/UsageBanner';
import CreateCourseModal from '@/components/CreateCourseModal';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import { useTheme } from '@/lib/hooks/useTheme';

interface Course {
  id: string;
  course_code: string;
  course_name: string;
  semester: string | null;
  year: number | null;
  professor: string | null;
  color: string;
  icon: string;
  noteCount: number;
  materialCount: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { isDark, toggle: toggleTheme } = useTheme();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<{ id: string; course_code: string; course_name: string } | null>(null);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses');
      if (!res.ok) return;
      const data = await res.json();
      setCourses(data.courses);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email || null);
      setLoading(false);
      await fetchCourses();
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/login');
      else setUserEmail(session.user.email || null);
    });

    return () => subscription.unsubscribe();
  }, [router, supabase, fetchCourses]);

  const handleCreateCourse = async (data: {
    course_code: string;
    course_name: string;
    semester: string;
    year: number;
    professor: string;
    color: string;
    icon: string;
  }) => {
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to create course');
        return;
      }
      await fetchCourses();
    } catch (err) {
      console.error('Failed to create course:', err);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      const res = await fetch(`/api/courses/${courseToDelete.id}`, { method: 'DELETE' });
      if (res.ok) await fetchCourses();
      setCourseToDelete(null);
    } catch (err) {
      console.error('Failed to delete course:', err);
    }
  };

  const filteredCourses = courses.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.course_code.toLowerCase().includes(q) ||
      c.course_name.toLowerCase().includes(q) ||
      c.professor?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div
            className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-bg-primary text-text-primary transition-colors">
        <TopNav
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isDark={isDark}
          onThemeToggle={toggleTheme}
          userEmail={userEmail}
        />

        <div className="pt-16">
          <UsageBanner />

          <main className="max-w-6xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>My Courses</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {courses.length} course{courses.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white transition-all"
                style={{ backgroundColor: 'var(--accent-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
              >
                + Add Course
              </button>
            </div>

            {/* Courses Grid */}
            {filteredCourses.length === 0 ? (
              <div
                className="rounded-xl border p-16 text-center"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              >
                {searchQuery ? (
                  <>
                    <div className="text-5xl mb-4">🔍</div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No courses match</h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Try a different search.</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-4">📚</div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Add your first course</h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                      Organize your notes and materials by course.
                    </p>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
                    >
                      Add Course →
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onClick={() => router.push(`/courses/${course.id}`)}
                    onDelete={() => setCourseToDelete({ id: course.id, course_code: course.course_code, course_name: course.course_name })}
                  />
                ))}
              </div>
            )}
          </main>
        </div>

        <CreateCourseModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreateCourse={handleCreateCourse}
        />

        <DeleteConfirmationModal
          isOpen={!!courseToDelete}
          onClose={() => setCourseToDelete(null)}
          onConfirm={handleDeleteCourse}
          itemType="course"
          itemName={courseToDelete ? `${courseToDelete.course_code} — ${courseToDelete.course_name}` : ''}
        />
      </div>
    </div>
  );
}

function CourseCard({
  course,
  onClick,
  onDelete,
}: {
  course: Course;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden transition-all cursor-pointer group"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      onClick={onClick}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = course.color}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
    >
      {/* Color bar */}
      <div className="h-1.5" style={{ backgroundColor: course.color }} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-3xl">{course.icon}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center transition-all text-sm"
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
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold mb-0.5" style={{ color: course.color }}>
            {course.course_code}
          </p>
          <h3 className="font-semibold text-base leading-snug" style={{ color: 'var(--text-primary)' }}>
            {course.course_name}
          </h3>
          {(course.semester || course.professor) && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {[course.semester && `${course.semester} ${course.year}`, course.professor].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {course.noteCount} note{course.noteCount !== 1 ? 's' : ''}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {course.materialCount} material{course.materialCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
