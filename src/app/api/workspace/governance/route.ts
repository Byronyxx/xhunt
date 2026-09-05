import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const REVIEW_ROLES = new Set(['platform_admin', 'tenant_admin', 'analyst']);
const VALID_STATUSES = new Set(['approved', 'rejected']);

// GET /api/workspace/governance — mission approvals + audit logs for the caller's tenant
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

  const [approvalsRes, logsRes] = await Promise.all([
    admin
      .from('mission_approvals')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(30),
    admin
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (approvalsRes.error) return NextResponse.json({ error: approvalsRes.error.message }, { status: 500 });
  if (logsRes.error) return NextResponse.json({ error: logsRes.error.message }, { status: 500 });

  return NextResponse.json({ approvals: approvalsRes.data ?? [], logs: logsRes.data ?? [] });
}

// PATCH /api/workspace/governance — approve or reject a mission approval
export async function PATCH(req: NextRequest) {
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
  if (!REVIEW_ROLES.has(profile.role)) return NextResponse.json({ error: 'Reviewer role required.' }, { status: 403 });

  const { id, status } = await req.json() as { id: string; status: string };
  if (!id || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('mission_approvals')
    .update({ status, reviewer_id: session.sub })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });

  return NextResponse.json({ approval: data });
}
