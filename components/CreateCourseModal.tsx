'use client';

import { useState } from 'react';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCourse: (data: {
    course_code: string;
    course_name: string;
    semester: string;
    year: number;
    professor: string;
    color: string;
    icon: string;
  }) => void;
}

const ICON_OPTIONS = ['📚', '💻', '🧪', '📐', '🎨', '🎵', '⚡', '🌟', '🔬', '📊', '🧠', '📝'];
const COLOR_OPTIONS = [
  { name: 'UT Orange', value: '#bf5700' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Teal', value: '#14b8a6' },
];

const CURRENT_YEAR = new Date().getFullYear();
const SEMESTERS = ['Fall', 'Spring', 'Summer'];
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function CreateCourseModal({ isOpen, onClose, onCreateCourse }: CreateCourseModalProps) {
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [semester, setSemester] = useState('Fall');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [professor, setProfessor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📚');
  const [selectedColor, setSelectedColor] = useState('#bf5700');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!courseCode.trim()) e.courseCode = 'Course code is required (e.g. CS 429)';
    if (!courseName.trim()) e.courseName = 'Course name is required';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    onCreateCourse({
      course_code: courseCode.trim(),
      course_name: courseName.trim(),
      semester,
      year,
      professor: professor.trim(),
      color: selectedColor,
      icon: selectedIcon,
    });

    reset();
    onClose();
  };

  const reset = () => {
    setCourseCode('');
    setCourseName('');
    setSemester('Fall');
    setYear(CURRENT_YEAR);
    setProfessor('');
    setSelectedIcon('📚');
    setSelectedColor('#bf5700');
    setErrors({});
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border shadow-xl overflow-y-auto max-h-[90vh]"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Add Course</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Course Code + Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Course Code *
              </label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => { setCourseCode(e.target.value); setErrors((prev) => ({ ...prev, courseCode: '' })); }}
                placeholder="CS 429"
                className="w-full px-3 py-2.5 rounded-lg border transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: errors.courseCode ? '#ef4444' : 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                autoFocus
              />
              {errors.courseCode && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.courseCode}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Semester
              </label>
              <div className="flex gap-2">
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg border transition-colors"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-24 px-3 py-2.5 rounded-lg border transition-colors"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Course Name *
            </label>
            <input
              type="text"
              value={courseName}
              onChange={(e) => { setCourseName(e.target.value); setErrors((prev) => ({ ...prev, courseName: '' })); }}
              placeholder="Computer Architecture"
              className="w-full px-3 py-2.5 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: errors.courseName ? '#ef4444' : 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.courseName && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.courseName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Professor (optional)
            </label>
            <input
              type="text"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Prof. Smith"
              className="w-full px-3 py-2.5 rounded-lg border transition-colors"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Icon</label>
            <div className="grid grid-cols-6 gap-2">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className="h-11 rounded-lg border-2 transition-all flex items-center justify-center text-xl"
                  style={{
                    backgroundColor: selectedIcon === icon ? 'var(--accent-light)' : 'var(--bg-secondary)',
                    borderColor: selectedIcon === icon ? 'var(--accent-primary)' : 'transparent',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Color</label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className="h-11 rounded-lg border-2 transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: color.value,
                    borderColor: selectedColor === color.value ? 'var(--text-primary)' : 'transparent',
                    opacity: selectedColor === color.value ? 1 : 0.7,
                  }}
                >
                  {selectedColor === color.value && <span className="text-white text-lg">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div
            className="rounded-lg p-4 flex items-center gap-3"
            style={{ backgroundColor: 'var(--bg-secondary)', borderLeft: `4px solid ${selectedColor}` }}
          >
            <span className="text-2xl">{selectedIcon}</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {courseCode || 'CS 429'} — {courseName || 'Course Name'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {semester} {year}{professor ? ` · ${professor}` : ''}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-lg border font-medium transition-colors"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white transition-all"
              style={{ backgroundColor: 'var(--accent-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
            >
              Add Course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
