import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailOnlySchema, firstIssue } from '@/lib/enterprise/validation';
import { appOrigin, enterpriseConfigured } from '@/lib/enterprise/server';

export const dynamic = 'force-dynamic';

// POST /api/enterprise/resend-verification
//
// Re-sends the confirmation email, but only for a pending Enterprise
// registration (never for Hunter signups). The answer is always the same
// success response so this cannot be used to probe which emails are registered.

export async function POST(req: Request) {
  if (!enterpriseConfigured()) {
    return NextResponse.json({ detail: 'Not available right now.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }
  const parsed = emailOnlySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(firstIssue(parsed.error), { status: 422 });
  }
  const { email } = parsed.data;

  try {
    const admin = createAdminClient();
    const { data: registration } = await admin
      .from('enterprise_registrations')
      .select('user_id')
      .eq('email', email)
      .is('tenant_id', null)
      .maybeSingle();

    if (registration) {
      const supabase = await createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${appOrigin(req)}/enterprise/verify-email` },
      });
      if (error) console.warn('[enterprise/resend-verification] resend failed:', error.message);
    }
  } catch (err) {
    console.error('[enterprise/resend-verification]', err);
  }

  return NextResponse.json({ ok: true });
}
