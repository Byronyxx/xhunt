import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getUserIdentity,
  issueCredential,
  verifySkill,
  exportIdentity,
  getCredentialByHash,
  type CredentialType,
  type ProficiencyLevel,
} from '@/lib/economy/identity';

// GET /api/economy/identity?userId=&verify=<hash>
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get('userId');
  const verifyHash = url.searchParams.get('verify');

  // Public: verify a credential by hash (no auth needed for read, but caller must be authed)
  if (verifyHash) {
    try {
      const credential = await getCredentialByHash(verifyHash);
      return NextResponse.json({
        valid: !credential.is_revoked && (!credential.valid_until || new Date(credential.valid_until) > new Date()),
        credential,
      });
    } catch {
      return NextResponse.json({ valid: false, credential: null });
    }
  }

  try {
    const supabase = createAdminClient();

    let profileId = targetUserId;
    if (!profileId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', session!.sub)
        .single();
      if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      profileId = profile.id;
    }

    const identity = await getUserIdentity(profileId!);
    return NextResponse.json({ identity });
  } catch (err) {
    console.error('[economy/identity GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/economy/identity  — issue a credential or verify a skill
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('id', session!.sub)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    if (action === 'issue_credential') {
      const { targetUserId, credentialType, title, description, payload, validUntil } = body;

      if (!targetUserId || !credentialType || !title || !payload) {
        return NextResponse.json({ error: 'targetUserId, credentialType, title, payload required' }, { status: 400 });
      }

      const credential = await issueCredential({
        userId: targetUserId,
        credentialType: credentialType as CredentialType,
        title,
        description,
        issuer: `peer:${profile.id}`,
        issuerUserId: profile.id,
        payload,
        validUntil,
      });

      return NextResponse.json({ credential }, { status: 201 });
    }

    if (action === 'verify_skill') {
      const { skillName, domain, proficiency, evidenceRefs, missionIds, contributionIds } = body;

      if (!skillName || !proficiency) {
        return NextResponse.json({ error: 'skillName and proficiency are required' }, { status: 400 });
      }

      const verification = await verifySkill({
        userId: profile.id,
        skillName,
        domain,
        proficiency: String(proficiency) as ProficiencyLevel,
        verifiedBy: 'self',
        evidenceRefs,
        missionIds,
        contributionIds,
      });

      return NextResponse.json({ verification }, { status: 201 });
    }

    if (action === 'export') {
      const { format, scopes } = body;

      if (!format) {
        return NextResponse.json({ error: 'format is required' }, { status: 400 });
      }

      const result = await exportIdentity(
        profile.id,
        format,
        scopes ?? ['credentials', 'skills', 'contributions']
      );

      return NextResponse.json({ export: result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[economy/identity POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
