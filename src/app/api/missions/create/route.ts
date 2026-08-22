import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// POST /api/missions/create
// Server-side replacement for the old client-side `supabase.from('missions').insert(...)`
// call in workspace/missions/new. That call depended on Postgres RLS resolving
// auth.uid() from our custom JWT, which Supabase doesn't reliably recognize
// (see migration 029 / src/app/api/workspace/create/route.ts for the same
// class of bug). We verify identity locally instead and use the admin
// client, then enforce the same role check the RLS policy was supposed to.

const CREATOR_ROLES = new Set(['mission_creator', 'tenant_admin', 'platform_admin']);

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from('user_profiles')
    .select('tenant_id, role')
    .eq('id', session.sub)
    .single();

  if (profileErr || !profile?.tenant_id) {
    return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  }

  if (!CREATOR_ROLES.has(profile.role)) {
    return NextResponse.json({ error: 'You do not have permission to create missions.' }, { status: 403 });
  }

  const body = await req.json();
  const {
    title, story, difficulty, estimatedTime, steps, reward, tags,
    status, isPublic, locationType, locationCity, locationLat, locationLng, locationRadius,
  } = body as {
    title: string; story: string; difficulty: string; estimatedTime: string;
    steps: unknown; reward: string; tags: string[]; status: 'draft' | 'active';
    isPublic: boolean; locationType: string; locationCity: string;
    locationLat: number | null; locationLng: number | null; locationRadius: number;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Mission title is required.' }, { status: 400 });
  }

  const { data, error: dbErr } = await admin.from('missions').insert({
    tenant_id: profile.tenant_id,
    created_by: session.sub,
    title: title.trim(),
    story_context: story?.trim() || null,
    difficulty,
    estimated_time: estimatedTime || null,
    steps,
    reward: reward?.trim() || 'Mission completion badge',
    tags: tags ?? [],
    status,
    is_public: !!isPublic,
    location_type: locationType,
    location_city: locationCity?.trim() || null,
    lat: locationLat,
    lng: locationLng,
    radius_km: locationType !== 'remote' ? locationRadius : null,
  }).select('id').single();

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
