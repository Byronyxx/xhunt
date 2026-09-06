import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// POST /api/marketplace/apply — apply to a public marketplace listing.
// Looks up the listing's mission_id/tenant_id server-side (never trusts the
// client for these) and records the application under the caller's own user_id.
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const body = await req.json() as Record<string, unknown>;
  const listingId = body.listingId as string | undefined;
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (!listingId) {
    return NextResponse.json({ error: 'listingId is required.' }, { status: 400 });
  }

  const { data: listing, error: listingError } = await admin
    .from('marketplace_listings')
    .select('mission_id, tenant_id')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  const { data: application, error: insertError } = await admin
    .from('marketplace_applications')
    .insert({
      listing_id: listingId,
      mission_id: listing.mission_id,
      user_id: session.sub,
      tenant_id: listing.tenant_id,
      cover_note: note || null,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Preserve existing behavior: bump the listing's counter via the same RPC
  // the client used to call directly. Non-fatal if it errors.
  await admin.rpc('increment_listing_views', { p_listing_id: listingId });

  return NextResponse.json({ application });
}
