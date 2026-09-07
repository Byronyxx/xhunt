import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import { getUserTierInfo } from '@/lib/freemium';

interface StartLiveBody {
  title:        string;
  description?: string;
  mission_id?:  string;
  is_pro_only?: boolean;
  scheduled_for?: string;
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  // Go Live requires Pro tier
  const tierInfo = await getUserTierInfo(session.sub);
  if (tierInfo.tier !== 'pro') {
    return NextResponse.json({
      error:    'pro_required',
      message:  'Hosting live sessions requires a Pro subscription.',
      upgrade_url: '/upgrade',
    }, { status: 402 });
  }

  let body: StartLiveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, mission_id, is_pro_only = false, scheduled_for } = body;
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  // If a mission is linked, fetch its step count
  let totalSteps = 1;
  if (mission_id) {
    const { data: mission } = await sb
      .from('missions')
      .select('steps')
      .eq('id', mission_id)
      .single();
    if (mission) {
      const steps = (mission as { steps: unknown[] }).steps;
      totalSteps = Array.isArray(steps) ? steps.length : 1;
    }
  }

  const now = new Date().toISOString();
  const isImmediate = !scheduled_for;

  const { data, error } = await sb
    .from('live_sessions')
    .insert({
      host_id:       session.sub,
      mission_id:    mission_id || null,
      title:         title.trim(),
      description:   description?.trim() || null,
      status:        isImmediate ? 'live' : 'scheduled',
      total_steps:   totalSteps,
      is_pro_only,
      started_at:    isImmediate ? now : null,
      scheduled_for: scheduled_for || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[api/live/start]', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: isImmediate ? 'live' : 'scheduled' }, { status: 201 });
}
