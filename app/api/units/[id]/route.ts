import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: unit, error } = await supabase
    .from('units')
    .select(`
      id, name, description, position, created_at,
      course_id,
      notes (id, title, lecture_date, created_at, preview)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  return NextResponse.json(unit);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: string; description?: string; position?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.name) updates.name = body.name.trim();
  if ('description' in body) updates.description = body.description?.trim() || null;
  if ('position' in body) updates.position = body.position;

  const { data: unit, error } = await supabase
    .from('units')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, name, description, position, created_at')
    .single();

  if (error || !unit) return NextResponse.json({ error: 'Unit not found or update failed' }, { status: 404 });
  return NextResponse.json(unit);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase.from('units').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
