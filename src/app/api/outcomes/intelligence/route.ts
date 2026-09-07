import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import { CATEGORY_MAP } from '@/lib/missionCategories';

const TAG_TO_CAT: Record<string, string> = {
  tech: 'tech', 'tech-ai': 'tech', software: 'tech', digital: 'tech',
  climate: 'climate', environment: 'climate', sustainability: 'climate', green: 'climate',
  education: 'education', learning: 'education', teaching: 'education', training: 'education',
  health: 'health', fitness: 'health', wellness: 'health', medical: 'health',
  community: 'community', social: 'community', adventure: 'community', travel: 'community',
  civic: 'civic-tech', 'civic-tech': 'civic-tech', policy: 'civic-tech',
  food: 'food-systems', 'food-systems': 'food-systems', nutrition: 'food-systems',
  art: 'arts', arts: 'arts', creative: 'arts', design: 'arts',
  urban: 'urban', city: 'urban', infrastructure: 'urban',
  water: 'water', ocean: 'water', marine: 'water',
  equity: 'social-equity', inclusion: 'social-equity', diversity: 'social-equity',
  circular: 'circular', recycling: 'circular', waste: 'circular',
  work: 'future-of-work', career: 'future-of-work', skills: 'future-of-work',
  mindful: 'health', mental: 'health', mindfulness: 'health',
  research: 'tech',
};

type MissionHealth = 'healthy' | 'at-risk' | 'critical' | 'inactive';

function computeHealth(status: string, participants: number, completions: number, mei: number): MissionHealth {
  if (status !== 'active' && status !== 'published') return 'inactive';
  if (participants === 0) return 'critical';
  const rate = completions / participants;
  if (mei >= 65 && rate >= 0.5) return 'healthy';
  if (mei >= 35 || rate >= 0.25) return 'at-risk';
  return 'critical';
}

export async function GET(req: NextRequest) {
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

  const [missionsRes, scoresRes, progressRes] = await Promise.all([
    supabase.from('missions').select('id, title, tags, steps, status, difficulty').eq('tenant_id', tid),
    supabase.from('mission_scores').select('*').eq('tenant_id', tid),
    supabase.from('mission_progress').select('mission_id, user_id, completed_at').eq('tenant_id', tid),
  ]);

  const missions  = missionsRes.data  ?? [];
  const scores    = scoresRes.data    ?? [];
  const progress  = progressRes.data  ?? [];

  const scoreMap: Record<string, typeof scores[0]> = {};
  scores.forEach((s) => { scoreMap[s.mission_id] = s; });

  const completionMap: Record<string, number> = {};
  const participantMap: Record<string, Set<string>> = {};
  progress.forEach((p) => {
    if (p.completed_at) completionMap[p.mission_id] = (completionMap[p.mission_id] ?? 0) + 1;
    if (!participantMap[p.mission_id]) participantMap[p.mission_id] = new Set();
    participantMap[p.mission_id].add(p.user_id);
  });

  const catCounts: Record<string, number> = {};
  const sdgCounts: Record<number, number> = {};

  const missionData = missions.map((m) => {
    const completions  = completionMap[m.id]  ?? 0;
    const participants = participantMap[m.id]?.size ?? 0;
    const score        = scoreMap[m.id];
    const mei          = score?.mei ?? 0;
    const completionRate = participants > 0 ? Math.round((completions / participants) * 100) : 0;
    const health = computeHealth(m.status, participants, completions, mei);

    const missionSdgs: number[] = [];
    const missionCats: string[] = [];
    for (const tag of (m.tags as string[])) {
      const catId = TAG_TO_CAT[tag.toLowerCase()];
      if (catId && !missionCats.includes(catId)) {
        missionCats.push(catId);
        catCounts[catId] = (catCounts[catId] ?? 0) + 1;
        const cat = CATEGORY_MAP.get(catId);
        if (cat) {
          for (const sdg of cat.sdgs) {
            if (!missionSdgs.includes(sdg as number)) {
              missionSdgs.push(sdg as number);
              sdgCounts[sdg as number] = (sdgCounts[sdg as number] ?? 0) + 1;
            }
          }
        }
      }
    }

    return {
      id: m.id, title: m.title, tags: m.tags, status: m.status, difficulty: m.difficulty,
      stepCount: (m.steps as unknown[]).length,
      completions, participants, completionRate, health, sdgs: missionSdgs, categories: missionCats,
      score: score ? { mei: score.mei, completion_score: score.completion_score, engagement_score: score.engagement_score, retention_score: score.retention_score, outcome_score: score.outcome_score } : undefined,
    };
  });

  const sorted = [...missionData].sort((a, b) => (b.score?.mei ?? 0) - (a.score?.mei ?? 0));

  const totalParticipants = new Set(progress.map((p) => p.user_id)).size;
  const totalCompletions  = Object.values(completionMap).reduce((s, v) => s + v, 0);
  const avgMei = scores.length ? Math.round(scores.reduce((s, sc) => s + (sc.mei ?? 0), 0) / scores.length) : 0;
  const overallCompletionRate = progress.length ? Math.round((totalCompletions / progress.length) * 100) : 0;

  const topCategories = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([catId, count]) => {
      const cat = CATEGORY_MAP.get(catId);
      return { catId, count, label: cat?.label ?? catId, emoji: cat?.emoji ?? '🌐', color: cat?.color ?? '#22FFAA', sdgs: cat?.sdgs ?? [] };
    });

  return NextResponse.json({
    missions: sorted,
    summary: { totalMissions: missions.length, avgMei, totalParticipants, totalCompletions, overallCompletionRate, sdgReach: Object.keys(sdgCounts).length, topCategories },
  });
}
