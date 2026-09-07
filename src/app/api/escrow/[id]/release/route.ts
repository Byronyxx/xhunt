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

  const allowedRoles = ['platform_admin', 'tenant_admin'];
  if (!allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json() as { release_amount_cents?: number; notes?: string };

  const { data: escrow } = await sb
    .from('escrow_accounts')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });

  if (['fully_released', 'refunded', 'disputed'].includes(escrow.status)) {
    return NextResponse.json({ error: `Cannot release escrow in status: ${escrow.status}` }, { status: 409 });
  }

  const releaseAmount = body.release_amount_cents ?? escrow.amount_cents - escrow.released_amount_cents;
  const newReleasedTotal = escrow.released_amount_cents + releaseAmount;
  const isFullRelease = newReleasedTotal >= escrow.amount_cents;

  const { data: updated, error } = await sb
    .from('escrow_accounts')
    .update({
      status: isFullRelease ? 'fully_released' : 'partially_released',
      released_amount_cents: newReleasedTotal,
      released_at: isFullRelease ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('escrow_transactions').insert({
    escrow_id: id,
    tenant_id: profile.tenant_id,
    transaction_type: 'release',
    amount_cents: releaseAmount,
    metadata: { released_by: session.sub, notes: body.notes ?? null },
  });

  // Record as revenue
  await sb.from('revenue_records').insert({
    tenant_id: profile.tenant_id,
    escrow_id: id,
    category: 'escrow_release',
    amount_cents: releaseAmount,
    currency: escrow.currency,
    description: `Escrow release — ${isFullRelease ? 'full' : 'partial'} (escrow ${id.slice(0, 8)})`,
    recognized_at: new Date().toISOString(),
  });

  return NextResponse.json({ escrow: updated, released_amount_cents: releaseAmount });
}
