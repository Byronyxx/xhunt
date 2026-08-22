import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

export async function POST(
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

  const { data: liveSession } = await sb
    .from('live_sessions')
    .select('host_id, status')
    .eq('id', id)
    .single();

  if (!liveSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (liveSession.host_id !== auth.sub) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (liveSession.status === 'ended') return NextResponse.json({ message: 'Already ended' });

  const { error } = await sb
    .from('live_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  return NextResponse.json({ ended: true });
}
