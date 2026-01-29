import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/utils/encryption';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Say "ok"' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 10,
        },
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
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

  const { api_key } = body;

  if (!api_key || typeof api_key !== 'string') {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  if (api_key.length < 20) {
    return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 });
  }

  const isValid = await validateGeminiApiKey(api_key);

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid API key. Please check your Gemini API key and try again.' },
      { status: 400 }
    );
  }

  let encryptedKey: string;
  try {
    encryptedKey = encrypt(api_key);
  } catch (encryptError) {
    console.error('Encryption error:', encryptError);
    return NextResponse.json({ error: 'Encryption failed - check ENCRYPTION_KEY env var' }, { status: 500 });
  }

  const { error } = await supabase
    .from('users')
    .update({
      gemini_api_key_encrypted: encryptedKey,
      api_key_last_verified: new Date().toISOString(),
      api_key_is_valid: true,
    })
    .eq('id', user.id);

  if (error) {
    console.error('Supabase update error:', error);
    return NextResponse.json({ error: 'Failed to save API key: ' + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, validated: true });
}

export async function DELETE() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('users')
    .update({
      gemini_api_key_encrypted: null,
      api_key_last_verified: null,
      api_key_is_valid: false,
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
