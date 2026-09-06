import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

const VALID_STATUSES = new Set(['pending', 'accepted', 'rejected', 'withdrawn']);

// PATCH /api/workspace/marketplace/applications/[id] — accept/decline an
// application against one of the caller's tenant's listings.
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

  const { status } = await req.json() as { status: string };
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('marketplace_applications')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  return NextResponse.json({ application: data });
}
