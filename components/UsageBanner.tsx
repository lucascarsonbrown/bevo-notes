'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FREE_LIMITS, UsageCounts, SubscriptionTier } from '@/lib/usage';

interface UsageData {
  tier: SubscriptionTier;
  counts: UsageCounts;
  limits: typeof FREE_LIMITS;
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max === 0 ? 100 : Math.min((used / max) * 100, 100);
  const atLimit = used >= max;
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
      <span className="whitespace-nowrap">{label}</span>
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: atLimit ? '#ef4444' : 'var(--accent-primary)' }}
        />
      </div>
      <span className={atLimit ? 'font-semibold' : ''} style={{ color: atLimit ? '#ef4444' : undefined }}>
        {max === 0 ? 'locked' : `${used}/${max}`}
      </span>
    </div>
  );
}

export default function UsageBanner() {
  const router = useRouter();
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch('/api/usage')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setUsage(d))
      .catch(() => {});
  }, []);

  if (!usage) return null;
  if (usage.tier !== 'free') return null;

  const { counts, limits } = usage;
  const atAnyLimit =
    counts.courses >= limits.courses ||
    counts.notes >= limits.notes ||
    counts.quizzes >= limits.quizzes ||
    counts.syllabus >= limits.syllabus;

  return (
    <div
      className="h-10 border-b flex items-center justify-between px-6 gap-6"
      style={{
        background: 'linear-gradient(90deg, var(--accent-light) 0%, transparent 100%)',
        borderColor: 'rgba(191, 87, 0, 0.2)',
      }}
    >
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Free tier
        </span>
        <UsageBar label="Courses" used={counts.courses} max={limits.courses} />
        <UsageBar label="Notes" used={counts.notes} max={limits.notes} />
        <UsageBar label="Quizzes" used={counts.quizzes} max={limits.quizzes} />
        <UsageBar label="Syllabus" used={counts.syllabus} max={limits.syllabus} />
        <UsageBar label="Textbook" used={counts.textbook} max={limits.textbook} />
      </div>
      {atAnyLimit && (
        <button
          className="px-3 py-1 rounded-md text-xs font-semibold text-white shrink-0 transition-all"
          style={{ backgroundColor: 'var(--accent-primary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
          onClick={() => router.push('/pricing')}
        >
          Upgrade →
        </button>
      )}
    </div>
  );
}
