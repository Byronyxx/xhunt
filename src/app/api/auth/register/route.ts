import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';

export async function POST(req: NextRequest) {
  const body = await req.json() as { email: string; password: string; display_name?: string };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      data: { display_name: body.display_name },
    },
  });

  if (error) {
    const isDupe = error.message.toLowerCase().includes('already registered');
    return NextResponse.json(
      { detail: isDupe ? 'Email already registered' : error.message },
      { status: isDupe ? 409 : 400 }
    );
  }
  if (!data.user) {
    return NextResponse.json({ detail: 'Registration failed' }, { status: 500 });
  }

  // Fire welcome email non-blocking either way — registration succeeds
  // even if this fails.
  sendEmail({
    to: body.email,
    template: 'welcome',
    data: { name: body.display_name ?? body.email },
  }).catch((err: unknown) => console.error('[register] welcome email failed:', err));

  // Email confirmation is required in this project, so signUp() succeeds
  // but returns no active session until the user clicks the confirmation
  // link. Tell the frontend to show a "check your email" state instead of
  // trying to log the user straight in.
  if (!data.session) {
    return NextResponse.json({ pendingConfirmation: true, email: body.email }, { status: 201 });
  }

  // Confirmation somehow already satisfied (e.g. auto-confirmed in local
  // dev) — fall through to the normal logged-in response.
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
  }, { status: 201 });
}
