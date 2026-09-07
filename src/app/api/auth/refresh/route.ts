import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Not currently called from the frontend — middleware.ts handles session
// refresh transparently on every request. Kept working for any future
// caller that wants to force a refresh explicitly.
export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    return NextResponse.json({ detail: error?.message ?? 'Unable to refresh session' }, { status: 401 });
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    expires_in: data.session.expires_in,
  });
}
