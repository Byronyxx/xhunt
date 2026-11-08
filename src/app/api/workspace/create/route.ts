import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// POST /api/workspace/create
// Creates a tenant + updates the user's profile in one transaction.
// Uses the admin client to bypass RLS. Identity is verified locally via our
// own JWT (requireSession) rather than sb.auth.getUser() — the Supabase
// client can't reliably recognize our custom-signed tokens (see migration
// 029), so routes that depended on it were silently 401'ing after the
// Clerk → custom-auth migration. This is the fix pattern to replicate
// across the other routes still calling sb.auth.getUser().

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, slug, org_type } = await req.json() as {
    name: string;
    slug: string;
    org_type: string;
  };

  if (!name?.trim() || !slug?.trim() || !org_type?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create tenant
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert({ name: name.trim(), slug: slug.trim(), settings: { org_type } })
    .select('id')
    .single();

  if (tenantErr) {
    const isDupe = tenantErr.code === '23505'; // unique_violation
    return NextResponse.json(
      { error: isDupe ? 'That workspace name is already taken. Try another.' : tenantErr.message },
      { status: isDupe ? 409 : 500 }
    );
  }

  // Update user profile
  const { error: profileErr } = await admin
    .from('user_profiles')
    .upsert({
      id: user.sub,
      tenant_id: tenant.id,
      role: 'tenant_admin',
      onboarding_complete: true,
    });

  if (profileErr) {
    // Roll back tenant creation
    await admin.from('tenants').delete().eq('id', tenant.id);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({ tenant_id: tenant.id });
}
