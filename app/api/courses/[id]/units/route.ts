import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify user owns the course
  const { data: course } = await supabase.from('courses').select('id').eq('id', courseId).eq('user_id', user.id).single();
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const { data: units, error } = await supabase
    .from('units')
    .select('id, name, description, position, created_at')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .order('position', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });

  // Get note counts per unit
  const { data: noteCounts } = await supabase
    .from('notes')
    .select('unit_id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .not('unit_id', 'is', null);

  const countMap: Record<string, number> = {};
  noteCounts?.forEach((n) => { if (n.unit_id) countMap[n.unit_id] = (countMap[n.unit_id] || 0) + 1; });

  return NextResponse.json({
    units: units?.map((u) => ({ ...u, noteCount: countMap[u.id] || 0 })) ?? [],
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify user owns the course
  const { data: course } = await supabase.from('courses').select('id').eq('id', courseId).eq('user_id', user.id).single();
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  let body: { name?: string; description?: string; position?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.name?.trim()) return NextResponse.json({ error: 'Unit name is required' }, { status: 400 });

  // Get the next position if not specified
  let position = body.position;
  if (position === undefined) {
    const { count } = await supabase.from('units').select('id', { count: 'exact', head: true }).eq('course_id', courseId);
    position = count ?? 0;
  }

  const { data: unit, error } = await supabase
    .from('units')
    .insert({
      course_id: courseId,
      user_id: user.id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      position,
    })
    .select('id, name, description, position, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 });
  return NextResponse.json({ ...unit, noteCount: 0 }, { status: 201 });
}
