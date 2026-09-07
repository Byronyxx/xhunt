import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import { CATEGORY_MAP } from '@/lib/missionCategories';

const TAG_TO_SKILLS: Record<string, string[]> = {
  tech:           ['Software Development', 'Digital Innovation'],
  'tech-ai':      ['AI Engineering', 'Data Science'],
  software:       ['Software Development', 'Systems Thinking'],
  climate:        ['Sustainability', 'Environmental Action'],
  environment:    ['Environmental Science', 'Conservation'],
  sustainability: ['Circular Thinking', 'Impact Measurement'],
  education:      ['Curriculum Design', 'Knowledge Transfer'],
  learning:       ['Research & Analysis', 'Knowledge Management'],
  teaching:       ['Instructional Design', 'Mentorship'],
  health:         ['Health Advocacy', 'Program Design'],
  fitness:        ['Wellness Coaching', 'Behavioral Change'],
  wellness:       ['Mental Health Awareness', 'Habit Formation'],
  community:      ['Community Building', 'Stakeholder Engagement'],
  social:         ['Social Impact', 'Community Development'],
  adventure:      ['Leadership', 'Resilience'],
  travel:         ['Cross-cultural Communication', 'Adaptability'],
  civic:          ['Civic Engagement', 'Public Policy'],
  'civic-tech':   ['Policy Analysis', 'Civic Innovation'],
  food:           ['Food Systems', 'Nutrition Advocacy'],
  'food-systems': ['Food Security', 'Supply Chain Management'],
  art:            ['Creative Direction', 'Visual Communication'],
  arts:           ['Creative Arts', 'Cultural Engagement'],
  design:         ['UX Design', 'Product Thinking'],
  urban:          ['Urban Planning', 'Infrastructure Design'],
  water:          ['Water Resource Management', 'Environmental Stewardship'],
  equity:         ['Diversity & Inclusion', 'Social Justice'],
  inclusion:      ['Equity Advocacy', 'Inclusive Design'],
  circular:       ['Circular Economy', 'Waste Reduction'],
  work:           ['Career Development', 'Professional Skills'],
  research:       ['Research Methodology', 'Data Analysis'],
  mindful:        ['Mindfulness', 'Emotional Intelligence'],
  mental:         ['Mental Health', 'Psychological Safety'],
};

const TAG_TO_CAT: Record<string, string> = {
  tech: 'tech', 'tech-ai': 'tech', software: 'tech', digital: 'tech', research: 'tech',
  climate: 'climate', environment: 'climate', sustainability: 'climate', green: 'climate',
  education: 'education', learning: 'education', teaching: 'education',
  health: 'health', fitness: 'health', wellness: 'health', mindful: 'health', mental: 'health',
  community: 'community', social: 'community', adventure: 'community', travel: 'community',
  civic: 'civic-tech', 'civic-tech': 'civic-tech', policy: 'civic-tech',
  food: 'food-systems', 'food-systems': 'food-systems', nutrition: 'food-systems',
  art: 'arts', arts: 'arts', creative: 'arts', design: 'arts',
  urban: 'urban', city: 'urban',
  water: 'water', ocean: 'water',
  equity: 'social-equity', inclusion: 'social-equity', diversity: 'social-equity',
  circular: 'circular', recycling: 'circular',
  work: 'future-of-work', career: 'future-of-work',
};

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createAdminClient();

  const { data: progress } = await supabase
    .from('mission_progress')
    .select('mission_id')
    .eq('user_id', session.sub)
    .not('completed_at', 'is', null);

  if (!progress?.length) {
    return NextResponse.json({ skills: [], sdgContributions: [], topCategories: [] });
  }

  const missionIds = [...new Set(progress.map((p: { mission_id: string }) => p.mission_id))];
  const { data: missions } = await supabase
    .from('missions')
    .select('id, title, tags')
    .in('id', missionIds);

  if (!missions?.length) {
    return NextResponse.json({ skills: [], sdgContributions: [], topCategories: [] });
  }

  const skillFreq: Record<string, { count: number; evidence: string[] }> = {};
  const catCounts: Record<string, number> = {};
  const sdgCounts: Record<number, number> = {};

  for (const m of missions as { id: string; title: string; tags: string[] }[]) {
    for (const tag of (m.tags ?? [])) {
      const tagLower = tag.toLowerCase();

      const skills = TAG_TO_SKILLS[tagLower];
      if (skills) {
        for (const skill of skills) {
          if (!skillFreq[skill]) skillFreq[skill] = { count: 0, evidence: [] };
          skillFreq[skill].count++;
          if (skillFreq[skill].evidence.length < 3 && !skillFreq[skill].evidence.includes(m.title)) {
            skillFreq[skill].evidence.push(m.title);
          }
        }
      }

      const catId = TAG_TO_CAT[tagLower];
      if (catId) {
        catCounts[catId] = (catCounts[catId] ?? 0) + 1;
        const cat = CATEGORY_MAP.get(catId);
        if (cat) {
          for (const sdg of cat.sdgs) {
            sdgCounts[sdg as number] = (sdgCounts[sdg as number] ?? 0) + 1;
          }
        }
      }
    }
  }

  const totalMissions = missions.length;

  const skills = Object.entries(skillFreq)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 8)
    .map(([name, { count, evidence }]) => ({
      name,
      level: count >= 4 ? 'Advanced' : count >= 2 ? 'Intermediate' : 'Beginner',
      confidence: Math.min(95, 40 + Math.round((count / Math.max(totalMissions, 1)) * 55)),
      evidence,
    }));

  const topCategories = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([catId, count]) => {
      const cat = CATEGORY_MAP.get(catId);
      return { catId, count, label: cat?.label ?? catId, emoji: cat?.emoji ?? '🌐', color: cat?.color ?? '#22FFAA' };
    });

  const sdgContributions = Object.entries(sdgCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([sdg, count]) => ({ sdg: parseInt(sdg), count }));

  return NextResponse.json({ skills, topCategories, sdgContributions });
}
