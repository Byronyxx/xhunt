import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// GET /api/admin/missions — tenant-scoped mission list
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });

  const { data, error } = await admin
    .from('missions')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ missions: data ?? [] });
}
