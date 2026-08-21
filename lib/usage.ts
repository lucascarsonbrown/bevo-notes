import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Usage counts, for display only.
 *
 * Inference runs in the user's browser via WebLLM, so there is no per-call cost
 * to defend and nothing here gates access. These numbers exist purely so the
 * dashboard can show a user how much they've made.
 */

export interface UsageCounts {
  courses: number;
  notes: number;
  quizzes: number;
}

export async function getUsageCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageCounts> {
  const [courses, notes, quizzes] = await Promise.all([
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  return {
    courses: courses.count ?? 0,
    notes: notes.count ?? 0,
    quizzes: quizzes.count ?? 0,
  };
}
