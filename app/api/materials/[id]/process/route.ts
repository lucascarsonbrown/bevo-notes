import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Extract text from an uploaded material.
 *
 * Plain-text formats are decoded directly — no inference involved. PDF and image
 * extraction previously relied on Gemini's vision API; with external LLM APIs
 * removed and WebLLM being text-only, those formats are unsupported for now.
 */

const SUPPORTED_EXTENSIONS = ['txt', 'md'] as const;

function getExtension(filePath: string): string {
  return filePath.split('.').pop()?.toLowerCase() ?? '';
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: material } = await supabase
    .from('materials')
    .select('id, title, file_path, is_processed, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

  const ext = getExtension(material.file_path);
  if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
    return NextResponse.json(
      {
        error:
          'Only .txt and .md files can be processed right now. PDF and image extraction is not supported yet.',
      },
      { status: 415 }
    );
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('materials')
    .download(material.file_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 });
  }

  const text = new TextDecoder().decode(await fileData.arrayBuffer()).trim();

  if (!text) {
    return NextResponse.json({ error: 'File is empty.' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('materials')
    .update({ content_text: text, is_processed: true })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to save extracted text' }, { status: 500 });
  }

  return NextResponse.json({ success: true, chars: text.length });
}
