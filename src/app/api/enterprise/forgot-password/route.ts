import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emailOnlySchema, firstIssue } from '@/lib/enterprise/validation';
import { appOrigin, enterpriseConfigured } from '@/lib/enterprise/server';

export const dynamic = 'force-dynamic';

// POST /api/enterprise/forgot-password
//
// Sends a Supabase password-recovery email whose link lands on
// /enterprise/reset-password. Always answers with the same success response so
// the endpoint reveals nothing about which emails have accounts. Supabase
// applies its own per-address send limits.

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

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${appOrigin(req)}/enterprise/reset-password`,
    });
    if (error) console.warn('[enterprise/forgot-password] send failed:', error.message);
  } catch (err) {
    console.error('[enterprise/forgot-password]', err);
  }

  return NextResponse.json({ ok: true });
}
