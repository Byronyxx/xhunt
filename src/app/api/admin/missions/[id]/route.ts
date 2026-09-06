import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);

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
