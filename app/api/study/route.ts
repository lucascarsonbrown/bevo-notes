import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('course_id');
  if (!courseId) return NextResponse.json({ error: 'course_id required' }, { status: 400 });

  const { data: tools, error } = await supabase
    .from('quizzes')
    .select('id, query, format, mode, unit_id, questions, created_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch study tools' }, { status: 500 });

  return NextResponse.json({ tools: tools || [] });
}
