import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

/**
 * Persistence endpoint for lecture notes.
 *
 * Generation happens in the browser via WebLLM (see lib/ai/notes.ts) — this route
 * only deduplicates, validates ownership, and stores the result. It deliberately
 * performs no inference and calls no external service.
 *
 * GET  ?transcript_hash=<sha256>  — pre-flight cache check, so a client never
 *                                   spends minutes generating a note that exists.
 * POST                            — save a client-generated note.
 */

// Storage bound only. The model context limit is handled by chunking client-side,
// so this exists to keep raw_transcript rows from growing without limit.
const MAX_TRANSCRIPT_LENGTH = 200_000;

function hashTranscript(transcript: string): string {
  return createHash('sha256').update(transcript).digest('hex');
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hash = new URL(request.url).searchParams.get('transcript_hash');
  if (!hash) {
    return NextResponse.json({ error: 'transcript_hash is required' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('notes')
    .select('id, title, notes_html, notes_json, created_at')
    .eq('user_id', user.id)
    .eq('transcript_hash', hash)
    .single();

  if (!existing) return NextResponse.json({ cached: false }, { status: 404 });

  return NextResponse.json({ ...existing, cached: true });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title, lecture_date, transcript, lecture_url, notes_html, notes_json } = body;

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return NextResponse.json(
      { error: `Transcript too long. Maximum ${MAX_TRANSCRIPT_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (!notes_html || typeof notes_html !== 'string') {
    return NextResponse.json({ error: 'notes_html is required' }, { status: 400 });
  }

  // Server hashes the transcript itself rather than trusting a client-supplied hash.
  const transcriptHash = hashTranscript(transcript);

  const { data: existingNote } = await supabase
    .from('notes')
    .select('id, title, notes_html, notes_json, created_at')
    .eq('user_id', user.id)
    .eq('transcript_hash', transcriptHash)
    .single();

  if (existingNote) {
    return NextResponse.json({ ...existingNote, cached: true });
  }

  // Fall back to the rendered <h1> when the client didn't supply a title.
  let noteTitle = title;
  if (!noteTitle) {
    const h1Match = notes_html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    noteTitle = h1Match ? h1Match[1].trim() : 'Untitled Lecture';
  }

  const { data: newNote, error: insertError } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: noteTitle,
      lecture_date: lecture_date || null,
      transcript_hash: transcriptHash,
      raw_transcript: transcript,
      notes_html,
      notes_json: notes_json ?? null,
      lecture_url: lecture_url || null,
    })
    .select('id, title, notes_html, notes_json, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }

  return NextResponse.json({ ...newNote, cached: false });
}
