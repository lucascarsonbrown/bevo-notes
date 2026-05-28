import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { FREE_LIMITS, getUserTier, getUsageCounts } from '@/lib/usage';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [tier, counts] = await Promise.all([
    getUserTier(supabase, user.id),
    getUsageCounts(supabase, user.id),
  ]);

  return NextResponse.json({ tier, counts, limits: FREE_LIMITS });
}
