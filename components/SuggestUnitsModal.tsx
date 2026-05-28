'use client';

import { useState, useEffect } from 'react';

interface Suggestion {
  name: string;
  description: string;
}

interface SuggestUnitsModalProps {
  courseId: string;
  materialId: string;
  courseColor: string;
  onClose: () => void;
  onUnitsCreated: () => void;
}

export default function SuggestUnitsModal({
  courseId,
  materialId,
  courseColor,
  onClose,
  onUnitsCreated,
}: SuggestUnitsModalProps) {
  const [phase, setPhase] = useState<'loading' | 'review' | 'creating' | 'error'>('loading');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestions() {
      try {
        const res = await fetch(`/api/courses/${courseId}/units/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ material_id: materialId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setErrorMsg(data.error || 'Failed to generate suggestions');
          setPhase('error');
          return;
        }
        setSuggestions(data.suggestions);
        setSelected(data.suggestions.map(() => true));
        setPhase('review');
      } catch {
        if (!cancelled) { setErrorMsg('Network error. Please try again.'); setPhase('error'); }
      }
    }

    fetchSuggestions();
    return () => { cancelled = true; };
  }, [courseId, materialId]);

  const toggle = (i: number) => setSelected((prev) => prev.map((v, j) => (j === i ? !v : v)));
  const toggleAll = () => {
    const allOn = selected.every(Boolean);
    setSelected(selected.map(() => !allOn));
  };

  const handleCreate = async () => {
    const toCreate = suggestions.filter((_, i) => selected[i]);
    if (!toCreate.length) return;
    setPhase('creating');
    let created = 0;
    for (let i = 0; i < toCreate.length; i++) {
      const s = toCreate[i];
      try {
        const res = await fetch(`/api/courses/${courseId}/units`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: s.name, description: s.description, position: i }),
        });
        if (res.ok) created++;
      } catch { /* skip failed individual unit */ }
      setCreatedCount(created);
    }
    onUnitsCreated();
    onClose();
  };

  const selectedCount = selected.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              ✦ AI Unit Suggestions
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Generated from your syllabus
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div
                className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: courseColor, borderTopColor: 'transparent' }}
              />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Reading syllabus and extracting units…
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-8 text-center">
              <p className="text-sm text-red-500 mb-4">{errorMsg}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
                Close
              </button>
            </div>
          )}

          {(phase === 'review' || phase === 'creating') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {selectedCount} of {suggestions.length} selected
                </span>
                <button
                  onClick={toggleAll}
                  className="text-xs font-medium transition-colors"
                  style={{ color: courseColor }}
                >
                  {selected.every(Boolean) ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggle(i)}
                  disabled={phase === 'creating'}
                  className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all disabled:opacity-60"
                  style={{
                    borderColor: selected[i] ? courseColor : 'var(--border-color)',
                    backgroundColor: selected[i] ? `${courseColor}0f` : 'var(--bg-secondary)',
                  }}
                >
                  <span
                    className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      borderColor: selected[i] ? courseColor : 'var(--border-color)',
                      backgroundColor: selected[i] ? courseColor : 'transparent',
                    }}
                  >
                    {selected[i] ? '✓' : ''}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {s.name}
                    </p>
                    {s.description && (
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {s.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === 'review' || phase === 'creating') && (
          <div
            className="flex items-center justify-between gap-3 px-6 py-4 border-t flex-shrink-0"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <button
              onClick={onClose}
              disabled={phase === 'creating'}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              Skip
            </button>
            <button
              onClick={handleCreate}
              disabled={phase === 'creating' || selectedCount === 0}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: courseColor }}
            >
              {phase === 'creating'
                ? `Creating… (${createdCount}/${selectedCount})`
                : `Create ${selectedCount} unit${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
