import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import type { DbOutcomeValidation, ValidationType, ValidationEvidence } from '@/lib/supabase/types';

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
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  let query = sb
    .from('outcome_validations')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (mission_id) query = query.eq('mission_id', mission_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ validations: data ?? [] });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  const { data: profile } = await sb.from('user_profiles').select('tenant_id').eq('id', session.sub).single();
  if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await req.json() as {
    mission_id?: string;
    outcome_event_id?: string;
    validation_type: ValidationType;
    evidence?: ValidationEvidence[];
  };

  const { data, error } = await sb
    .from('outcome_validations')
    .insert({
      tenant_id: profile.tenant_id,
      user_id: session.sub,
      mission_id: body.mission_id ?? null,
      outcome_event_id: body.outcome_event_id ?? null,
      validation_type: body.validation_type ?? 'self_reported',
      evidence: body.evidence ?? [],
      status: 'pending',
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ validation: data as DbOutcomeValidation }, { status: 201 });
}
