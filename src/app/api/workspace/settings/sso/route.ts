import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);

async function requireAdminTenant(req: NextRequest) {
  const session = await requireSession(req);
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('tenant_id, role')
    .eq('id', session.sub)
    .single();
  if (!profile?.tenant_id) throw new Response(JSON.stringify({ error: 'No organization found.' }), { status: 400 });
  if (!ADMIN_ROLES.has(profile.role)) throw new Response(JSON.stringify({ error: 'Admin role required.' }), { status: 403 });
  return { admin, tenantId: profile.tenant_id as string };
}

// POST /api/workspace/settings/sso — upsert a provider config
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdminTenant(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { admin, tenantId } = ctx;

  const body = await req.json() as {
    providerType: string; displayName: string;
    config: Record<string, string>;
  };

  const { data, error } = await admin
    .from('sso_configs')
    .upsert({
      tenant_id: tenantId,
      provider_type: body.providerType,
      display_name: body.displayName || body.providerType.replace(/_/g, ' '),
      is_enabled: true,
      config: body.config,
    }, { onConflict: 'tenant_id,provider_type' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data?.[0] ?? null });
}
