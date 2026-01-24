import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get folders with note counts
  const { data: folders, error } = await supabase
    .from('folders')
    .select('id, name, color, icon, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }

  // Get note counts per folder
  const { data: noteCounts } = await supabase
    .from('notes')
    .select('folder_id')
    .eq('user_id', user.id);

  const countMap: Record<string, number> = {};
  let unorganizedCount = 0;

  noteCounts?.forEach((note) => {
    if (note.folder_id) {
      countMap[note.folder_id] = (countMap[note.folder_id] || 0) + 1;
    } else {
      unorganizedCount++;
    }
  });

  const foldersWithCounts = folders?.map((folder) => ({
    ...folder,
    noteCount: countMap[folder.id] || 0,
  }));

  return NextResponse.json({
    folders: foldersWithCounts || [],
    unorganizedCount,
    totalNotes: noteCounts?.length || 0,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

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

  const { name, color, icon } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
  }

  const { data: folder, error } = await supabase
    .from('folders')
    .insert({
      user_id: user.id,
      name: name.trim(),
      color: color || '#bf5700',
      icon: icon || null,
    })
    .select('id, name, color, icon, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }

  return NextResponse.json({
    ...folder,
    noteCount: 0,
  });
}
