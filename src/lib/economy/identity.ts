import { createAdminClient } from '@/lib/supabase/admin';

export type CredentialType =
  | 'skill'
  | 'outcome'
  | 'contribution'
  | 'community_role'
  | 'cross_platform'
  | 'educational'
  | 'professional';

export type ProficiencyLevel = '1' | '2' | '3' | '4' | '5';

export interface IssueCredentialInput {
  userId: string;
  credentialType: CredentialType;
  title: string;
  description?: string;
  issuer: string;
  issuerUserId?: string;
  payload: Record<string, unknown>;
  validUntil?: string;
}

export interface SkillVerificationInput {
  userId: string;
  skillName: string;
  domain?: string;
  proficiency: ProficiencyLevel;
  verifiedBy: string;
  verifierUserId?: string;
  evidenceRefs?: Array<{ type: string; url?: string; description: string }>;
  missionIds?: string[];
  contributionIds?: string[];
}

function buildVerificationHash(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
  issuedAt: string
): string {
  const data = `${userId}|${type}|${JSON.stringify(payload)}|${issuedAt}`;
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    h1 = Math.imul(31, h1) ^ c;
    h2 = Math.imul(31, h2) ^ c;
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export async function issueCredential(input: IssueCredentialInput) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const hash = buildVerificationHash(input.userId, input.credentialType, input.payload, now);

  const { data, error } = await supabase
    .from('identity_credentials')
    .insert({
      user_id: input.userId,
      credential_type: input.credentialType,
      title: input.title,
      description: input.description ?? null,
      issuer: input.issuer,
      issuer_user_id: input.issuerUserId ?? null,
      payload: input.payload,
      verification_hash: hash,
      issued_at: now,
      valid_until: input.validUntil ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function verifySkill(input: SkillVerificationInput) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('skill_verifications')
    .upsert({
      user_id: input.userId,
      skill_name: input.skillName,
      domain: input.domain ?? null,
      proficiency: input.proficiency,
      verified_by: input.verifiedBy,
      verifier_user_id: input.verifierUserId ?? null,
      evidence_count: input.evidenceRefs?.length ?? 0,
      evidence_refs: input.evidenceRefs ?? [],
      mission_ids: input.missionIds ?? [],
      contribution_ids: input.contributionIds ?? [],
      verified_at: new Date().toISOString(),
    }, { onConflict: 'user_id,skill_name,verified_by' })
    .select()
    .single();

  if (error) throw error;

  // Issue a credential for this verified skill
  await issueCredential({
    userId: input.userId,
    credentialType: 'skill',
    title: `Verified Skill: ${input.skillName}`,
    description: input.domain ? `Domain: ${input.domain}` : undefined,
    issuer: input.verifiedBy === 'peer' ? `peer:${input.verifierUserId}` : `xhunt:${input.verifiedBy}`,
    issuerUserId: input.verifierUserId,
    payload: {
      skill: input.skillName,
      domain: input.domain,
      proficiency: input.proficiency,
      evidence_count: input.evidenceRefs?.length ?? 0,
    },
  });

  return data;
}

export async function getUserIdentity(userId: string) {
  const supabase = createAdminClient();

  const [profileRes, credentialsRes, skillsRes, didRes, summaryRes] = await Promise.all([
    supabase.from('user_profiles').select('id,display_name,email,bio,location_city,location_country,interests,xp_balance,missions_completed').eq('id', userId).single(),
    supabase.from('identity_credentials').select('*').eq('user_id', userId).eq('is_revoked', false).order('issued_at', { ascending: false }),
    supabase.from('skill_verifications').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('identity_dids').select('did,did_doc').eq('user_id', userId).single(),
    supabase.from('contribution_summaries').select('total_points,total_contributions,by_type').eq('user_id', userId).single(),
  ]);

  return {
    profile: profileRes.data,
    credentials: credentialsRes.data ?? [],
    skills: skillsRes.data ?? [],
    did: didRes.data?.did ?? null,
    didDoc: didRes.data?.did_doc ?? null,
    contributionSummary: summaryRes.data ?? null,
  };
}

export async function exportIdentity(
  userId: string,
  format: 'json' | 'did_document' | 'verifiable_presentation' | 'pdf_report',
  scopes: string[]
) {
  const supabase = createAdminClient();
  const identity = await getUserIdentity(userId);

  let payload: Record<string, unknown> = {};

  if (format === 'verifiable_presentation') {
    const { data } = await supabase.rpc('get_verifiable_presentation', { p_user_id: userId });
    payload = data ?? {};
  } else if (format === 'did_document') {
    payload = {
      '@context': 'https://www.w3.org/ns/did/v1',
      id: identity.did ?? `did:xhunt:${userId}`,
      ...(identity.didDoc ?? {}),
    };
  } else {
    // json / pdf_report
    payload = {
      identity: identity.profile,
      credentials: scopes.includes('credentials') ? identity.credentials : [],
      skills: scopes.includes('skills') ? identity.skills : [],
      contributions: scopes.includes('contributions') ? identity.contributionSummary : null,
      exported_at: new Date().toISOString(),
    };
  }

  const payloadStr = JSON.stringify(payload);
  let ph1 = 5381, ph2 = 52711;
  for (let i = 0; i < payloadStr.length; i++) {
    const c = payloadStr.charCodeAt(i);
    ph1 = Math.imul(31, ph1) ^ c;
    ph2 = Math.imul(31, ph2) ^ c;
  }
  const payloadHash = `${(ph1 >>> 0).toString(16).padStart(8, '0')}${(ph2 >>> 0).toString(16).padStart(8, '0')}`;

  await supabase.from('identity_exports').insert({
    user_id: userId,
    export_format: format,
    included_scopes: scopes,
    payload_hash: payloadHash,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { format, payload, payloadHash };
}

export async function getCredentialByHash(hash: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('identity_credentials')
    .select('*')
    .eq('verification_hash', hash)
    .single();
  if (error) throw error;
  return data;
}
