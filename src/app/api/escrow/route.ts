import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import type { EscrowReleaseCondition } from '@/lib/supabase/types';

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
  const status = searchParams.get('status');
  const mission_id = searchParams.get('mission_id');

  let query = sb
    .from('escrow_accounts')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (mission_id) query = query.eq('mission_id', mission_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ escrow_accounts: data ?? [] });
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

  const body = await req.json() as {
    mission_id?: string;
    amount_cents: number;
    currency?: string;
    release_condition: EscrowReleaseCondition;
    release_config?: Record<string, unknown>;
  };

  if (!body.amount_cents || body.amount_cents <= 0) {
    return NextResponse.json({ error: 'amount_cents must be positive' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('escrow_accounts')
    .insert({
      tenant_id: profile.tenant_id,
      mission_id: body.mission_id ?? null,
      amount_cents: body.amount_cents,
      currency: body.currency ?? 'usd',
      status: 'created',
      release_condition: body.release_condition ?? 'manual_approval',
      release_config: body.release_config ?? {},
      released_amount_cents: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('escrow_transactions').insert({
    escrow_id: data.id,
    tenant_id: profile.tenant_id,
    transaction_type: 'fund',
    amount_cents: body.amount_cents,
    metadata: { created_by: session.sub },
  });

  return NextResponse.json({ escrow: data }, { status: 201 });
}
