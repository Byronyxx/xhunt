import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let auth;
  try {
    auth = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  // Fetch session to verify host and check bounds
  const { data: liveSession } = await sb
    .from('live_sessions')
    .select('host_id, current_step_index, total_steps, status')
    .eq('id', id)
    .single();

  if (!liveSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (liveSession.host_id !== auth.sub) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (liveSession.status !== 'live') return NextResponse.json({ error: 'Session is not live' }, { status: 409 });

  const nextIndex = liveSession.current_step_index + 1;
  if (nextIndex >= liveSession.total_steps) {
    return NextResponse.json({ error: 'Already at last step' }, { status: 409 });
  }

  const { error } = await sb
    .from('live_sessions')
    .update({ current_step_index: nextIndex })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  return NextResponse.json({ current_step_index: nextIndex });
}
