import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// GET /api/workspace/marketplace — this tenant's listings, eligible missions,
// and all applications against those listings.
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', session.sub)
    .single();

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });

  const [listingsRes, missionsRes, appsRes] = await Promise.all([
    admin
      .from('marketplace_listings')
      .select('*, mission:missions!mission_id(id,title,difficulty,tags,reward,status)')
      .eq('tenant_id', profile.tenant_id)
      .order('updated_at', { ascending: false }),
    admin
      .from('missions')
      .select('id,title,difficulty,tags,reward,status')
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'published'),
    admin
      .from('marketplace_applications')
      .select('*, user_profile:user_profiles!user_id(display_name,email,avatar_url)')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false }),
  ]);

  if (listingsRes.error) return NextResponse.json({ error: listingsRes.error.message }, { status: 500 });
  if (missionsRes.error) return NextResponse.json({ error: missionsRes.error.message }, { status: 500 });
  if (appsRes.error) return NextResponse.json({ error: appsRes.error.message }, { status: 500 });

  return NextResponse.json({
    listings: listingsRes.data ?? [],
    missions: missionsRes.data ?? [],
    applications: appsRes.data ?? [],
  });
}

// POST /api/workspace/marketplace — create a new listing for this tenant.
// mission_id is validated against the caller's own tenant before use.
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', session.sub)
    .single();

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;
  const missionId = body.mission_id as string | undefined;

  if (!missionId) {
    return NextResponse.json({ error: 'mission_id is required.' }, { status: 400 });
  }

  // Validate the mission belongs to the caller's own tenant.
  const { data: mission } = await admin
    .from('missions')
    .select('id')
    .eq('id', missionId)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (!mission) {
    return NextResponse.json({ error: 'Mission not found in your organization.' }, { status: 400 });
  }

  const {
    tagline,
    highlight,
    listing_type,
    price_cents,
    category,
    sdg_goals,
    required_skills,
    status,
  } = body;

  const { data, error } = await admin
    .from('marketplace_listings')
    .insert({
      tenant_id: profile.tenant_id,
      mission_id: missionId,
      tagline,
      highlight: highlight ?? null,
      listing_type,
      price_cents: listing_type === 'paid' ? (price_cents ?? 0) : 0,
      category: category || null,
      sdg_goals: sdg_goals ?? [],
      required_skills: required_skills ?? [],
      status,
      published_at: status === 'active' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ listing: data });
}
