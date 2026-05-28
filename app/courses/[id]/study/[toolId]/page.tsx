'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Flashcard { front: string; back: string; }
interface MCQQuestion { question: string; choices: string[]; answer: string; explanation: string; }
interface FRQuestion { question: string; model_answer: string; }
type Question = Flashcard | MCQQuestion | FRQuestion;

interface StudyTool {
  id: string;
  query: string | null;
  format: 'flashcard' | 'multiple_choice' | 'free_response';
  questions: Question[];
  created_at: string;
  courses: { course_code: string; course_name: string; color: string } | null;
}

interface GradeResult { score: number; feedback: string; }

export default function StudyToolPage() {
  const { id: courseId, toolId } = useParams<{ id: string; toolId: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [tool, setTool] = useState<StudyTool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // MCQ state
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [showMCQResult, setShowMCQResult] = useState(false);

  // Free response state
  const [frAnswer, setFrAnswer] = useState('');
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  const fetchTool = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data, error } = await supabase
        .from('quizzes')
        .select('id, query, format, questions, created_at, courses(course_code, course_name, color)')
        .eq('id', toolId)
        .eq('user_id', user.id)
        .single();

      if (error || !data) { setError('Study tool not found'); return; }
      setTool(data as unknown as StudyTool);
    } catch {
      setError('Failed to load study tool');
    } finally {
      setLoading(false);
    }
  }, [toolId, supabase, router]);

  useEffect(() => { fetchTool(); }, [fetchTool]);

  const questions = tool?.questions || [];
  const total = questions.length;
  const current = questions[currentIndex];
  const courseColor = tool?.courses?.color || '#bf5700';

  const goNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
      setSelectedChoice(null);
      setShowMCQResult(false);
      setFrAnswer('');
      setGradeResult(null);
      setShowModelAnswer(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFlipped(false);
      setSelectedChoice(null);
      setShowMCQResult(false);
      setFrAnswer('');
      setGradeResult(null);
      setShowModelAnswer(false);
    }
  };

  const handleGrade = async () => {
    if (!frAnswer.trim() || !current) return;
    const q = current as FRQuestion;
    setGrading(true);
    try {
      const res = await fetch('/api/study/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.question, model_answer: q.model_answer, student_answer: frAnswer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGradeResult(data);
    } catch (err) {
      setGradeResult({ score: 0, feedback: err instanceof Error ? err.message : 'Grading failed' });
    } finally {
      setGrading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: 'var(--text-primary)' }}>{error || 'Not found'}</p>
          <button onClick={() => router.push(`/courses/${courseId}`)} className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: courseColor }}>Back to Course</button>
        </div>
      </div>
    );
  }

  const formatLabel = { flashcard: 'Flashcards', multiple_choice: 'Quiz', free_response: 'Free Response' };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 border-b flex items-center justify-between px-6 z-10"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
        <button
          onClick={() => router.push(`/courses/${courseId}?tab=study`)}
          className="text-sm transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = courseColor}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          ← {tool.courses?.course_code || 'Course'} · Study
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {formatLabel[tool.format]} · {currentIndex + 1} / {total}
          </span>
          {/* Progress bar */}
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / total) * 100}%`, backgroundColor: courseColor }} />
          </div>
        </div>
      </div>

      <div className="pt-14 flex flex-col items-center justify-start min-h-screen px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Title */}
          {tool.query && (
            <p className="text-center text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>"{tool.query}"</p>
          )}

          {/* FLASHCARD */}
          {tool.format === 'flashcard' && current && (
            <div className="space-y-4">
              <div
                onClick={() => setFlipped(!flipped)}
                className="rounded-2xl border cursor-pointer transition-all p-10 min-h-56 flex flex-col items-center justify-center text-center select-none"
                style={{
                  backgroundColor: flipped ? `${courseColor}10` : 'var(--bg-secondary)',
                  borderColor: flipped ? courseColor : 'var(--border-color)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {flipped ? 'Answer' : 'Term'}
                </p>
                <p className="text-lg font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {flipped ? (current as Flashcard).back : (current as Flashcard).front}
                </p>
                {!flipped && (
                  <p className="text-xs mt-6" style={{ color: 'var(--text-secondary)' }}>Click to flip</p>
                )}
              </div>
            </div>
          )}

          {/* MULTIPLE CHOICE */}
          {tool.format === 'multiple_choice' && current && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-8" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                <p className="font-medium text-base leading-relaxed mb-6" style={{ color: 'var(--text-primary)' }}>
                  {(current as MCQQuestion).question}
                </p>
                <div className="space-y-2.5">
                  {(current as MCQQuestion).choices.map((choice) => {
                    const isCorrect = choice === (current as MCQQuestion).answer;
                    const isSelected = choice === selectedChoice;
                    let borderColor = 'var(--border-color)';
                    let bgColor = 'var(--bg-primary)';
                    let textColor = 'var(--text-primary)';
                    if (showMCQResult) {
                      if (isCorrect) { borderColor = '#22c55e'; bgColor = 'rgba(34,197,94,0.1)'; textColor = '#22c55e'; }
                      else if (isSelected) { borderColor = '#ef4444'; bgColor = 'rgba(239,68,68,0.1)'; textColor = '#ef4444'; }
                    } else if (isSelected) {
                      borderColor = courseColor; bgColor = `${courseColor}15`;
                    }
                    return (
                      <button
                        key={choice}
                        onClick={() => { if (!showMCQResult) setSelectedChoice(choice); }}
                        className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-all"
                        style={{ borderColor, backgroundColor: bgColor, color: textColor }}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
                {!showMCQResult && selectedChoice && (
                  <button
                    onClick={() => setShowMCQResult(true)}
                    className="mt-4 px-5 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: courseColor }}
                  >
                    Check Answer
                  </button>
                )}
                {showMCQResult && (
                  <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{(current as MCQQuestion).explanation}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FREE RESPONSE */}
          {tool.format === 'free_response' && current && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-8" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                <p className="font-medium text-base leading-relaxed mb-5" style={{ color: 'var(--text-primary)' }}>
                  {(current as FRQuestion).question}
                </p>
                <textarea
                  value={frAnswer}
                  onChange={(e) => setFrAnswer(e.target.value)}
                  disabled={!!gradeResult}
                  placeholder="Type your answer here…"
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border text-sm resize-none transition-colors"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                {!gradeResult && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleGrade}
                      disabled={grading || !frAnswer.trim()}
                      className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all"
                      style={{ backgroundColor: courseColor }}
                    >
                      {grading ? 'Grading…' : 'Submit'}
                    </button>
                    <button
                      onClick={() => setShowModelAnswer(!showModelAnswer)}
                      className="px-4 py-2 rounded-lg text-sm border transition-colors"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                    >
                      {showModelAnswer ? 'Hide answer' : 'Show answer'}
                    </button>
                  </div>
                )}

                {gradeResult && (
                  <div className="mt-4 space-y-3">
                    {/* Score badge */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg"
                        style={{
                          backgroundColor: gradeResult.score >= 70 ? 'rgba(34,197,94,0.15)' : gradeResult.score >= 40 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                          color: gradeResult.score >= 70 ? '#22c55e' : gradeResult.score >= 40 ? '#eab308' : '#ef4444',
                        }}
                      >
                        {gradeResult.score}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{gradeResult.feedback}</p>
                    </div>
                    <button
                      onClick={() => setShowModelAnswer(!showModelAnswer)}
                      className="text-xs underline"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {showModelAnswer ? 'Hide model answer' : 'View model answer'}
                    </button>
                  </div>
                )}

                {showModelAnswer && (
                  <div className="mt-3 p-4 rounded-xl text-sm leading-relaxed" style={{ backgroundColor: 'var(--bg-primary)', borderLeft: `3px solid ${courseColor}`, color: 'var(--text-secondary)' }}>
                    {(current as FRQuestion).model_answer}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-30"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { if (currentIndex > 0) e.currentTarget.style.borderColor = courseColor; }}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
              ← Previous
            </button>

            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {currentIndex + 1} of {total}
            </span>

            {currentIndex < total - 1 ? (
              <button
                onClick={goNext}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
                style={{ backgroundColor: courseColor }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => router.push(`/courses/${courseId}?tab=study`)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
                style={{ backgroundColor: courseColor }}
              >
                Done ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
