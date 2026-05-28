import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch the material first to get the file_path
  const { data: material } = await supabase
    .from('materials')
    .select('id, file_path, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

  // Delete from storage first
  if (material.file_path) {
    const { error: storageError } = await supabase.storage
      .from('materials')
      .remove([material.file_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // Continue anyway — delete the DB record even if storage fails
    }
  }

  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: material } = await supabase
    .from('materials')
    .select('id, file_path, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

  const { data: signedUrl, error } = await supabase.storage
    .from('materials')
    .createSignedUrl(material.file_path, 60 * 60); // 1 hour

  if (error || !signedUrl) return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 });

  return NextResponse.json({ url: signedUrl.signedUrl });
}
