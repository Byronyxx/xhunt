import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  recordTrustEvent,
  getTrustProfile,
  getTrustGraph,
  addTrustAnchor,
  type TrustDimension,
  type TrustEventType,
} from '@/lib/economy/trust';

// GET /api/economy/trust?userId=&graph=true&dimension=skill&minScore=60
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get('userId');
  const includeGraph = url.searchParams.get('graph') === 'true';
  const dimension = url.searchParams.get('dimension') as TrustDimension | null;
  const minScore = url.searchParams.get('minScore') ? parseInt(url.searchParams.get('minScore')!, 10) : undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

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

    const [trustProfile, graph] = await Promise.all([
      getTrustProfile(profileId!),
      includeGraph ? getTrustGraph(profileId!, { limit, dimension: dimension ?? undefined, minScore }) : Promise.resolve([]),
    ]);

    return NextResponse.json({ trustProfile, graph: includeGraph ? graph : undefined });
  } catch (err) {
    console.error('[economy/trust GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/economy/trust  — record a trust event
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { trusteeId, eventType, context, missionId, contributionId, reason, manualDeltas } = body;

    if (!trusteeId || !eventType) {
      return NextResponse.json({ error: 'trusteeId and eventType are required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', session!.sub)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    if (profile.id === trusteeId) {
      return NextResponse.json({ error: 'Cannot record trust event for yourself' }, { status: 400 });
    }

    const events = await recordTrustEvent(profile.id, trusteeId, eventType as TrustEventType, {
      context,
      missionId,
      contributionId,
      reason,
      manualDeltas,
    });

    return NextResponse.json({ events }, { status: 201 });
  } catch (err) {
    console.error('[economy/trust POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/economy/trust  — add a cross-platform trust anchor
export async function PUT(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { platform, platformId, trustSignal, signalWeight, metadata } = body;

    if (!platform || !platformId || !trustSignal) {
      return NextResponse.json({ error: 'platform, platformId, and trustSignal are required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', session!.sub)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const anchor = await addTrustAnchor(
      profile.id,
      platform,
      platformId,
      trustSignal,
      signalWeight ?? 0.5,
      metadata ?? {}
    );

    return NextResponse.json({ anchor }, { status: 201 });
  } catch (err) {
    console.error('[economy/trust PUT]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
