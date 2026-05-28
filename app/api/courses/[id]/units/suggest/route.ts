import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GEMINI_FLASH = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_INSTRUCTION = `You are a course organization assistant. Given a course syllabus, extract the major units, chapters, or topic sections that the course is divided into.

Rules:
- Return a JSON array of objects with exactly: { "name": string, "description": string }
- "name": short, specific unit title as it appears in the syllabus (e.g. "Unit 1: Pointers and Memory", "Chapter 3: Sorting Algorithms", "Week 4: Neural Networks")
- "description": one sentence summarizing what this unit covers, based strictly on syllabus content
- Return between 3 and 15 units — only the major structural divisions, not every individual lecture or topic bullet
- If the syllabus has no clear unit structure, infer reasonable topic groupings from the lecture schedule or topic list
- Output ONLY the raw JSON array. No markdown, no code fences, no extra text.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify course ownership
  const { data: course } = await supabase
    .from('courses')
    .select('id, course_name')
    .eq('id', courseId)
    .eq('user_id', user.id)
    .single();
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  let body: { material_id: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.material_id) return NextResponse.json({ error: 'material_id required' }, { status: 400 });

  // Fetch the syllabus material
  const { data: material } = await supabase
    .from('materials')
    .select('id, type, content_text, is_processed')
    .eq('id', body.material_id)
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .single();

  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });
  if (material.type !== 'syllabus') return NextResponse.json({ error: 'Material must be a syllabus' }, { status: 400 });
  if (!material.is_processed || !material.content_text) {
    return NextResponse.json({ error: 'Syllabus text extraction is still in progress. Try again in a moment.' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Service not configured' }, { status: 503 });

  const syllabusText = material.content_text.slice(0, 40000);
  const prompt = `Course: ${course.course_name}\n\nSYLLABUS:\n${syllabusText}`;

  const res = await fetch(`${GEMINI_FLASH}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: `Gemini error: ${errText}` }, { status: 500 });
  }

  const data = await res.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });

  let suggestions: { name: string; description: string }[];
  try {
    const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    suggestions = JSON.parse(cleaned);
    if (!Array.isArray(suggestions)) throw new Error('Not an array');
    suggestions = suggestions.filter((s) => s.name && typeof s.name === 'string');
  } catch {
    return NextResponse.json({ error: 'AI returned malformed data. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ suggestions });
}
