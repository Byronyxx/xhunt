import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// GET /api/admin/missions — tenant-scoped mission list
export async function GET(req: NextRequest) {
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });

  const { data, error } = await admin
    .from('missions')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ missions: data ?? [] });
}

// POST /api/admin/missions — create a mission scoped to the caller's tenant.
// Used by both the "Save" (status: 'active'/'draft') and "Submit for review"
// (status: 'draft') flows in admin/missions/new. The review flow follows up
// with a separate POST to /api/admin/missions/[id]/review.
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;

  const {
    title,
    story_context,
    difficulty,
    estimated_time,
    steps,
    reward,
    tags,
    status,
    is_public,
  } = body;

  if (!title) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('missions')
    .insert({
      tenant_id: profile.tenant_id,
      created_by: session.sub,
      title,
      story_context: story_context ?? null,
      difficulty,
      estimated_time: estimated_time ?? null,
      steps,
      reward: reward ?? '',
      tags,
      status: status ?? 'draft',
      is_public: is_public ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ mission: data });
}
