import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/utils/encryption';
import { createHash } from 'crypto';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
const MAX_TRANSCRIPT_LENGTH = 50000;

function hashTranscript(transcript: string): string {
  return createHash('sha256').update(transcript).digest('hex');
}

const SYSTEM_INSTRUCTION = `You are turning a raw university lecture transcript into written lecture notes, as if the professor had typed the lecture out cleanly for students.

Your goal is to preserve the lecture content and level of detail, while making it organized, readable, and mathematically precise.

Follow these rules carefully:

1. Overall goal
   - Rewrite the lecture as structured lecture notes "on paper."
   - Preserve essentially all substantive content.
   - Do NOT significantly shorten the lecture.

2. What to keep vs remove
   - REMOVE: jokes, filler, classroom chatter, technical issues.
   - KEEP: all mathematical content, examples, reasoning, and any important logistics that affect the student (exams, assignments, grading).
   - Condense repetition, but do not omit important reasoning.

3. Structure (topic-based)
   - Break the lecture into sections based on topic transitions.
   - Output HTML with:
     - One <h1> lecture title (infer from content if needed).
     - Multiple <h2> sections, each covering one major topic.
     - Use <p> for prose and <ul><li> for structured explanations.

4. Definitions, theorems, and formulas
   - Rewrite definitions and theorems cleanly and precisely.
   - All mathematical expressions MUST be written using MathML (built-in HTML math).
   - For simple expressions, you can use Unicode symbols directly (×, ÷, ≤, ≥, ≠, ∞, etc.).
   - For complex expressions, use MathML tags wrapped in <math> elements.
   - Example: T(n) = 2<sup>n</sup> - 1 (using <sup> for exponents)
   - Example: <math><mfrac><mn>1</mn><mn>2</mn></mfrac></math> for fractions
   - Ensure all math is mathematically equivalent to the lecture.

5. Proofs and reasoning
   - When a proof or reasoning is presented:
     - First give an informal explanation describing the intuition.
     - Then give a formal, structured version using clear steps.
   - Remain faithful to the lecture content.

6. Examples
   - Rewrite all examples from the lecture.
   - Add clarifying steps so the logic is clear in written form.
   - Do not invent new problems.

7. Tone and style
   - Sound like professor-written lecture notes.
   - Clear, precise, and professional.
   - No study tips or meta commentary.
   - No need for any practice problems unless given in the lecture.

8. Output format
   - Output valid HTML only.
   - Use MathML, HTML superscripts/subscripts, and Unicode symbols for all math.
   - Use only <h1>, <h2>, <p>, <ul><li>, <sup>, <sub>, and <math> for structure.`;

async function generateWithGemini(transcript: string, apiKey: string): Promise<string> {
  const userPrompt = `Apply the rules to the following transcript:

[BEGIN TRANSCRIPT]
${transcript}
[END TRANSCRIPT]`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error: ${text}`);
  }

  const data = await response.json();

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Unexpected Gemini API response format');
  }

  let content = data.candidates[0].content.parts[0].text;

  // Remove markdown code fences if present
  content = content.replace(/^```html\s*/i, '').replace(/\s*```$/, '');

  // Extract tokens used if available
  const tokensUsed = data.usageMetadata?.totalTokenCount || null;

  return content;
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

  const { title, lecture_date, transcript, lecture_url } = body;

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
  }

  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return NextResponse.json(
      { error: `Transcript too long. Maximum ${MAX_TRANSCRIPT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // Hash transcript for deduplication
  const transcriptHash = hashTranscript(transcript);

  // Check for existing note with same hash
  const { data: existingNote } = await supabase
    .from('notes')
    .select('id, title, notes_html, created_at')
    .eq('user_id', user.id)
    .eq('transcript_hash', transcriptHash)
    .single();

  if (existingNote) {
    return NextResponse.json({
      id: existingNote.id,
      title: existingNote.title,
      notes_html: existingNote.notes_html,
      created_at: existingNote.created_at,
      cached: true,
    });
  }

  // Get user's API key
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('gemini_api_key_encrypted')
    .eq('id', user.id)
    .single();

  if (userError || !userData?.gemini_api_key_encrypted) {
    return NextResponse.json(
      { error: 'No API key configured. Please add your Gemini API key in Settings.' },
      { status: 400 }
    );
  }

  let apiKey: string;
  try {
    apiKey = decrypt(userData.gemini_api_key_encrypted);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 });
  }

  // Generate notes with Gemini
  let notesHtml: string;
  try {
    notesHtml = await generateWithGemini(transcript, apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Mark API key as invalid if it's an auth error
    if (message.includes('API_KEY_INVALID') || message.includes('401')) {
      await supabase
        .from('users')
        .update({ api_key_is_valid: false })
        .eq('id', user.id);
    }

    return NextResponse.json({ error: `Failed to generate notes: ${message}` }, { status: 500 });
  }

  // Infer title from generated HTML if not provided
  let noteTitle = title;
  if (!noteTitle) {
    const h1Match = notesHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    noteTitle = h1Match ? h1Match[1].trim() : 'Untitled Lecture';
  }

  // Store note in database
  const { data: newNote, error: insertError } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: noteTitle,
      lecture_date: lecture_date || null,
      transcript_hash: transcriptHash,
      raw_transcript: transcript,
      notes_html: notesHtml,
      lecture_url: lecture_url || null,
    })
    .select('id, title, notes_html, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }

  return NextResponse.json({
    id: newNote.id,
    title: newNote.title,
    notes_html: newNote.notes_html,
    created_at: newNote.created_at,
    cached: false,
  });
}
