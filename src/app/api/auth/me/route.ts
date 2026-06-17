import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
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
