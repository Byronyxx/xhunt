import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// GET /api/admin/missions/[id]/analytics — step drop-off data + raw progress
// rows for this mission, feeding the Behavioral Analyst agent panel.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: mission } = await admin
    .from('missions')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

  const [dropoffsRes, progressRes] = await Promise.all([
    admin.rpc('get_step_dropoffs', { p_mission_id: id }),
    admin.from('mission_progress').select('*').eq('mission_id', id),
  ]);

  if (dropoffsRes.error) return NextResponse.json({ error: dropoffsRes.error.message }, { status: 500 });
  if (progressRes.error) return NextResponse.json({ error: progressRes.error.message }, { status: 500 });

  return NextResponse.json({
    stepDropoffs: dropoffsRes.data ?? [],
    progressData: progressRes.data ?? [],
  });
}
