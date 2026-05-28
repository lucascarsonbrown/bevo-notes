import { NextResponse } from 'next/server';

export const GET = () =>
  NextResponse.json({ error: 'API key status is no longer applicable.' }, { status: 410 });
