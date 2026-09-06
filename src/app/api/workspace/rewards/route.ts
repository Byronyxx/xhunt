import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// GET /api/workspace/rewards — this tenant's reward configs + recent reward events
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

  const [configsRes, eventsRes] = await Promise.all([
    admin
      .from('reward_configs')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false }),
    admin
      .from('reward_events')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('issued_at', { ascending: false })
      .limit(30),
  ]);

  if (configsRes.error) return NextResponse.json({ error: configsRes.error.message }, { status: 500 });
  if (eventsRes.error) return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });

  return NextResponse.json({ configs: configsRes.data ?? [], events: eventsRes.data ?? [] });
}

// POST /api/workspace/rewards — create a new reward config for this tenant.
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

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;
  const { name, type, value } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ error: 'Type is required.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('reward_configs')
    .insert({
      tenant_id: profile.tenant_id,
      name: name.trim(),
      type,
      value: value ?? {},
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ config: data });
}
