import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const body = await req.json() as { email: string; password: string };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error || !data.session || !data.user) {
    // Supabase returns "Email not confirmed" verbatim when confirmation
    // is required and hasn't happened yet — surfaced as-is so the sign-in
    // page can show it directly.
    return NextResponse.json(
      { detail: error?.message ?? 'Invalid email or password' },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, email, display_name, avatar_url, role, default_surface, onboarding_complete, tenant_id')
    .eq('id', data.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ detail: 'Profile not found' }, { status: 404 });
  }

  // Stamp last_active_at for this fresh session. Without this, a
  // returning user whose last recorded activity is older than their
  // idle-timeout threshold (30/45 min — see src/proxy.ts) gets signed
  // right back out on their very next request after this login succeeds:
  // proxy.ts's idle-check only ever looks at last_active_at, which a
  // login alone does nothing to update, so it's still reading the
  // timestamp from before this session even existed. Not throttled like
  // proxy.ts's own write — this always fires, exactly once, at the one
  // moment a brand-new session actually starts.
  await admin
    .from('user_profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', data.user.id);

  return NextResponse.json({
    token: {
      access_token: data.session.access_token,
      expires_in: data.session.expires_in,
    },
    user: {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      default_surface: profile.default_surface ?? 'home',
      onboarding_complete: profile.onboarding_complete ?? false,
      tenant_id: profile.tenant_id,
    },
  });
}
