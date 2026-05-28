import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { gradeAnswerRAG, isFastapiAvailable } from '@/lib/fastapi';

const GEMINI_LITE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

const GRADING_SYSTEM = `You are a concise, fair exam grader. You will be given a question, a model answer, and a student's response.
Return a JSON object with exactly: { "score": number, "feedback": string }
- "score": 0–100 integer representing how complete and accurate the student's answer is
- "feedback": 1–3 sentences. Be specific — cite what was correct, what was missing or wrong, and what the key insight was.
Output ONLY the raw JSON object. No markdown, no code fences.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { question: string; model_answer: string; student_answer: string; course_id?: string; unit_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { question, model_answer, student_answer, course_id, unit_ids } = body;
  if (!question || !model_answer || !student_answer?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Try RAG grader via FastAPI first — produces source citations
  if (course_id) {
    const ragAvailable = await isFastapiAvailable();
    if (ragAvailable) {
      try {
        const ragResult = await gradeAnswerRAG({
          user_id: user.id,
          course_id,
          question,
          model_answer,
          student_answer,
          unit_ids: unit_ids ?? [],
        });
        return NextResponse.json(ragResult);
      } catch {
        // Fall through to plain Gemini grader
      }
    }
  }

  // Fallback: plain Gemini grader (no citations)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const prompt = `Question: ${question}\n\nModel Answer: ${model_answer}\n\nStudent's Answer: ${student_answer}`;

  const res = await fetch(`${GEMINI_LITE}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: GRADING_SYSTEM }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) return NextResponse.json({ error: 'Grading call failed' }, { status: 500 });

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let result: { score: number; feedback: string };
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    result = JSON.parse(cleaned);
    if (typeof result.score !== 'number' || typeof result.feedback !== 'string') throw new Error();
  } catch {
    return NextResponse.json({ error: 'Malformed grading response. Try again.' }, { status: 500 });
  }

  return NextResponse.json(result);
}
