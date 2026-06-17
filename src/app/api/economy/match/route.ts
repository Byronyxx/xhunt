import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import {
  upsertMatchSignals,
  computeMatchesForUser,
  getMatchesForUser,
  createCoordinationWorkflow,
  type MatchSignal,
  type WorkflowStep,
} from '@/lib/economy/match';

// GET /api/economy/match?recompute=true&limit=10
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const recompute = url.searchParams.get('recompute') === 'true';
  const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);

  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', session!.sub)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    let matches;
    if (recompute) {
      matches = await computeMatchesForUser(profile.id);
      matches = matches.slice(0, limit);
    } else {
      matches = await getMatchesForUser(profile.id, limit);
    }

    return NextResponse.json({ matches, total: matches.length });
  } catch (err) {
    console.error('[economy/match GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/economy/match  — upsert signals or create a coordination workflow
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, tenant_id')
      .eq('id', session!.sub)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    if (action === 'upsert_signals') {
      const { signals } = body;
      if (!Array.isArray(signals) || !signals.length) {
        return NextResponse.json({ error: 'signals array is required' }, { status: 400 });
      }
      const result = await upsertMatchSignals(profile.id, signals as MatchSignal[]);
      return NextResponse.json({ signals: result }, { status: 201 });
    }

    if (action === 'create_workflow') {
      const { missionId, title, workflowType, steps, assignedAgents, governanceRules } = body;
      if (!missionId || !title || !workflowType || !steps) {
        return NextResponse.json({ error: 'missionId, title, workflowType, steps required' }, { status: 400 });
      }
      const workflow = await createCoordinationWorkflow(
        missionId,
        profile.tenant_id,
        title,
        workflowType,
        steps as WorkflowStep[],
        assignedAgents ?? [],
        profile.id,
        governanceRules ?? {}
      );
      return NextResponse.json({ workflow }, { status: 201 });
    }

    if (action === 'update_match_status') {
      const { missionId, status } = body;
      if (!missionId || !status) {
        return NextResponse.json({ error: 'missionId and status required' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('match_results')
        .update({ status })
        .eq('seeker_id', profile.id)
        .eq('mission_id', missionId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ match: data });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[economy/match POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
