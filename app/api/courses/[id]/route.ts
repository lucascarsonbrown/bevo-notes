import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: course, error } = await supabase
    .from('courses')
    .select(`
      id, course_code, course_name, semester, year, professor, color, icon, created_at,
      units (id, name, description, position, created_at)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  // Sort units by position
  const units = (course.units as { id: string; name: string; description: string | null; position: number; created_at: string }[] | null)
    ?.sort((a, b) => a.position - b.position) ?? [];

  return NextResponse.json({ ...course, units });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { course_code?: string; course_name?: string; semester?: string; year?: number; professor?: string; color?: string; icon?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.course_code) updates.course_code = body.course_code.trim().toUpperCase();
  if (body.course_name) updates.course_name = body.course_name.trim();
  if ('semester' in body) updates.semester = body.semester?.trim() || null;
  if ('year' in body) updates.year = body.year || null;
  if ('professor' in body) updates.professor = body.professor?.trim() || null;
  if (body.color) updates.color = body.color;
  if (body.icon) updates.icon = body.icon;

  const { data: course, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, course_code, course_name, semester, year, professor, color, icon, created_at')
    .single();

  if (error || !course) return NextResponse.json({ error: 'Course not found or update failed' }, { status: 404 });
  return NextResponse.json(course);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase.from('courses').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
