import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// GET /api/workspace/missions
// Same fix pattern used across the workspace API — verify identity locally
// instead of relying on sb.auth.getUser(), which can't reliably recognize
// our custom-signed JWTs, and use the admin client (with explicit tenant
// scoping) instead of RLS.

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

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No organization found.' }, { status: 400 });
  }

  const [missionsRes, progressRes, scoresRes] = await Promise.all([
    admin.from('missions').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }),
    admin.from('mission_progress').select('mission_id, user_id, completed_at').eq('tenant_id', profile.tenant_id),
    admin.from('mission_scores').select('mission_id, mei').eq('tenant_id', profile.tenant_id),
  ]);

  if (missionsRes.error) {
    return NextResponse.json({ error: missionsRes.error.message }, { status: 500 });
  }

  const completionMap: Record<string, number> = {};
  const participantMap: Record<string, Set<string>> = {};
  (progressRes.data ?? []).forEach((p) => {
    if (p.completed_at) completionMap[p.mission_id] = (completionMap[p.mission_id] ?? 0) + 1;
    if (!participantMap[p.mission_id]) participantMap[p.mission_id] = new Set();
    participantMap[p.mission_id].add(p.user_id);
  });

  const meiMap: Record<string, number> = {};
  (scoresRes.data ?? []).forEach((s) => { meiMap[s.mission_id] = s.mei; });

  const missions = (missionsRes.data ?? []).map((m) => ({
    ...m,
    completions: completionMap[m.id] ?? 0,
    participants: participantMap[m.id]?.size ?? 0,
    mei: meiMap[m.id] ?? null,
  }));

  return NextResponse.json({ missions });
}
