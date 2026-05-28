import { NextResponse } from 'next/server';

// API key management has been removed — the platform now manages the Gemini key.
const gone = () =>
  NextResponse.json(
    { error: 'API key management has been removed. Bevo Notes now manages AI on your behalf.' },
    { status: 410 }
  );

export const GET = gone;
export const POST = gone;
export const DELETE = gone;
