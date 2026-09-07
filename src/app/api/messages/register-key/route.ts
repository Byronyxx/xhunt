import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// POST /api/messages/register-key
// Stores the user's ECDH public key in user_profiles.public_key.
// Called once per device after login.

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createAdminClient();

  const { public_key } = await req.json() as { public_key: string };
  if (!public_key || typeof public_key !== 'string') {
    return NextResponse.json({ error: 'Invalid public key' }, { status: 400 });
  }

  // Validate it's a valid JWK JSON string
  try { JSON.parse(public_key); } catch {
    return NextResponse.json({ error: 'Malformed public key' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ public_key })
    .eq('id', session.sub);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
