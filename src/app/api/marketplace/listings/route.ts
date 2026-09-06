import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/marketplace/listings — public, unauthenticated. Lists all active
// marketplace listings with their mission + tenant info, for the marketing
// marketplace page. No session/tenant scoping: this is intentionally public.
export async function GET() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('marketplace_listings')
    .select(`
      *,
      mission:missions!mission_id (
        id, title, story_context, difficulty, estimated_time, tags, reward,
        tenant:tenants!tenant_id ( name, logo_url, slug )
      )
    `)
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .order('apply_count', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ listings: data ?? [] });
}
