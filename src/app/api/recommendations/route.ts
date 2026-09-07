import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import { proximityBoost } from '@/lib/proximity';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const currentMissionId = searchParams.get('mission_id');
  const limitParam = searchParams.get('limit');
  const limit = Math.min(parseInt(limitParam ?? '5', 10), 20);
  const userLat = parseFloat(searchParams.get('lat') ?? '');
  const userLng = parseFloat(searchParams.get('lng') ?? '');
  const userCoords = !isNaN(userLat) && !isNaN(userLng) ? { lat: userLat, lng: userLng } : null;

  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createAdminClient();

  const { data: profile } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.sub).single();
  if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });
  const tid = profile.tenant_id;

  // Load all active missions + their scores (include location fields)
  const [missionsRes, scoresRes, progressRes] = await Promise.all([
    supabase.from('missions')
      .select('id, title, difficulty, estimated_time, tags, story_context, reward, location_type, lat, lng')
      .eq('tenant_id', tid)
      .in('status', ['active', 'published']),
    supabase.from('mission_scores')
      .select('mission_id, mei, completion_score, engagement_score')
      .eq('tenant_id', tid),
    supabase.from('mission_progress')
      .select('mission_id')
      .eq('user_id', session.sub)
      .not('completed_at', 'is', null),
  ]);

  const missions = missionsRes.data ?? [];
  const scores = scoresRes.data ?? [];
  const completedMissionIds = new Set((progressRes.data ?? []).map((p: { mission_id: string }) => p.mission_id));

  const scoreMap = new Map(scores.map((s) => [s.mission_id, s]));
  const candidates = missions.filter((m) => !completedMissionIds.has(m.id) && m.id !== currentMissionId);

  // KG edge boost for contextual recommendations
  const kgBoost: Map<string, number> = new Map();
  if (currentMissionId) {
    const { data: edges } = await supabase
      .from('kg_edges')
      .select('from_node_id, to_node_id, weight')
      .or(`from_node_id.eq.${currentMissionId},to_node_id.eq.${currentMissionId}`);

    if (edges) {
      for (const edge of edges as { from_node_id: string; to_node_id: string; weight: number }[]) {
        const relatedId = edge.from_node_id === currentMissionId ? edge.to_node_id : edge.from_node_id;
        kgBoost.set(relatedId, Math.max(kgBoost.get(relatedId) ?? 0, edge.weight ?? 1));
      }
    }
  }

  // Score: MEI (0-100) + KG boost (0-20) + proximity boost (0-30) = max 150, normalised
  const ranked = candidates
    .map((m) => {
      const s = scoreMap.get(m.id);
      const mei  = s?.mei ?? 0;
      const kg   = (kgBoost.get(m.id) ?? 0) * 20;
      const prox = userCoords && m.lat != null && m.lng != null
        ? proximityBoost({ lat: m.lat, lng: m.lng }, userCoords)
        : 0;
      const score = (mei + kg + prox) / 150;
      return { ...m, score, mei, prox };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, mei, prox, lat, lng, ...m }) => ({
      ...m,
      confidence_pct: Math.round(Math.min(score * 100, 99)),
      mei_score: Math.round(mei),
      reason: prox > 0
        ? 'Near your location'
        : kgBoost.has(m.id)
          ? 'Knowledge graph match'
          : 'High completion rate',
    }));

  return NextResponse.json({ recommendations: ranked, total_candidates: candidates.length });
}
