import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  const { data: profile } = await sb.from('user_profiles').select('tenant_id, role').eq('id', session.sub).single();
  if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await req.json() as { reason: string };
  if (!body.reason?.trim()) return NextResponse.json({ error: 'Dispute reason is required' }, { status: 400 });

  const { data: escrow } = await sb
    .from('escrow_accounts')
    .select('id, tenant_id, status, amount_cents, released_amount_cents, currency')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
  if (escrow.status === 'fully_released' || escrow.status === 'refunded') {
    return NextResponse.json({ error: `Cannot dispute escrow in status: ${escrow.status}` }, { status: 409 });
  }

  const { data: updated, error } = await sb
    .from('escrow_accounts')
    .update({ status: 'disputed', dispute_reason: body.reason })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const heldAmount = escrow.amount_cents - escrow.released_amount_cents;
  await sb.from('escrow_transactions').insert({
    escrow_id: id,
    tenant_id: profile.tenant_id,
    transaction_type: 'dispute_hold',
    amount_cents: heldAmount,
    metadata: { disputed_by: session.sub, reason: body.reason },
  });

  return NextResponse.json({ escrow: updated });
}
