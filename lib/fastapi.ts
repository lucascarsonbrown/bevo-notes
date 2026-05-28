/**
 * Typed client for the Python FastAPI service.
 * Falls back gracefully when the service is unavailable (e.g. not yet deployed).
 */

const FASTAPI_URL = process.env.FASTAPI_URL ?? 'http://localhost:8000';
const SERVICE_SECRET = process.env.SERVICE_SECRET ?? '';

async function fastapiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${FASTAPI_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-service-secret': SERVICE_SECRET,
    },
    body: JSON.stringify(body),
    // 90s timeout — quiz generation can be slow for large corpora
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FastAPI ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export interface QuizGenerateRequest {
  user_id: string;
  course_id: string;
  query: string;
  format: 'flashcard' | 'multiple_choice' | 'free_response';
  count: number;
  unit_ids?: string[];
  material_ids?: string[];
  mode?: 'standard' | 'unit_test' | 'exam_prep';
}

export interface QuizGenerateResponse {
  questions: unknown[];
  intent: string;
  chunks_used: number;
}

export async function generateQuizRAG(req: QuizGenerateRequest): Promise<QuizGenerateResponse> {
  return fastapiPost<QuizGenerateResponse>('/quiz/generate', req);
}

export interface GradeRequest {
  user_id: string;
  course_id: string;
  question: string;
  model_answer: string;
  student_answer: string;
  unit_ids?: string[];
}

export interface GradeResponse {
  score: number;
  feedback: string;
  citations?: string[];
}

export async function gradeAnswerRAG(req: GradeRequest): Promise<GradeResponse> {
  return fastapiPost<GradeResponse>('/quiz/grade', req);
}

export interface IngestTextRequest {
  user_id: string;
  course_id: string;
  material_id: string;
  material_type: string;
  unit_id?: string | null;
  title: string;
  text: string;
}

export async function ingestText(req: IngestTextRequest): Promise<{ chunks_added: number }> {
  return fastapiPost('/ingest/text', req);
}

export interface IngestPdfRequest {
  user_id: string;
  course_id: string;
  material_id: string;
  material_type: string;
  unit_id?: string | null;
  title: string;
  pdf_url: string;
}

export async function ingestPdf(req: IngestPdfRequest): Promise<{ chunks_added: number; text_chars: number }> {
  return fastapiPost('/ingest/pdf', req);
}

export async function isFastapiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${FASTAPI_URL}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
