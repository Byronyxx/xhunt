import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { signInSchema, isOrgRole, safeRedirectPath } from '@/lib/enterprise/validation';
import {
  ACTIVATION_ERRORS, PROFILE_COLUMNS, enterpriseConfigured, type ProfileRow,
} from '@/lib/enterprise/server';

export const dynamic = 'force-dynamic';

// POST /api/enterprise/sign-in
//
// Organization sign-in. Reuses Supabase Auth (signInWithPassword) and then
// decides, server-side, whether the account may enter the enterprise workspace:
//   * an Enterprise registrant with a verified email is activated here
//     (activate_enterprise_org: creates the org, makes them its owner) —
//     idempotent, so repeated sign-ins never create a second organization;
//   * anyone without an organization membership and an organization role (for
//     example a Hunter account) is signed straight back out and refused.
// The browser never supplies a role, tenant or organization identifier.

async function loadProfile(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.from('user_profiles').select(PROFILE_COLUMNS).eq('id', userId).single();
  return (data as ProfileRow | null) ?? null;
}

export async function POST(req: Request) {
  if (!enterpriseConfigured()) {
    return NextResponse.json({ detail: 'Enterprise sign-in is not available right now.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }
  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: 'Enter your email and password.' }, { status: 400 });
  }
  const { email, password, redirectTo } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    const unconfirmed = error?.code === 'email_not_confirmed' || /not confirmed/i.test(error?.message ?? '');
    if (unconfirmed) {
      return NextResponse.json(
        { code: 'email_not_verified', detail: 'Verify your email address before signing in.' },
        { status: 403 },
      );
    }
    if (error?.status === 429) {
      return NextResponse.json({ detail: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 });
    }
    return NextResponse.json({ detail: 'Invalid email or password' }, { status: 401 });
  }

  const userId = data.user.id;
  const admin = createAdminClient();

  async function refuse(status: number, code: string, detail: string) {
    await supabase.auth.signOut();
    return NextResponse.json({ code, detail }, { status });
  }

  let profile = await loadProfile(admin, userId);
  if (!profile) {
    return refuse(404, 'profile_not_found', 'Profile not found');
  }

  // First sign-in after verification: turn the registration into an organization.
  if (!profile.tenant_id) {
    const { data: tenantId, error: activationError } = await admin.rpc('activate_enterprise_org', {
      p_user_id: userId,
    });

    if (activationError) {
      const code = (activationError as { code?: string }).code;
      const expected = code === ACTIVATION_ERRORS.INELIGIBLE || code === ACTIVATION_ERRORS.PROFILE_MISSING;
      if (!expected) {
        console.error('[enterprise/sign-in] activation failed:', activationError);
        return refuse(503, 'activation_failed', 'We could not finish setting up your organization. Please try again.');
      }
    } else if (tenantId) {
      profile = (await loadProfile(admin, userId)) ?? profile;
    }
  }

  if (!profile.tenant_id || !isOrgRole(profile.role)) {
    return refuse(
      403,
      'not_organization_account',
      'This account is not linked to an organization. Hunters sign in on the main sign-in page.',
    );
  }

  // Same bookkeeping as the Hunter login route: a fresh session must restart
  // the idle clock (the idle-timeout work in PR #3 reads this column). Best
  // effort — a missing column must not block sign-in.
  const { error: stampError } = await admin
    .from('user_profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);
  if (stampError) {
    console.error('[enterprise/sign-in] last_active_at stamp failed for user', userId, stampError);
  }

  return NextResponse.json({
    redirect: safeRedirectPath(redirectTo),
    user: {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      role: profile.role,
      tenant_id: profile.tenant_id,
    },
  });
}
