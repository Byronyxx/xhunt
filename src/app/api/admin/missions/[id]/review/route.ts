import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// POST /api/admin/missions/[id]/review — submit a draft mission for governance
// review: creates a pending mission_approvals row and an audit_log entry,
// then returns the newly-created pending approval.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: mission } = await admin
    .from('missions')
    .select('id, title, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

  const { error: approvalError } = await admin.from('mission_approvals').insert({
    mission_id: id,
    tenant_id: mission.tenant_id,
    status: 'pending',
    reviewer_id: null,
    notes: null,
  });

  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500 });

  await admin.from('audit_log').insert({
    tenant_id: mission.tenant_id,
    user_id: session.sub,
    action: 'mission_submitted_for_review',
    resource_type: 'mission',
    resource_id: id,
    metadata: { title: mission.title },
  });

  const { data: pendingApproval } = await admin
    .from('mission_approvals')
    .select('*')
    .eq('mission_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ pendingApproval: pendingApproval ?? null });
}
