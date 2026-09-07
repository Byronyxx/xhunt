import { createAdminClient } from '@/lib/supabase/admin';

export type ContributionType =
  | 'work_output'
  | 'knowledge_creation'
  | 'coordination_effort'
  | 'creative_innovation'
  | 'community_contribution'
  | 'ai_assisted_creation';

export type AIRole = 'none' | 'assisted' | 'co_created' | 'ai_primary';

export interface RecordContributionInput {
  userId: string;
  tenantId?: string;
  missionId?: string;
  contributionType: ContributionType;
  title: string;
  description?: string;
  valuePoints: number;
  impactWeight?: number;
  aiRole?: AIRole;
  aiModel?: string;
  metadata?: Record<string, unknown>;
  collaborators?: Array<{ userId: string; role: string; weight: number }>;
}

export interface ContributionSummary {
  totalPoints: number;
  totalContributions: number;
  byType: Record<string, number>;
  topDomains: Array<{ domain: string; points: number }>;
  avgConfidence: number | null;
  aiCollaborationPct: number | null;
}

function generateVerificationHash(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
  issuedAt: string
): string {
  const data = `${userId}|${type}|${JSON.stringify(payload)}|${issuedAt}`;
  // djb2 double-pass — 64-bit deterministic hash (no Node globals required)
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    h1 = Math.imul(31, h1) ^ c;
    h2 = Math.imul(31, h2) ^ c;
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export async function recordContribution(input: RecordContributionInput) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const hash = generateVerificationHash(
    input.userId,
    input.contributionType,
    { title: input.title, valuePoints: input.valuePoints },
    now
  );

  const { data: contribution, error } = await supabase
    .from('contribution_ledger')
    .insert({
      user_id: input.userId,
      tenant_id: input.tenantId ?? null,
      mission_id: input.missionId ?? null,
      contribution_type: input.contributionType,
      title: input.title,
      description: input.description ?? null,
      value_points: input.valuePoints,
      impact_weight: input.impactWeight ?? 1.0,
      ai_role: input.aiRole ?? 'none',
      ai_model: input.aiModel ?? null,
      metadata: input.metadata ?? {},
      verification_hash: hash,
    })
    .select()
    .single();

  if (error) throw error;

  // Record attributions
  if (input.collaborators?.length) {
    const attributions = input.collaborators.map((c) => ({
      contribution_id: contribution.id,
      contributor_id: c.userId,
      role: c.role,
      weight: c.weight,
    }));
    await supabase.from('contribution_attribution').insert(attributions);
  }

  return contribution;
}

export async function getUserContributions(userId: string, limit = 20, offset = 0) {
  const supabase = createAdminClient();

  const { data, error, count } = await supabase
    .from('contribution_ledger')
    .select('*, contribution_attribution(*)', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { contributions: data, total: count ?? 0 };
}

export async function getContributionSummary(userId: string): Promise<ContributionSummary | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('contribution_summaries')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  return {
    totalPoints: data.total_points,
    totalContributions: data.total_contributions,
    byType: data.by_type ?? {},
    topDomains: data.top_domains ?? [],
    avgConfidence: data.avg_confidence,
    aiCollaborationPct: data.ai_collaboration_pct,
  };
}

export async function validateContribution(
  contributionId: string,
  validatorId: string,
  verdict: 'approved' | 'rejected' | 'needs_revision',
  note?: string,
  confidencePct?: number
) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('contribution_validations')
    .insert({
      contribution_id: contributionId,
      validator_id: validatorId,
      verdict,
      note: note ?? null,
      confidence_pct: confidencePct ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  // Increment peer_validations count
  await supabase.rpc('increment_contribution_validations', { contribution_uuid: contributionId });

  return data;
}

// Compute impact-weighted contribution score for ranking/matching
export function computeWeightedScore(
  valuePoints: number,
  impactWeight: number,
  confidenceScore: number | null,
  peerValidations: number
): number {
  const confidence = (confidenceScore ?? 50) / 100;
  const validationBonus = Math.min(peerValidations * 0.05, 0.25); // max 25% bonus
  return Math.round(valuePoints * impactWeight * confidence * (1 + validationBonus));
}
