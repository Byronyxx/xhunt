import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  const url   = new URL(req.url);
  const tab   = url.searchParams.get('tab') ?? 'discover';
  const q     = url.searchParams.get('q') ?? '';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 30), 50);

  try {
    if (tab === 'following') {
      // People I follow
      const { data, error } = await sb
        .from('user_follows')
        .select(`
          following:user_profiles!following_id(
            id, display_name, avatar_url, bio, xp_balance,
            followers_count, following_count, missions_completed
          )
        `)
        .eq('follower_id', session.sub)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      const people = (data ?? []).map((r: Record<string, unknown>) => ({
        ...(r.following as Record<string, unknown>),
        is_following: true,
      }));
      return NextResponse.json({ people });
    }

    if (tab === 'followers') {
      // People who follow me
      const { data, error } = await sb
        .from('user_follows')
        .select(`
          follower:user_profiles!follower_id(
            id, display_name, avatar_url, bio, xp_balance,
            followers_count, following_count, missions_completed
          )
        `)
        .eq('following_id', session.sub)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Check which followers I also follow back
      const followerIds = (data ?? []).map((r: Record<string, unknown>) =>
        (r.follower as Record<string, unknown>)?.id as string
      ).filter(Boolean);

      let followingSet = new Set<string>();
      if (followerIds.length > 0) {
        const { data: followBack } = await sb
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', session.sub)
          .in('following_id', followerIds);
        followingSet = new Set((followBack ?? []).map((r: { following_id: string }) => r.following_id));
      }

      const people = (data ?? []).map((r: Record<string, unknown>) => ({
        ...(r.follower as Record<string, unknown>),
        is_following: followingSet.has((r.follower as Record<string, unknown>)?.id as string),
      }));
      return NextResponse.json({ people });
    }

    // Discover tab — users sorted by followers, excluding self + optional search
    let query = sb
      .from('user_profiles')
      .select('id, display_name, avatar_url, bio, xp_balance, followers_count, following_count, missions_completed')
      .neq('id', session.sub)
      .order('followers_count', { ascending: false })
      .limit(limit);

    if (q) query = query.ilike('display_name', `%${q}%`);

    const { data: profiles, error } = await query;
    if (error) throw error;

    // Batch check which ones I follow
    const ids = (profiles ?? []).map((p: { id: string }) => p.id);
    let followingSet = new Set<string>();
    if (ids.length > 0) {
      const { data: follows } = await sb
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', session.sub)
        .in('following_id', ids);
      followingSet = new Set((follows ?? []).map((r: { following_id: string }) => r.following_id));
    }

    const people = (profiles ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      is_following: followingSet.has(p.id as string),
    }));

    return NextResponse.json({ people });
  } catch (err) {
    console.error('[api/social/people]', err);
    return NextResponse.json({ people: [] });
  }
}
