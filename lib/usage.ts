import { SupabaseClient } from '@supabase/supabase-js';

export type SubscriptionTier = 'free' | 'pro';

export const FREE_LIMITS = {
  courses: 1,
  notes: 6,
  quizzes: 5,
  syllabus: 1,
  textbook: 0,
} as const;

// Monthly soft cap for Pro tier
export const PRO_MONTHLY_LIMITS = {
  quizzes: 100,
} as const;

export type LimitKey = keyof typeof FREE_LIMITS;

export interface UsageCounts {
  courses: number;
  notes: number;
  quizzes: number;
  syllabus: number;
  textbook: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  tier: SubscriptionTier;
}

export async function getUserTier(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionTier> {
  const { data } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .single();
  return (data?.subscription_tier as SubscriptionTier) ?? 'free';
}

export async function checkLimit(
  supabase: SupabaseClient,
  userId: string,
  resource: LimitKey
): Promise<LimitCheckResult> {
  const tier = await getUserTier(supabase, userId);

  // Pro: unlimited everything except monthly quiz soft cap
  if (tier === 'pro') {
    if (resource === 'quizzes') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('quizzes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString());
      const current = count ?? 0;
      const limit = PRO_MONTHLY_LIMITS.quizzes;
      return { allowed: current < limit, current, limit, tier };
    }
    return { allowed: true, current: 0, limit: Infinity, tier };
  }

  // Free: lifetime limits
  const limit = FREE_LIMITS[resource];
  let current = 0;

  if (resource === 'courses') {
    const { count } = await supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    current = count ?? 0;
  } else if (resource === 'notes') {
    const { count } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    current = count ?? 0;
  } else if (resource === 'quizzes') {
    const { count } = await supabase
      .from('quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    current = count ?? 0;
  } else if (resource === 'syllabus') {
    const { count } = await supabase
      .from('materials')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'syllabus');
    current = count ?? 0;
  } else if (resource === 'textbook') {
    const { count } = await supabase
      .from('materials')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'textbook');
    current = count ?? 0;
  }

  return { allowed: current < limit, current, limit, tier };
}

export async function getUsageCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageCounts> {
  const [courses, notes, quizzes, syllabus, textbook] = await Promise.all([
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('materials').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'syllabus'),
    supabase.from('materials').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'textbook'),
  ]);

  return {
    courses: courses.count ?? 0,
    notes: notes.count ?? 0,
    quizzes: quizzes.count ?? 0,
    syllabus: syllabus.count ?? 0,
    textbook: textbook.count ?? 0,
  };
}

export function limitErrorResponse(resource: LimitKey, current: number, limit: number, tier: SubscriptionTier = 'free') {
  const labels: Record<LimitKey, string> = {
    courses: 'course',
    notes: 'AI-generated note',
    quizzes: 'quiz',
    syllabus: 'syllabus upload',
    textbook: 'textbook upload',
  };
  const label = labels[resource];
  if (limit === 0) {
    return `Free plan does not include ${label}s. Upgrade to Pro to unlock.`;
  }
  if (tier === 'pro') {
    return `Monthly limit reached: ${current}/${limit} ${label}s used this month. Resets on the 1st.`;
  }
  return `Free plan limit reached: ${current}/${limit} ${label}${limit === 1 ? '' : 's'} used. Upgrade to Pro to continue.`;
}
