import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folder_id');
  const courseId = searchParams.get('course_id');
  const unitId = searchParams.get('unit_id');
  const search = searchParams.get('search');
  // Opt-in: study-tool generation runs in the browser and needs the full note
  // text, not a preview. Off by default so list views stay cheap.
  const includeContent = searchParams.get('include_content') === '1';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = supabase
    .from('notes')
    .select(
      `
      id,
      title,
      lecture_date,
      notes_html,
      created_at,
      updated_at,
      folder_id,
      course_id,
      unit_id,
      folders (id, name, color, icon),
      courses (id, course_code, course_name, color, icon),
      units (id, name)
    `,
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter by folder (legacy)
  if (folderId === 'null' || folderId === 'unorganized') {
    query = query.is('folder_id', null);
  } else if (folderId) {
    query = query.eq('folder_id', folderId);
  }

  // Filter by course or unit
  if (unitId) {
    query = query.eq('unit_id', unitId);
  } else if (courseId) {
    query = query.eq('course_id', courseId);
  }

  // Search by title
  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  const { data: notes, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }

  const transformedNotes = notes?.map((note) => ({
    id: note.id,
    title: note.title,
    lecture_date: note.lecture_date,
    preview: note.notes_html ? note.notes_html.replace(/<[^>]*>/g, '').slice(0, 200) : '',
    ...(includeContent ? { notes_html: note.notes_html } : {}),
    created_at: note.created_at,
    updated_at: note.updated_at,
    folder_id: note.folder_id,
    course_id: note.course_id,
    unit_id: note.unit_id,
    folder: note.folders,
    course: note.courses,
    unit: note.units,
  }));

  return NextResponse.json({
    notes: transformedNotes || [],
    total: count || 0,
  });
}
