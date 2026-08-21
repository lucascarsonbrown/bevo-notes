import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const courseId = request.nextUrl.searchParams.get('course_id');
  if (!courseId) return NextResponse.json({ error: 'course_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('materials')
    .select('id, title, type, file_path, file_size_bytes, is_processed, created_at, unit_id')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ materials: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { course_id, unit_id, type, title, file_path, file_size_bytes } = body;

  if (!course_id || !type || !title || !file_path) {
    return NextResponse.json({ error: 'course_id, type, title, and file_path are required' }, { status: 400 });
  }

  const validTypes = ['syllabus', 'textbook', 'custom_notes'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  // Verify the course belongs to this user
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('id', course_id)
    .eq('user_id', user.id)
    .single();

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('materials')
    .insert({
      user_id: user.id,
      course_id,
      unit_id: unit_id || null,
      type,
      title,
      file_path,
      file_size_bytes: file_size_bytes || null,
      is_processed: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
