import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);
const VALID_ROLES = new Set(['tenant_admin', 'mission_creator', 'analyst', 'participant']);

// PATCH /api/workspace/settings/users/[id] — change a teammate's role
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  if (!ADMIN_ROLES.has(profile.role)) return NextResponse.json({ error: 'Admin role required.' }, { status: 403 });

  const { role } = await req.json() as { role: string };
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('user_profiles')
    .update({ role })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id) // scope: can only edit teammates in your own tenant
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({ user: data });
}
