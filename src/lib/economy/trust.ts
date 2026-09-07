import { createAdminClient } from '@/lib/supabase/admin';

export type TrustDimension = 'skill' | 'reliability' | 'ethical' | 'domain';

export type TrustEventType =
  | 'mission_completed_together'
  | 'peer_validation_given'
  | 'peer_validation_received'
  | 'outcome_verified'
  | 'dispute_raised'
  | 'dispute_resolved'
  | 'contribution_endorsed'
  | 'collaboration_success'
  | 'collaboration_failure'
  | 'manual_adjustment';

export interface TrustProfile {
  compositeScore: number;
  skillScore: number;
  reliabilityScore: number;
  ethicalScore: number;
  domainScore: number;
  graphSize: number;
  topContexts: Array<{ context: string; score: number }>;
}

// Deltas applied per event type (calibrated to keep scores meaningful over time)
const EVENT_DELTAS: Record<TrustEventType, Partial<Record<TrustDimension, number>>> = {
  mission_completed_together:  { reliability: 3,  skill: 2 },
  peer_validation_given:       { reliability: 1 },
  peer_validation_received:    { skill: 2,        reliability: 1 },
  outcome_verified:            { skill: 3,        domain: 2 },
  dispute_raised:              { reliability: -5, ethical: -3 },
  dispute_resolved:            { ethical: 2,      reliability: 1 },
  contribution_endorsed:       { skill: 2,        domain: 1 },
  collaboration_success:       { reliability: 4,  skill: 2 },
  collaboration_failure:       { reliability: -3 },
  manual_adjustment:           {},
};

export async function recordTrustEvent(
  trustorId: string,
  trusteeId: string,
  eventType: TrustEventType,
  options: {
    context?: string;
    missionId?: string;
    contributionId?: string;
    reason?: string;
    manualDeltas?: Partial<Record<TrustDimension, number>>;
  } = {}
) {
  const supabase = createAdminClient();
  const deltas = eventType === 'manual_adjustment'
    ? options.manualDeltas ?? {}
    : EVENT_DELTAS[eventType];

  const inserts = Object.entries(deltas).map(([dimension, delta]) => ({
    trustor_id: trustorId,
    trustee_id: trusteeId,
    dimension: dimension as TrustDimension,
    context: options.context ?? null,
    event_type: eventType,
    delta,
    reason: options.reason ?? null,
    mission_id: options.missionId ?? null,
    contribution_id: options.contributionId ?? null,
  }));

  if (!inserts.length) return [];

  const { data, error } = await supabase
    .from('trust_events')
    .insert(inserts)
    .select();

  if (error) throw error;
  return data;
}

export async function getTrustProfile(userId: string): Promise<TrustProfile | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('trust_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  if (data) {
    return {
      compositeScore:  data.composite_score,
      skillScore:      data.skill_score,
      reliabilityScore: data.reliability_score,
      ethicalScore:    data.ethical_score,
      domainScore:     data.domain_score,
      graphSize:       data.trust_graph_size,
      topContexts:     data.top_contexts ?? [],
    };
  }

  // Compute on the fly from raw scores if profile not yet materialized
  const { data: scores } = await supabase
    .from('trust_scores')
    .select('dimension, score')
    .eq('trustee_id', userId);

  if (!scores?.length) return null;

  type ScoreRow = { dimension: string; score: number };
  const avg = (dim: TrustDimension) => {
    const filtered = (scores as ScoreRow[]).filter((s) => s.dimension === dim);
    return filtered.length
      ? filtered.reduce((acc: number, s: ScoreRow) => acc + s.score, 0) / filtered.length
      : 50;
  };

  const skill       = avg('skill');
  const reliability = avg('reliability');
  const ethical     = avg('ethical');
  const domain      = avg('domain');
  const composite   = skill * 0.30 + reliability * 0.35 + ethical * 0.25 + domain * 0.10;

  return {
    compositeScore:  Math.round(composite * 100) / 100,
    skillScore:      Math.round(skill * 100) / 100,
    reliabilityScore: Math.round(reliability * 100) / 100,
    ethicalScore:    Math.round(ethical * 100) / 100,
    domainScore:     Math.round(domain * 100) / 100,
    graphSize:       new Set(scores.map(() => 'trustor')).size,
    topContexts:     [],
  };
}

export async function getTrustGraph(
  userId: string,
  options: { limit?: number; dimension?: TrustDimension; minScore?: number } = {}
) {
  const supabase = createAdminClient();

  let query = supabase
    .from('trust_scores')
    .select('trustor_id, trustee_id, dimension, context, score, evidence_count, updated_at')
    .or(`trustor_id.eq.${userId},trustee_id.eq.${userId}`)
    .order('score', { ascending: false })
    .limit(options.limit ?? 50);

  if (options.dimension) query = query.eq('dimension', options.dimension);
  if (options.minScore)  query = query.gte('score', options.minScore);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function addTrustAnchor(
  userId: string,
  platform: string,
  platformId: string,
  trustSignal: string,
  signalWeight: number,
  metadata: Record<string, unknown> = {}
) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('trust_anchors')
    .upsert({
      user_id: userId,
      platform,
      platform_id: platformId,
      trust_signal: trustSignal,
      signal_weight: signalWeight,
      verified_at: new Date().toISOString(),
      metadata,
    }, { onConflict: 'user_id,platform,platform_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
