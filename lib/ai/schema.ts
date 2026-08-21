/**
 * JSON schemas for constrained decoding.
 *
 * Deliberately flat. Deeply nested schemas raise the failure rate of constrained
 * decoding on small models, so a pass returns a flat list of sections and the
 * merge step assembles the document.
 */

export const CHUNK_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          summary: { type: 'string' },
          definitions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                term: { type: 'string' },
                meaning: { type: 'string' },
              },
              required: ['term', 'meaning'],
            },
          },
          formulas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                latex: { type: 'string' },
                explanation: { type: 'string' },
              },
              required: ['latex', 'explanation'],
            },
          },
          examples: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                problem: { type: 'string' },
                steps: { type: 'array', items: { type: 'string' } },
              },
              required: ['problem', 'steps'],
            },
          },
          key_points: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'heading',
          'summary',
          'definitions',
          'formulas',
          'examples',
          'key_points',
        ],
      },
    },
  },
  required: ['sections'],
} as const;

export const TITLE_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' } },
  required: ['title'],
} as const;

export const FLASHCARD_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { front: { type: 'string' }, back: { type: 'string' } },
        required: ['front', 'back'],
      },
    },
  },
  required: ['items'],
} as const;

export const MCQ_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' } },
          answer: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['question', 'choices', 'answer', 'explanation'],
      },
    },
  },
  required: ['items'],
} as const;

export const FREE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          model_answer: { type: 'string' },
        },
        required: ['question', 'model_answer'],
      },
    },
  },
  required: ['items'],
} as const;

export const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    feedback: { type: 'string' },
  },
  required: ['score', 'feedback'],
} as const;

export const QUIZ_SCHEMAS = {
  flashcard: FLASHCARD_SCHEMA,
  multiple_choice: MCQ_SCHEMA,
  free_response: FREE_RESPONSE_SCHEMA,
} as const;
