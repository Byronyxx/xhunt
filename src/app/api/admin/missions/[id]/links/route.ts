import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);

// PUT /api/admin/missions/[id]/links — replace this mission's linked audience
// segments and reward configs in one call. Validates that every id belongs to
// the caller's own tenant before linking (the previous client-side version had
// no such check, so a segment/reward id from another tenant could be linked).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: mission } = await admin
    .from('missions')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

  const body = await req.json() as { segmentIds?: string[]; rewardIds?: string[] };
  const segmentIds = Array.isArray(body.segmentIds) ? body.segmentIds : [];
  const rewardIds = Array.isArray(body.rewardIds) ? body.rewardIds : [];

  if (segmentIds.length > 0) {
    const { data: validSegments } = await admin
      .from('audience_segments')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .in('id', segmentIds);
    const validIds = new Set((validSegments ?? []).map((s: { id: string }) => s.id));
    if (validIds.size !== segmentIds.length) {
      return NextResponse.json({ error: 'One or more audience segments are invalid.' }, { status: 400 });
    }
  }

  if (rewardIds.length > 0) {
    const { data: validRewards } = await admin
      .from('reward_configs')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .in('id', rewardIds);
    const validIds = new Set((validRewards ?? []).map((r: { id: string }) => r.id));
    if (validIds.size !== rewardIds.length) {
      return NextResponse.json({ error: 'One or more reward configs are invalid.' }, { status: 400 });
    }
  }

  await admin.from('mission_audience').delete().eq('mission_id', id);
  if (segmentIds.length > 0) {
    const { error } = await admin.from('mission_audience').insert(
      segmentIds.map((segment_id) => ({ mission_id: id, segment_id }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from('mission_rewards').delete().eq('mission_id', id);
  if (rewardIds.length > 0) {
    const { error } = await admin.from('mission_rewards').insert(
      rewardIds.map((reward_id) => ({ mission_id: id, reward_id }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
