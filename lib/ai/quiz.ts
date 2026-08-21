import { getEngine, generateJSON } from './engine';
import { QUIZ_SCHEMAS, GRADE_SCHEMA } from './schema';
import { retrieveContext } from './rag';
import type { Capability } from './capability';

/**
 * Browser-side study tool generation and grading.
 *
 * Retrieval comes from the local IndexedDB index when it has content for the
 * selection; otherwise the caller's raw note text is used directly.
 */

export type QuizFormat = 'flashcard' | 'multiple_choice' | 'free_response';

export interface Flashcard { front: string; back: string }
export interface MCQQuestion { question: string; choices: string[]; answer: string; explanation: string }
export interface FRQuestion { question: string; model_answer: string }
export type QuizQuestion = Flashcard | MCQQuestion | FRQuestion;

function systemFor(format: QuizFormat, count: number): string {
  const shared = `Use only the provided lecture content. Do not invent material. Produce exactly ${count} items in the "items" array.`;
  switch (format) {
    case 'flashcard':
      return `You write study flashcards. "front" is a concise term or question; "back" is a clear, complete answer. ${shared}`;
    case 'multiple_choice':
      return `You write multiple choice questions. "choices" must contain exactly 4 options. "answer" must exactly match one entry of "choices". "explanation" says why it is correct. ${shared}`;
    case 'free_response':
      return `You write open-ended exam questions. "question" requires an explanation; "model_answer" is a thorough answer drawn strictly from the content. ${shared}`;
  }
}

export interface GenerateQuizOptions {
  capability: Capability;
  format: QuizFormat;
  count: number;
  courseId: string;
  unitIds?: string[];
  noteIds?: string[];
  /** Optional user focus, also used as the retrieval query. */
  query?: string;
  /** Raw note text, used when the local index has nothing for this selection. */
  fallbackText: string;
  onProgress?: (message: string) => void;
}

export async function generateQuiz(
  opts: GenerateQuizOptions
): Promise<{ questions: QuizQuestion[]; chunksUsed: number }> {
  const { capability, format, count, courseId, unitIds, noteIds, query, fallbackText } = opts;

  if (capability.mode === 'readonly' || !capability.model) {
    throw new Error('This device cannot generate study tools.');
  }

  const retrievalQuery = query?.trim() || `key concepts for ${format.replace('_', ' ')} practice`;

  // Semantic retrieval only when an embedding model was loadable on this device.
  let context = '';
  let chunksUsed = 0;
  if (capability.embeddingModel) {
    opts.onProgress?.('Finding relevant material…');
    const retrieved = await retrieveContext(retrievalQuery, { courseId, unitIds, noteIds });
    context = retrieved.text;
    chunksUsed = retrieved.chunksUsed;
  }

  if (!context) context = fallbackText.slice(0, 6000);
  if (!context.trim()) throw new Error('No lecture content available to generate from.');

  opts.onProgress?.('Writing questions…');
  const engine = await getEngine(capability.model);

  const focus = query?.trim() ? `\n\nFocus especially on: ${query.trim()}` : '';
  const result = await generateJSON<{ items: QuizQuestion[] }>(engine, {
    system: systemFor(format, count),
    user: `LECTURE CONTENT:\n${context}${focus}`,
    schema: QUIZ_SCHEMAS[format],
    maxTokens: 1500,
    temperature: 0.5,
  });

  const questions = (result.items ?? []).slice(0, count);
  if (!questions.length) throw new Error('The model produced no questions. Try again.');

  return { questions, chunksUsed };
}

export interface GradeResult {
  score: number;
  feedback: string;
}

export async function gradeAnswer(opts: {
  capability: Capability;
  question: string;
  modelAnswer: string;
  studentAnswer: string;
}): Promise<GradeResult> {
  const { capability, question, modelAnswer, studentAnswer } = opts;

  if (capability.mode === 'readonly' || !capability.model) {
    throw new Error('This device cannot grade answers.');
  }

  const engine = await getEngine(capability.model);

  const result = await generateJSON<GradeResult>(engine, {
    system: `You are a fair exam grader. "score" is 0-100 for how complete and accurate the student's answer is. "feedback" is 1-3 specific sentences naming what was correct and what was missing.`,
    user: `Question: ${question}\n\nModel answer: ${modelAnswer}\n\nStudent's answer: ${studentAnswer}`,
    schema: GRADE_SCHEMA,
    maxTokens: 300,
    temperature: 0.2,
  });

  return {
    score: Math.max(0, Math.min(100, Math.round(result.score ?? 0))),
    feedback: result.feedback ?? '',
  };
}
