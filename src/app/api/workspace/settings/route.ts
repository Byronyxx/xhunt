import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);

// GET /api/workspace/settings
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
    .select('tenant_id, role')
    .eq('id', session.sub)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  }

  const [tenantRes, usersRes, ssoRes] = await Promise.all([
    admin.from('tenants').select('*').eq('id', profile.tenant_id).single(),
    admin.from('user_profiles').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: true }),
    admin.from('sso_configs').select('*').eq('tenant_id', profile.tenant_id),
  ]);

  return NextResponse.json({
    currentUserId: session.sub,
    tenantId: profile.tenant_id,
    isAdmin: ADMIN_ROLES.has(profile.role),
    tenant: tenantRes.data ?? null,
    users: usersRes.data ?? [],
    ssoConfigs: ssoRes.data ?? [],
  });
}

// PATCH /api/workspace/settings — update org name/slug
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

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  }
  if (!ADMIN_ROLES.has(profile.role)) {
    return NextResponse.json({ error: 'Admin role required.' }, { status: 403 });
  }

  const { name, slug } = await req.json() as { name?: string; slug?: string };
  const updates: Record<string, string> = {};
  if (name?.trim()) updates.name = name.trim();
  if (slug?.trim()) updates.slug = slug.trim();
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('tenants')
    .update(updates)
    .eq('id', profile.tenant_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tenant: data });
}
