import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import {
  recordContribution,
  getUserContributions,
  getContributionSummary,
  validateContribution,
  type ContributionType,
  type AIRole,
} from '@/lib/economy/contribution';

// GET /api/economy/contributions?userId=&limit=&offset=&summary=true
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get('userId');
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const summaryOnly = url.searchParams.get('summary') === 'true';

  try {
    const supabase = await createClient();

    // Resolve profile id from session if not provided
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

    if (summaryOnly) {
      const summary = await getContributionSummary(profileId!);
      return NextResponse.json({ summary });
    }

    const { contributions, total } = await getUserContributions(profileId!, limit, offset);
    return NextResponse.json({ contributions, total, limit, offset });
  } catch (err) {
    console.error('[economy/contributions GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/economy/contributions
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, tenant_id')
      .eq('id', session!.sub)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const {
      missionId,
      contributionType,
      title,
      description,
      valuePoints,
      impactWeight,
      aiRole,
      aiModel,
      metadata,
      collaborators,
    } = body;

    if (!contributionType || !title || valuePoints == null) {
      return NextResponse.json({ error: 'contributionType, title, and valuePoints are required' }, { status: 400 });
    }

    const contribution = await recordContribution({
      userId: profile.id,
      tenantId: profile.tenant_id ?? undefined,
      missionId: missionId ?? undefined,
      contributionType: contributionType as ContributionType,
      title,
      description,
      valuePoints: Math.max(0, parseInt(String(valuePoints), 10)),
      impactWeight: impactWeight ?? 1.0,
      aiRole: (aiRole ?? 'none') as AIRole,
      aiModel,
      metadata,
      collaborators,
    });

    return NextResponse.json({ contribution }, { status: 201 });
  } catch (err) {
    console.error('[economy/contributions POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/economy/contributions (validate a contribution)
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { contributionId, verdict, note, confidencePct } = body;

    if (!contributionId || !verdict) {
      return NextResponse.json({ error: 'contributionId and verdict are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', session!.sub)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const validation = await validateContribution(contributionId, profile.id, verdict, note, confidencePct);
    return NextResponse.json({ validation });
  } catch (err) {
    console.error('[economy/contributions PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
