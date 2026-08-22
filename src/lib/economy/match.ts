import { createAdminClient } from '@/lib/supabase/admin';

export interface MatchSignal {
  signalType: string;
  value: string;
  weight?: number;
  source?: string;
  expiresAt?: string;
}

export interface MatchResult {
  missionId: string;
  compositeScore: number;
  skillMatch: number;
  trustMatch: number;
  availabilityMatch: number;
  locationMatch: number;
  interestMatch: number;
  contributionMatch: number;
  matchRationale: string;
  skillGaps: string[];
  growthOpportunity: number;
}

export interface WorkflowStep {
  stepId: string;
  title: string;
  assigneeType: 'human' | 'ai' | 'either';
  checkpoint: boolean;
  dependencies: string[];
  status: 'pending' | 'active' | 'completed';
}

export async function upsertMatchSignals(userId: string, signals: MatchSignal[]) {
  const supabase = createAdminClient();

  const rows = signals.map((s) => ({
    user_id: userId,
    signal_type: s.signalType,
    value: s.value,
    weight: s.weight ?? 1.0,
    source: s.source ?? 'self_declared',
    expires_at: s.expiresAt ?? null,
  }));

  const { data, error } = await supabase
    .from('match_signals')
    .upsert(rows, { onConflict: 'user_id,signal_type,value' })
    .select();

  if (error) throw error;
  return data;
}

export async function computeMatchesForUser(userId: string): Promise<MatchResult[]> {
  const supabase = createAdminClient();

  // Gather user signals
  const { data: signals } = await supabase
    .from('match_signals')
    .select('signal_type, value, weight')
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  type Signal = { signal_type: string; value: string; weight: number };
  const signalList: Signal[] = signals ?? [];

  const userSkills = signalList
    .filter((s) => s.signal_type === 'skill')
    .map((s) => s.value.toLowerCase());

  const userInterests = signalList
    .filter((s) => s.signal_type === 'interest')
    .map((s) => s.value.toLowerCase());

  const isAvailable = signalList.some(
    (s) => s.signal_type === 'availability' && s.value === 'true'
  );

  // Fetch active public missions
  const { data: missions } = await supabase
    .from('missions')
    .select('id, title, tags, steps, difficulty, location_type, tenant_id')
    .eq('status', 'active')
    .eq('is_public', true)
    .limit(50);

  if (!missions?.length) return [];

  // Fetch user trust composite
  const { data: trustProfile } = await supabase
    .from('trust_profiles')
    .select('composite_score')
    .eq('user_id', userId)
    .single();

  const trustScore = trustProfile?.composite_score ?? 50;

  // Fetch contribution summary for contribution_match
  const { data: contribSummary } = await supabase
    .from('contribution_summaries')
    .select('total_points')
    .eq('user_id', userId)
    .single();

  const contributionPoints = contribSummary?.total_points ?? 0;
  const contributionMatch = Math.min(100, (contributionPoints / 500) * 100); // normalize 500 pts = 100%

  type Mission = { id: string; title: string; tags: unknown; steps: unknown[]; difficulty: string; location_type: string; tenant_id: string };
  const results: MatchResult[] = (missions as Mission[]).map((mission) => {
    const missionTags = ((mission.tags ?? []) as string[]).map((t: string) => t.toLowerCase());
    const missionSteps = (mission.steps ?? []) as unknown[];

    // Skill match: overlap between user skills and mission tags
    const skillOverlap = userSkills.filter((s) => missionTags.includes(s)).length;
    const skillMatch = missionTags.length
      ? Math.min(100, (skillOverlap / missionTags.length) * 100)
      : 50;

    const skillGaps = missionTags.filter((t) => !userSkills.includes(t));

    // Interest match
    const interestOverlap = userInterests.filter((i) => missionTags.includes(i)).length;
    const interestMatch = missionTags.length
      ? Math.min(100, (interestOverlap / missionTags.length) * 100)
      : 40;

    // Availability
    const availabilityMatch = isAvailable ? 80 : 40;

    // Location: remote missions are universally available
    const locationMatch = mission.location_type === 'remote' ? 90 : 60;

    // Growth opportunity: inversely proportional to skill match (stretch = good, too much gap = bad)
    const growthOpportunity = skillMatch < 80 && skillMatch > 20
      ? Math.round((80 - skillMatch) * 0.75)
      : 0;

    // Trust match: trust score maps to match score
    const trustMatch = trustScore;

    const compositeScore = Math.round(
      skillMatch        * 0.30 +
      trustMatch        * 0.25 +
      availabilityMatch * 0.15 +
      locationMatch     * 0.10 +
      interestMatch     * 0.15 +
      contributionMatch * 0.05
    );

    const rationale = buildRationale(skillMatch, trustMatch, skillGaps, missionSteps.length);

    return {
      missionId: mission.id,
      compositeScore,
      skillMatch: Math.round(skillMatch),
      trustMatch: Math.round(trustMatch),
      availabilityMatch,
      locationMatch,
      interestMatch: Math.round(interestMatch),
      contributionMatch: Math.round(contributionMatch),
      matchRationale: rationale,
      skillGaps,
      growthOpportunity,
    };
  });

  results.sort((a, b) => b.compositeScore - a.compositeScore);

  // Persist matches
  const rows = results.slice(0, 20).map((r) => ({
    seeker_id: userId,
    mission_id: r.missionId,
    skill_match: r.skillMatch,
    trust_match: r.trustMatch,
    availability_match: r.availabilityMatch,
    location_match: r.locationMatch,
    interest_match: r.interestMatch,
    contribution_match: r.contributionMatch,
    composite_score: r.compositeScore,
    match_rationale: r.matchRationale,
    skill_gaps: r.skillGaps,
    growth_opportunity: r.growthOpportunity,
  }));

  await supabase
    .from('match_results')
    .upsert(rows, { onConflict: 'seeker_id,mission_id' });

  return results;
}

