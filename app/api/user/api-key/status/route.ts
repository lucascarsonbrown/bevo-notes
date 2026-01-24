import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('users')
    .select('gemini_api_key_encrypted, api_key_last_verified, api_key_is_valid')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch API key status' }, { status: 500 });
  }

  return NextResponse.json({
    has_key: !!data?.gemini_api_key_encrypted,
    is_valid: data?.api_key_is_valid ?? false,
    last_verified: data?.api_key_last_verified ?? null,
  });
}
