import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// GET /api/workspace/audience — segments + a page of tenant users
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
    return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  }

  const [segmentsRes, usersRes] = await Promise.all([
    admin.from('audience_segments').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }),
    admin.from('user_profiles').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }).limit(50),
  ]);

  return NextResponse.json({
    tenantId: profile.tenant_id,
    segments: segmentsRes.data ?? [],
    users: usersRes.data ?? [],
  });
}

// POST /api/workspace/audience — create a new segment
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  }

  const { name, description } = await req.json() as { name: string; description?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Segment name is required.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('audience_segments')
    .insert({
      tenant_id: profile.tenant_id,
      name: name.trim(),
      description: description?.trim() || null,
      filters: {},
      created_by: session.sub,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ segment: data });
}
