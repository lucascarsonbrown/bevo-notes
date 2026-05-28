import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkLimit, limitErrorResponse } from '@/lib/usage';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, course_code, course_name, semester, year, professor, color, icon, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });

  // Get note + material counts per course
  const [{ data: noteCounts }, { data: materialCounts }] = await Promise.all([
    supabase.from('notes').select('course_id').eq('user_id', user.id).not('course_id', 'is', null),
    supabase.from('materials').select('course_id').eq('user_id', user.id),
  ]);

  const noteMap: Record<string, number> = {};
  noteCounts?.forEach((n) => { if (n.course_id) noteMap[n.course_id] = (noteMap[n.course_id] || 0) + 1; });

  const materialMap: Record<string, number> = {};
  materialCounts?.forEach((m) => { materialMap[m.course_id] = (materialMap[m.course_id] || 0) + 1; });

  return NextResponse.json({
    courses: courses?.map((c) => ({
      ...c,
      noteCount: noteMap[c.id] || 0,
      materialCount: materialMap[c.id] || 0,
    })) ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { course_code?: string; course_name?: string; semester?: string; year?: number; professor?: string; color?: string; icon?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { course_code, course_name, semester, year, professor, color, icon } = body;

  if (!course_code?.trim() || !course_name?.trim()) {
    return NextResponse.json({ error: 'course_code and course_name are required' }, { status: 400 });
  }

  const limitCheck = await checkLimit(supabase, user.id, 'courses');
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: limitErrorResponse('courses', limitCheck.current, limitCheck.limit) },
      { status: 403 }
    );
  }

  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      user_id: user.id,
      course_code: course_code.trim().toUpperCase(),
      course_name: course_name.trim(),
      semester: semester?.trim() || null,
      year: year || null,
      professor: professor?.trim() || null,
      color: color || '#bf5700',
      icon: icon || '📚',
    })
    .select('id, course_code, course_name, semester, year, professor, color, icon, created_at')
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You already have this course for that semester' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 });
  }

  return NextResponse.json({ ...course, noteCount: 0, materialCount: 0 }, { status: 201 });
}
