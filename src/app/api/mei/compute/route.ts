import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import type { DbMissionProgress, DbOutcomeEvent } from '@/lib/supabase/types';

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', session.sub)
    .single();

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });
  const tid = profile.tenant_id;

  // Load all missions, progress, and outcome events for this tenant
  const [missionsRes, progressRes, outcomesRes] = await Promise.all([
    supabase.from('missions').select('id, tenant_id').eq('tenant_id', tid),
    supabase.from('mission_progress').select('*').eq('tenant_id', tid),
    supabase.from('outcome_events').select('*').eq('tenant_id', tid),
  ]);

  const missions = missionsRes.data ?? [];
  const allProgress: DbMissionProgress[] = progressRes.data ?? [];
  const allOutcomes: DbOutcomeEvent[] = outcomesRes.data ?? [];

  // Build per-user mission attempt history for retention scoring
  const userMissionCount: Record<string, number> = {};
  allProgress.forEach((p) => {
    userMissionCount[p.user_id] = (userMissionCount[p.user_id] ?? 0) + 1;
  });

  const upserts = missions.map((m) => {
    const progress = allProgress.filter((p) => p.mission_id === m.id);
    const totalAttempts = progress.length;

    if (totalAttempts === 0) {
      return {
        mission_id: m.id,
        tenant_id: tid,
        completion_score: 0,
        engagement_score: 0,
        retention_score: 0,
        outcome_score: 0,
        mei: 0,
        sample_size: 0,
        computed_at: new Date().toISOString(),
      };
    }

    const completions = progress.filter((p) => p.completed_at !== null);
    const completionRate = completions.length / totalAttempts;

    // Engagement = average steps completed / total steps (proxy for depth)
    const avgStepsCompleted = progress.reduce((sum, p) => {
      return sum + (Array.isArray(p.completed_steps) ? p.completed_steps.length : 0);
    }, 0) / totalAttempts;

    // Engagement score: normalize avgSteps against a target of 5 steps
    const TARGET_STEPS = 5;
    const engagementRate = Math.min(avgStepsCompleted / TARGET_STEPS, 1);

    // Retention = fraction of users on this mission who came back (did 2+ total missions)
    const usersOnMission = [...new Set(progress.map((p) => p.user_id))];
    const returnedUsers = usersOnMission.filter((uid) => (userMissionCount[uid] ?? 0) >= 2).length;
    const retentionRate = usersOnMission.length > 0 ? returnedUsers / usersOnMission.length : 0;

    // Outcome score = outcomes recorded / completions (capped at 1)
    const outcomeCount = allOutcomes.filter((o) => o.mission_id === m.id).length;
    const outcomeRate = completions.length > 0 ? Math.min(outcomeCount / completions.length, 1) : 0;

    // MEI = weighted composite (40% completion, 25% engagement, 20% retention, 15% outcome)
    const mei = clamp(
      completionRate * 40 +
      engagementRate * 25 +
      retentionRate * 20 +
      outcomeRate * 15
    );

    return {
      mission_id: m.id,
      tenant_id: tid,
      completion_score: clamp(completionRate * 100),
      engagement_score: clamp(engagementRate * 100),
      retention_score: clamp(retentionRate * 100),
      outcome_score: clamp(outcomeRate * 100),
      mei,
      sample_size: totalAttempts,
      computed_at: new Date().toISOString(),
    };
  });

  // Upsert all scores
  const { error } = await supabase
    .from('mission_scores')
    .upsert(upserts, { onConflict: 'mission_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ computed: upserts.length, scores: upserts });
}
