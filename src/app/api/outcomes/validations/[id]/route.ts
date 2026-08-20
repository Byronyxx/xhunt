import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import type { ValidationStatus } from '@/lib/supabase/types';

export async function PATCH(
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

  const allowedRoles = ['platform_admin', 'tenant_admin', 'analyst'];
  if (!allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json() as {
    status: ValidationStatus;
    reviewer_notes?: string;
    confidence_score?: number;
  };

  const { data: existing } = await sb
    .from('outcome_validations')
    .select('id, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Record<string, unknown> = {
    status: body.status,
    reviewer_id: session.sub,
    reviewed_at: new Date().toISOString(),
  };
  if (body.reviewer_notes !== undefined) updates.reviewer_notes = body.reviewer_notes;
  if (body.confidence_score !== undefined) updates.confidence_score = body.confidence_score;

  const { data, error } = await sb
    .from('outcome_validations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ validation: data });
}

export async function GET(
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

  const { data: profile } = await sb.from('user_profiles').select('tenant_id').eq('id', session.sub).single();
  if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const { data, error } = await sb
    .from('outcome_validations')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ validation: data });
}
