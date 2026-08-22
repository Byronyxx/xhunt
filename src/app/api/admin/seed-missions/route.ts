import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import { MOCK_HUNTS } from '@/lib/mockHunts';

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', session.sub)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No tenant found. Complete onboarding first.' }, { status: 400 });
  }

  // Check how many missions already exist
  const { count } = await admin
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Missions already exist for this tenant.', count }, { status: 409 });
  }

  const rows = MOCK_HUNTS.map((h) => ({
    tenant_id: profile.tenant_id,
    created_by: session.sub,
    title: h.title,
    story_context: h.story_context,
    difficulty: h.difficulty,
    estimated_time: h.estimated_time,
    steps: h.steps,
    reward: h.reward,
    tags: h.tags,
    status: 'active' as const,
  }));

  const { data: inserted, error } = await admin
    .from('missions')
    .insert(rows)
    .select('id, title');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seeded: inserted?.length ?? 0, missions: inserted });
}
