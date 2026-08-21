import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Persistence endpoint for study tools.
 *
 * Generation happens in the browser via WebLLM (see lib/ai/quiz.ts) — this route
 * only validates ownership and stores the result. It deliberately performs no
 * inference and calls no external service.
 */

const FORMATS = ['flashcard', 'multiple_choice', 'free_response'] as const;
type Format = (typeof FORMATS)[number];

interface SaveStudyToolBody {
  course_id: string;
  unit_ids?: string[];
  format: Format;
  query?: string | null;
  questions: unknown[];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: SaveStudyToolBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { course_id, unit_ids, format, query, questions } = body;

  if (!course_id) {
    return NextResponse.json({ error: 'course_id is required' }, { status: 400 });
  }
  if (!FORMATS.includes(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'questions must be a non-empty array' }, { status: 400 });
  }

  // Verify the course belongs to this user before writing anything against it.
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('id', course_id)
    .eq('user_id', user.id)
    .single();

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const { data: saved, error: saveError } = await supabase
    .from('quizzes')
    .insert({
      user_id: user.id,
      course_id,
      unit_id: unit_ids?.length === 1 ? unit_ids[0] : null,
      query: query || null,
      format,
      mode: 'standard',
      questions,
    })
    .select('id')
    .single();

  if (saveError || !saved) {
    return NextResponse.json({ error: 'Failed to save study tool' }, { status: 500 });
  }

  return NextResponse.json({ id: saved.id, format, questions });
}
