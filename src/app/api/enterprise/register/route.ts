import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { registerSchema, orgNameKey, firstIssue } from '@/lib/enterprise/validation';
import { appOrigin, enterpriseConfigured } from '@/lib/enterprise/server';

export const dynamic = 'force-dynamic';

// POST /api/enterprise/register
//
// Self-service Enterprise registration. This route only:
//   1. creates the Supabase Auth user (email confirmation required), and
//   2. records the registrant's intent in enterprise_registrations (server-side,
//      service role only).
// It never creates a tenant and never touches user_profiles.role/tenant_id: the
// organization is created by activate_enterprise_org() after the email has been
// verified (see /api/enterprise/sign-in and migration 038). Registration alone
// therefore grants no organization access and cannot start a trial.

function pending(email: string) {
  // Deliberately identical for new and already-registered emails so the
  // endpoint cannot be used to discover which addresses have accounts.
  return NextResponse.json({ pendingConfirmation: true, email }, { status: 201 });
}

export async function POST(req: Request) {
  if (!enterpriseConfigured()) {
    return NextResponse.json({ detail: 'Enterprise registration is not available right now.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(firstIssue(parsed.error), { status: 422 });
  }
  const { orgName, email, password } = parsed.data;
  const nameKey = orgNameKey(orgName);

  const admin = createAdminClient();

  // Name availability. This read also proves migration 038 is applied before
  // an auth user is created.
  const { data: taken, error: lookupError } = await admin
    .from('enterprise_registrations')
    .select('user_id')
    .eq('org_name_key', nameKey)
    .maybeSingle();

  if (lookupError) {
    console.error('[enterprise/register] name lookup failed:', lookupError);
    return NextResponse.json({ detail: 'Enterprise registration is not available right now.' }, { status: 503 });
  }
  if (taken) {
    return NextResponse.json(
      { detail: 'An organization with this name is already registered.', field: 'orgName' },
      { status: 409 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${appOrigin(req)}/enterprise/verify-email` },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('already registered') || message.includes('already been registered')) {
      return pending(email);
    }
    if (error.status === 429) {
      return NextResponse.json({ detail: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 });
    }
    const status = error.status && error.status >= 400 && error.status < 500 ? 400 : 502;
    return NextResponse.json({ detail: error.message }, { status });
  }

  const user = data.user;
  if (!user) {
    return NextResponse.json({ detail: 'Registration failed' }, { status: 500 });
  }

  // Registration must never leave a session behind (only possible if the
  // project auto-confirms emails). The registrant signs in explicitly.
  if (data.session) {
    await supabase.auth.signOut();
  }

  // An existing, confirmed email comes back obfuscated with no identities:
  // answer exactly like a new signup and record nothing.
  if (!user.identities || user.identities.length === 0) {
    return pending(email);
  }

  const { error: insertError } = await admin.from('enterprise_registrations').insert({
    user_id: user.id,
    email,
    org_name: orgName,
    org_name_key: nameKey,
    terms_accepted_at: new Date().toISOString(),
  });

  if (insertError) {
    if (insertError.code === '23505') {
      const where = `${insertError.message} ${insertError.details ?? ''}`;
      if (where.includes('name_key')) {
        // Lost a race for the organization name. The unconfirmed auth user is
        // left in place (it cannot sign in and holds no organization).
        return NextResponse.json(
          { detail: 'An organization with this name is already registered.', field: 'orgName' },
          { status: 409 },
        );
      }
      // Same user submitted again before verifying: first registration stands.
      return pending(email);
    }
    console.error('[enterprise/register] registration insert failed:', insertError);
    return NextResponse.json({ detail: 'Registration failed' }, { status: 500 });
  }

  return pending(email);
}
