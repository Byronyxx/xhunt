import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);

// GET /api/admin/users — list all users in the caller's tenant, plus a
// map of how many missions each user has completed.
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: callerProfile } = await admin
    .from('user_profiles')
    .select('tenant_id, role')
    .eq('id', session.sub)
    .single();

  if (!callerProfile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  if (!ADMIN_ROLES.has(callerProfile.role)) return NextResponse.json({ error: 'Admin role required.' }, { status: 403 });

  const [usersRes, progressRes] = await Promise.all([
    admin
      .from('user_profiles')
      .select('*')
      .eq('tenant_id', callerProfile.tenant_id)
      .order('created_at', { ascending: false }),
    admin
      .from('mission_progress')
      .select('user_id')
      .eq('tenant_id', callerProfile.tenant_id)
      .not('completed_at', 'is', null),
  ]);

  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
  if (progressRes.error) return NextResponse.json({ error: progressRes.error.message }, { status: 500 });

  const completedCounts: Record<string, number> = {};
  for (const row of (progressRes.data ?? [])) {
    completedCounts[row.user_id] = (completedCounts[row.user_id] ?? 0) + 1;
  }

  return NextResponse.json({ users: usersRes.data ?? [], completedCounts });
}
