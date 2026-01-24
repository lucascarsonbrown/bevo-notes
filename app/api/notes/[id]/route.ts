import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: note, error } = await supabase
    .from('notes')
    .select(
      `
      id,
      title,
      lecture_date,
      notes_html,
      raw_transcript,
      lecture_url,
      created_at,
      updated_at,
      folder_id,
      folders (
        id,
        name,
        color,
        icon
      )
    `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: note.id,
    title: note.title,
    lecture_date: note.lecture_date,
    notes_html: note.notes_html,
    raw_transcript: note.raw_transcript,
    lecture_url: note.lecture_url,
    created_at: note.created_at,
    updated_at: note.updated_at,
    folder_id: note.folder_id,
    folder: note.folders,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title, folder_id, lecture_date } = body;

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (folder_id !== undefined) updates.folder_id = folder_id;
  if (lecture_date !== undefined) updates.lecture_date = lecture_date;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: note, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(
      `
      id,
      title,
      lecture_date,
      notes_html,
      created_at,
      updated_at,
      folder_id,
      folders (
        id,
        name,
        color,
        icon
      )
    `
    )
    .single();

  if (error || !note) {
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }

  return NextResponse.json({
    id: note.id,
    title: note.title,
    lecture_date: note.lecture_date,
    notes_html: note.notes_html,
    created_at: note.created_at,
    updated_at: note.updated_at,
    folder_id: note.folder_id,
    folder: note.folders,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
