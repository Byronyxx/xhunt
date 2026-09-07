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
