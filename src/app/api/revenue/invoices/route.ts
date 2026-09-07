import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import type { InvoiceLineItem } from '@/lib/supabase/types';

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

  let query = sb
    .from('invoices')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('issued_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invoices: data ?? [] });
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
    line_items: InvoiceLineItem[];
    currency?: string;
    due_days?: number;
  };

  if (!body.line_items?.length) {
    return NextResponse.json({ error: 'At least one line item required' }, { status: 400 });
  }

  const totalCents = body.line_items.reduce((s, item) => s + item.amount_cents, 0);

  // Generate invoice number: INV-YYYY-NNNN
  const { count } = await sb
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id);

  const invoiceNumber = `INV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`;

  const issuedAt = new Date();
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + (body.due_days ?? 30));

  const { data, error } = await sb
    .from('invoices')
    .insert({
      tenant_id: profile.tenant_id,
      invoice_number: invoiceNumber,
      status: 'open',
      amount_cents: totalCents,
      currency: body.currency ?? 'usd',
      line_items: body.line_items,
      issued_at: issuedAt.toISOString(),
      due_at: dueAt.toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data }, { status: 201 });
}
