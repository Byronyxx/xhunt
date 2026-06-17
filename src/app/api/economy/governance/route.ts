import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import { recordGovernanceAction } from '@/lib/economy/match';

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);

// GET /api/economy/governance?limit=50&actionType=ranking_override
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const actionType = url.searchParams.get('actionType');
  const targetUserId = url.searchParams.get('targetUserId');

  try {
    const supabase = await createClient();

    let query = supabase
      .from('governance_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 200));

    if (actionType) query = query.eq('action_type', actionType);
    if (targetUserId) query = query.eq('target_user_id', targetUserId);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ actions: data, total: count });
  } catch (err) {
    console.error('[economy/governance GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/economy/governance  — record a governance action (admin only)
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('id', session!.sub)
      .single();

    if (!profile || !ADMIN_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      actionType,
      rationale,
      targetUserId,
      targetMissionId,
      beforeState,
      afterState,
      isReversible,
    } = body;

    if (!actionType || !rationale) {
      return NextResponse.json({ error: 'actionType and rationale are required' }, { status: 400 });
    }

    const action = await recordGovernanceAction(actionType, rationale, {
      actorId: profile.id,
      targetUserId,
      targetMissionId,
      beforeState,
      afterState,
      isReversible: isReversible ?? true,
    });

    return NextResponse.json({ action }, { status: 201 });
  } catch (err) {
    console.error('[economy/governance POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/economy/governance/:id  — mark action as reversed
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { actionId } = body;
    if (!actionId) return NextResponse.json({ error: 'actionId is required' }, { status: 400 });

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('id', session!.sub)
      .single();

    if (!profile || !ADMIN_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('governance_actions')
      .update({ reversed_at: new Date().toISOString(), reviewed_by: profile.id })
      .eq('id', actionId)
      .eq('is_reversible', true)
      .is('reversed_at', null)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ action: data });
  } catch (err) {
    console.error('[economy/governance PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
