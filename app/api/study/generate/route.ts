import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkLimit, limitErrorResponse } from '@/lib/usage';
import { generateQuizRAG, isFastapiAvailable } from '@/lib/fastapi';

const GEMINI_FLASH = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGemini(prompt: string, systemInstruction: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_FLASH}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

function buildSystemInstruction(format: string): string {
  if (format === 'flashcard') {
    return `You are a study tool generator. Given lecture notes, produce a JSON array of flashcard objects.
Each object must have exactly: { "front": string, "back": string }
- "front": a concise term, concept, or question
- "back": a clear, complete explanation or answer
Output ONLY the raw JSON array. No markdown, no code fences, no extra text.`;
  }
  if (format === 'multiple_choice') {
    return `You are a study tool generator. Given lecture notes, produce a JSON array of multiple choice question objects.
Each object must have exactly: { "question": string, "choices": string[], "answer": string, "explanation": string }
- "choices": exactly 4 options (A, B, C, D format, e.g. "A) The stack pointer")
- "answer": the full correct choice string (matching one of the choices exactly)
- "explanation": why the answer is correct, with reference to the material
Output ONLY the raw JSON array. No markdown, no code fences, no extra text.`;
  }
  // free_response
  return `You are a study tool generator. Given lecture notes, produce a JSON array of free response question objects.
Each object must have exactly: { "question": string, "model_answer": string }
- "question": an open-ended question requiring explanation
- "model_answer": a thorough, detailed model answer based strictly on the provided notes
Output ONLY the raw JSON array. No markdown, no code fences, no extra text.`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { course_id: string; unit_ids: string[]; material_ids?: string[]; format: string; count: number; query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { course_id, unit_ids, material_ids, format, count, query } = body;

  if (!course_id || !format || !count) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!unit_ids?.length && !material_ids?.length) {
    return NextResponse.json({ error: 'Select at least one unit or material.' }, { status: 400 });
  }
  if (!['flashcard', 'multiple_choice', 'free_response'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  const limitCheck = await checkLimit(supabase, user.id, 'quizzes');
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: limitErrorResponse('quizzes', limitCheck.current, limitCheck.limit) },
      { status: 403 }
    );
  }

  const sourceParts: string[] = [];

  // Fetch notes for selected units
  if (unit_ids?.length) {
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, title, notes_html, unit_id, units(name)')
      .eq('user_id', user.id)
      .eq('course_id', course_id)
      .in('unit_id', unit_ids);

    if (notesError) return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });

    if (!notes?.length) {
      return NextResponse.json({ error: 'No notes found in the selected units. Make sure notes are assigned to those units.' }, { status: 400 });
    }

    const notesWithContent = notes.filter((n) => n.notes_html && n.notes_html.replace(/<[^>]*>/g, '').trim().length > 0);
    if (!notesWithContent.length) {
      return NextResponse.json({ error: 'The notes in the selected units have no content yet. Add content to your notes first.' }, { status: 400 });
    }

    const notesText = notesWithContent.map((n) => {
      const unitName = (n.units as unknown as { name: string } | null)?.name || 'Unknown Unit';
      const text = (n.notes_html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return `=== ${n.title} (${unitName}) ===\n${text}`;
    }).join('\n\n');
    sourceParts.push(notesText);
  }

  // Fetch materials content
  if (material_ids?.length) {
    const { data: materials, error: materialsError } = await supabase
      .from('materials')
      .select('id, title, type, content_text')
      .eq('user_id', user.id)
      .in('id', material_ids);

    if (!materialsError && materials?.length) {
      const materialsText = materials
        .filter((m) => m.content_text)
        .map((m) => `=== ${m.title} (${m.type}) ===\n${m.content_text}`)
        .join('\n\n');
      if (materialsText) sourceParts.push(materialsText);
    }
  }

  // ── Try RAG pipeline via FastAPI (ChromaDB + LangGraph) ───────────────────
  let questions: unknown[];
  const ragAvailable = await isFastapiAvailable();

  if (ragAvailable) {
    try {
      const ragResult = await generateQuizRAG({
        user_id: user.id,
        course_id,
        query: query || `Generate ${format} questions`,
        format: format as 'flashcard' | 'multiple_choice' | 'free_response',
        count,
        unit_ids: unit_ids ?? [],
        material_ids: material_ids ?? [],
        mode: 'standard',
      });
      questions = ragResult.questions;
    } catch {
      // FastAPI returned an error (e.g. no indexed content yet) — fall through to plain Gemini
      questions = [];
    }
  } else {
    questions = [];
  }

  // ── Fallback: plain Gemini with raw text if RAG produced nothing ───────────
  if (!questions.length) {
    if (!sourceParts.length) {
      return NextResponse.json({ error: 'No content found. Selected materials have no extracted text yet.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
    }

    const trimmedSource = sourceParts.join('\n\n').slice(0, 60000);
    const systemInstruction = buildSystemInstruction(format);
    const focusClause = query ? `\nFocus especially on: "${query}"` : '';
    const prompt = `Generate exactly ${count} ${format.replace('_', ' ')} items based on the following lecture notes.${focusClause}\n\nLECTURE NOTES:\n${trimmedSource}`;

    let rawJson: string;
    try {
      rawJson = await callGemini(prompt, systemInstruction, apiKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: `Generation failed: ${msg}` }, { status: 500 });
    }

    try {
      const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      questions = JSON.parse(cleaned);
      if (!Array.isArray(questions)) throw new Error('Not an array');
    } catch {
      return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 500 });
    }
  }

  // Save to quizzes table
  const { data: saved, error: saveError } = await supabase
    .from('quizzes')
    .insert({
      user_id: user.id,
      course_id,
      unit_id: unit_ids.length === 1 ? unit_ids[0] : null,
      query: query || null,
      format,
      mode: 'standard',
      questions,
    })
    .select('id')
    .single();

  if (saveError || !saved) {
    return NextResponse.json({ error: 'Failed to save study tool' }, { status: 500 });
  }

  return NextResponse.json({ id: saved.id, format, questions });
}
