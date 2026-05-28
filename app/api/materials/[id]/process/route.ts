import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GEMINI_UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEMINI_GENERATE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function uploadFileToGemini(
  fileBytes: ArrayBuffer,
  mimeType: string,
  displayName: string,
  apiKey: string
): Promise<string> {
  const res = await fetch(`${GEMINI_UPLOAD_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'start, upload, finalize',
      'X-Goog-Upload-Header-Content-Length': String(fileBytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });

  // The resumable upload: start phase returns upload URL, but the single-request
  // approach requires multipart. Use the simpler multipart upload instead.
  if (!res.ok) throw new Error(`Gemini file upload failed: ${await res.text()}`);
  const data = await res.json();
  const fileUri = data?.file?.uri;
  if (!fileUri) throw new Error('No file URI returned from Gemini upload');
  return fileUri;
}

async function uploadFileMultipart(
  fileBytes: ArrayBuffer,
  mimeType: string,
  displayName: string,
  apiKey: string
): Promise<string> {
  const boundary = '----BevoNotesBoundary' + Date.now();
  const metadata = JSON.stringify({ file: { display_name: displayName } });

  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metadata}\r\n`;
  const filePart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const metaBytes = new TextEncoder().encode(metaPart);
  const filePartBytes = new TextEncoder().encode(filePart);
  const closingBytes = new TextEncoder().encode(closing);

  const body = new Uint8Array(
    metaBytes.byteLength + filePartBytes.byteLength + fileBytes.byteLength + closingBytes.byteLength
  );
  body.set(metaBytes, 0);
  body.set(filePartBytes, metaBytes.byteLength);
  body.set(new Uint8Array(fileBytes), metaBytes.byteLength + filePartBytes.byteLength);
  body.set(closingBytes, metaBytes.byteLength + filePartBytes.byteLength + fileBytes.byteLength);

  const res = await fetch(`${GEMINI_UPLOAD_URL}?uploadType=multipart&key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: body,
  });

  if (!res.ok) throw new Error(`Gemini file upload failed: ${await res.text()}`);
  const data = await res.json();
  const fileUri = data?.file?.uri;
  if (!fileUri) throw new Error('No file URI returned from Gemini upload');
  return fileUri;
}

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'txt': return 'text/plain';
    case 'md': return 'text/markdown';
    default: return 'application/octet-stream';
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch material
  const { data: material } = await supabase
    .from('materials')
    .select('id, title, file_path, is_processed, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  // Download file from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('materials')
    .download(material.file_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 });
  }

  const fileBytes = await fileData.arrayBuffer();
  const mimeType = getMimeType(material.file_path);

  // For plain text files, skip Gemini upload and extract directly
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    const text = new TextDecoder().decode(fileBytes).trim();
    const { error: updateError } = await supabase
      .from('materials')
      .update({ content_text: text, is_processed: true })
      .eq('id', id);

    if (updateError) return NextResponse.json({ error: 'Failed to save extracted text' }, { status: 500 });
    return NextResponse.json({ success: true, chars: text.length });
  }

  // Upload to Gemini File API
  let fileUri: string;
  try {
    fileUri = await uploadFileMultipart(fileBytes, mimeType, material.title, apiKey);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'File upload failed' }, { status: 500 });
  }

  // Ask Gemini to extract all text content
  const extractRes = await fetch(`${GEMINI_GENERATE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: 'Extract all text content from the provided file. Preserve the structure and meaning. Output only the extracted text — no commentary, no markdown formatting, no preamble.' }],
      },
      contents: [{
        parts: [
          { file_data: { mime_type: mimeType, file_uri: fileUri } },
          { text: 'Extract all text from this file.' },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 16384 },
    }),
  });

  if (!extractRes.ok) {
    const errText = await extractRes.text();
    return NextResponse.json({ error: `Gemini extraction failed: ${errText}` }, { status: 500 });
  }

  const extractData = await extractRes.json();
  const extractedText = extractData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!extractedText) {
    return NextResponse.json({ error: 'Gemini returned no text. The file may be unsupported or empty.' }, { status: 500 });
  }

  // Save extracted text and mark as processed
  const { error: updateError } = await supabase
    .from('materials')
    .update({ content_text: extractedText.trim(), is_processed: true })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: 'Failed to save extracted text' }, { status: 500 });

  return NextResponse.json({ success: true, chars: extractedText.length });
}
