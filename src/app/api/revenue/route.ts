import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  const { data: profile } = await sb.from('user_profiles').select('tenant_id').eq('id', session.sub).single();
  if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);

  let query = sb
    .from('revenue_records')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('recognized_at', { ascending: false })
    .limit(limit);

  if (category) query = query.eq('category', category);
  if (from) query = query.gte('recognized_at', from);
  if (to) query = query.lte('recognized_at', to);

  const { data: records, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart  = new Date(now.getFullYear(), 0, 1).toISOString();

  const allRecords = records ?? [];
  const totalRevenue = allRecords.reduce((s, r) => s + r.amount_cents, 0);
  const mrr = allRecords.filter(r => r.recognized_at >= monthStart).reduce((s, r) => s + r.amount_cents, 0);
  const arr = allRecords.filter(r => r.recognized_at >= yearStart).reduce((s, r) => s + r.amount_cents, 0);

  const byCategory: Record<string, number> = {};
  allRecords.forEach(r => {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amount_cents;
  });

  return NextResponse.json({
    summary: { total_revenue_cents: totalRevenue, mrr_cents: mrr, arr_cents: arr, by_category: byCategory },
    records: allRecords,
  });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  const { data: profile } = await sb.from('user_profiles').select('tenant_id, role').eq('id', session.sub).single();
  if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const allowedRoles = ['platform_admin', 'tenant_admin'];
  if (!allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();

  const { data, error } = await sb
    .from('revenue_records')
    .insert({ tenant_id: profile.tenant_id, ...body })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data }, { status: 201 });
}