export async function getMatchesForUser(userId: string, limit = 10) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('match_results')
    .select('*, missions(id, title, tags, difficulty, estimated_time, reward, tenant_id)')
    .eq('seeker_id', userId)
    .neq('status', 'dismissed')
    .gt('expires_at', new Date().toISOString())
    .order('composite_score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function createCoordinationWorkflow(
  missionId: string,
  tenantId: string,
  title: string,
  workflowType: 'human_only' | 'ai_assisted' | 'hybrid' | 'autonomous',
  steps: WorkflowStep[],
  assignedAgents: Array<{ agentId: string; role: string; scope: string }> = [],
  createdBy: string,
  governanceRules: Record<string, unknown> = {}
) {
  const supabase = createAdminClient();

  const humanCheckpoints = steps.filter((s) => s.checkpoint && s.assigneeType !== 'ai').length;

  const { data, error } = await supabase
    .from('coordination_workflows')
    .insert({
      mission_id: missionId,
      tenant_id: tenantId,
      workflow_type: workflowType,
      title,
      steps,
      assigned_agents: assignedAgents,
      human_checkpoints: humanCheckpoints,
      governance_rules: governanceRules,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function recordGovernanceAction(
  actionType: string,
  rationale: string,
  options: {
    actorId?: string;
    targetUserId?: string;
    targetMissionId?: string;
    beforeState?: unknown;
    afterState?: unknown;
    isReversible?: boolean;
  } = {}
) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('governance_actions')
    .insert({
      action_type: actionType,
      actor_id: options.actorId ?? null,
      target_user_id: options.targetUserId ?? null,
      target_mission_id: options.targetMissionId ?? null,
      rationale,
      before_state: options.beforeState ?? null,
      after_state: options.afterState ?? null,
      is_reversible: options.isReversible ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function buildRationale(
  skillMatch: number,
  trustMatch: number,
  skillGaps: string[],
  stepCount: number
): string {
  const parts: string[] = [];

  if (skillMatch >= 70) parts.push('Strong skill alignment');
  else if (skillMatch >= 40) parts.push('Partial skill match — growth opportunity');
  else parts.push('Skill-stretch mission — high learning potential');

  if (trustMatch >= 70) parts.push('high trust profile');
  else if (trustMatch >= 50) parts.push('developing trust profile');

  if (skillGaps.length) parts.push(`gaps: ${skillGaps.slice(0, 3).join(', ')}`);
  parts.push(`${stepCount}-step mission`);

  return parts.join('; ');
}
