import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const CREATOR_ROLES = new Set(['mission_creator', 'tenant_admin', 'platform_admin']);

// GET /api/missions/[id] — mission detail with score + progress stats
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  }

  const [missionRes, scoreRes, progressRes] = await Promise.all([
    admin.from('missions').select('*').eq('id', id).eq('tenant_id', profile.tenant_id).single(),
    admin.from('mission_scores').select('*').eq('mission_id', id).maybeSingle(),
    admin.from('mission_progress').select('user_id, completed_at').eq('mission_id', id),
  ]);

  if (!missionRes.data) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  const progress = progressRes.data ?? [];

  return NextResponse.json({
    mission: {
      ...missionRes.data,
      score: scoreRes.data ?? undefined,
      completions: progress.filter((p) => p.completed_at).length,
      participants: new Set(progress.map((p) => p.user_id)).size,
    },
  });
}

// PATCH /api/missions/[id]
// Updates a mission (status, or other fields as needed). Same auth-fix
// pattern as /api/missions/create.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('user_profiles')
    .select('tenant_id, role')
    .eq('id', session.sub)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  }
  if (!CREATOR_ROLES.has(profile.role)) {
    return NextResponse.json({ error: 'You do not have permission to edit missions.' }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;

  // Only allow a known-safe set of fields to be patched from this endpoint.
  const ALLOWED_FIELDS = new Set([
    'status', 'title', 'story_context', 'difficulty', 'estimated_time',
    'steps', 'reward', 'tags', 'is_public',
  ]);
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('missions')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  return NextResponse.json({ mission: data });
}
