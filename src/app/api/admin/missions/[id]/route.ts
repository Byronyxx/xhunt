import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);

const MISSION_FIELDS = [
  'title', 'story_context', 'difficulty', 'estimated_time',
  'tags', 'reward', 'status', 'is_public', 'steps',
] as const;

// GET /api/admin/missions/[id] — mission detail bundle: the mission itself,
// completion count, the caller's tenant-scoped audience segments + reward
// configs (previously fetched with NO tenant filter at all on the client —
// a real cross-tenant data leak, fixed here), which of those are linked to
// this mission, and the latest approval record.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });

  const { data: mission, error: missionError } = await admin
    .from('missions')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (missionError || !mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

  const [
    progressRes,
    segmentsRes,
    rewardsRes,
    mAudRes,
    mRewRes,
    approvalRes,
  ] = await Promise.all([
    admin.from('mission_progress').select('id', { count: 'exact', head: true }).eq('mission_id', id).not('completed_at', 'is', null),
    admin.from('audience_segments').select('*').eq('tenant_id', profile.tenant_id).order('name'),
    admin.from('reward_configs').select('*').eq('tenant_id', profile.tenant_id).order('name'),
    admin.from('mission_audience').select('segment_id').eq('mission_id', id),
    admin.from('mission_rewards').select('reward_id').eq('mission_id', id),
    admin.from('mission_approvals').select('*').eq('mission_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  return NextResponse.json({
    mission,
    completions: progressRes.count ?? 0,
    segments: segmentsRes.data ?? [],
    rewards: rewardsRes.data ?? [],
    linkedSegmentIds: (mAudRes.data ?? []).map((r: { segment_id: string }) => r.segment_id),
    linkedRewardIds: (mRewRes.data ?? []).map((r: { reward_id: string }) => r.reward_id),
    pendingApproval: approvalRes.data ?? null,
  });
}

// PATCH /api/admin/missions/[id] — update mission fields (full edit form save,
// or a status-only transition like pause/archive/publish). Admin role required.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  if (!ADMIN_ROLES.has(profile.role)) return NextResponse.json({ error: 'Admin role required.' }, { status: 403 });

  const body = await req.json() as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const field of MISSION_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from('missions')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

  return NextResponse.json({ mission: data });
}

// DELETE /api/admin/missions/[id] — tenant-scoped mission delete, admin role required.
// Fixes a real bug in the previous direct-client implementation, which deleted
// by id alone with no tenant_id check (cross-tenant delete was possible).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  if (!ADMIN_ROLES.has(profile.role)) return NextResponse.json({ error: 'Admin role required.' }, { status: 403 });

  const { data, error } = await admin
    .from('missions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

  return NextResponse.json({ deleted: data.id });
}
