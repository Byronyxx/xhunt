import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireSession } from '@/lib/auth/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, avatar_url, role, default_surface, onboarding_complete, tenant_id')
      .eq('id', session.sub)
      .single();

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      default_surface: profile.default_surface ?? 'home',
      onboarding_complete: profile.onboarding_complete ?? false,
      tenant_id: profile.tenant_id,
    });
  } catch (err) {
    console.error('[auth/me]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

const ALLOWED_FIELDS = new Set(['display_name', 'avatar_url', 'default_surface']);

export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json() as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('user_profiles')
    .update(updates)
    .eq('id', session.sub)
    .select('id, email, display_name, avatar_url, role, default_surface, onboarding_complete, tenant_id')
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({
    id: profile.id,
    email: profile.email,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    role: profile.role,
    default_surface: profile.default_surface ?? 'home',
    onboarding_complete: profile.onboarding_complete ?? false,
    tenant_id: profile.tenant_id,
  });
}
