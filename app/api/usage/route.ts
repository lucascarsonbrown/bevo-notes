import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getUsageCounts } from '@/lib/usage';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const counts = await getUsageCounts(supabase, user.id);

  return NextResponse.json({ counts });
}
