import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// GET /api/workspace/segments
// Same fix pattern as /api/missions/create — verify identity locally instead
// of relying on sb.auth.getUser(), which can't reliably recognize our
// custom-signed JWTs.

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', session.sub)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ segments: [] });
  }

  const { data, error } = await admin
    .from('audience_segments')
    .select('id, name, member_count')
    .eq('tenant_id', profile.tenant_id)
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ segments: data ?? [] });
}
