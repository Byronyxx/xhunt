import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const LISTING_FIELDS = [
  'tagline', 'highlight', 'listing_type', 'price_cents', 'category',
  'sdg_goals', 'required_skills', 'status',
] as const;

// PATCH /api/workspace/marketplace/listings/[id] — update a listing owned by
// the caller's tenant (covers both the full edit form and the quick
// active/paused status toggle).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
  const updates: Record<string, unknown> = {};
  for (const field of LISTING_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  if (updates.listing_type !== undefined && updates.listing_type !== 'paid') {
    updates.price_cents = 0;
  }
  if (updates.status !== undefined) {
    updates.published_at = updates.status === 'active' ? new Date().toISOString() : null;
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from('marketplace_listings')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

  return NextResponse.json({ listing: data });
}

// DELETE /api/workspace/marketplace/listings/[id] — tenant-scoped delete.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const { data, error } = await admin
    .from('marketplace_listings')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

  return NextResponse.json({ deleted: data.id });
}
