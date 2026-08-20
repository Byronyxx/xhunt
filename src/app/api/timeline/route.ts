import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  const sb  = createAdminClient();
  const url = new URL(req.url);
  const tab    = url.searchParams.get('tab') ?? 'for_you';
  const filter = url.searchParams.get('filter') ?? '';

  try {
    const session = await getSession(req);
    const user = session ? { id: session.sub } : null;

    const [sessionsResult, postsResult] = await Promise.all([
      // Live sessions always shown (except missions tab)
      filter !== 'missions'
        ? sb
            .from('live_sessions')
            .select(`
              id, title, description, status, current_step_index, total_steps,
              viewer_count, is_pro_only, started_at, scheduled_for, created_at,
              host:user_profiles!host_id(display_name, avatar_url),
              mission:missions(title)
            `)
            .in('status', filter === 'live' ? ['live'] : ['scheduled', 'live'])
            .order('status', { ascending: false })
            .order('scheduled_for', { ascending: true, nullsFirst: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),

      // Posts
      (async () => {
        let query = sb
          .from('experience_posts')
          .select(`
            id, post_type, caption, reaction_count, comment_count, share_count,
            metadata, created_at, mission_id, is_public,
            user:user_profiles!user_id(id, display_name, avatar_url),
            mission:missions(title)
          `)
          .eq('is_public', true)
          .order('created_at', { ascending: false });

        if (filter === 'missions') {
          query = query.in('post_type', ['completion', 'highlight']);
        }

        if (tab === 'following' && user) {
          // Only posts from users the current user follows
          const { data: followingIds } = await sb
            .from('user_follows')
            .select('following_id')
            .eq('follower_id', user.id);

          const ids = (followingIds ?? []).map((r: { following_id: string }) => r.following_id);
          if (ids.length === 0) return { data: [], error: null };
          query = query.in('user_id', ids);
        }

        return query.limit(40);
      })(),
    ]);

    const liveSessions = (sessionsResult.data ?? []).map((s: Record<string, unknown>) => ({
      id:                 s.id,
      title:              s.title,
      description:        s.description,
      status:             s.status,
      current_step_index: s.current_step_index,
      total_steps:        s.total_steps,
      viewer_count:       s.viewer_count,
      is_pro_only:        s.is_pro_only,
      started_at:         s.started_at,
      scheduled_for:      s.scheduled_for,
      created_at:         s.created_at,
      host_display_name:  (s.host as Record<string,unknown>)?.display_name ?? 'Unknown',
      host_avatar_url:    (s.host as Record<string,unknown>)?.avatar_url ?? null,
      mission_title:      (s.mission as Record<string,unknown>)?.title ?? null,
    }));

    // Check which posts the current user has reacted to
    let reactedSet = new Set<string>();
    if (user && postsResult.data && postsResult.data.length > 0) {
      const postIds = postsResult.data.map((p: Record<string, unknown>) => p.id as string);
      const { data: reactions } = await sb
        .from('post_reactions')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);
      reactedSet = new Set((reactions ?? []).map((r: { post_id: string }) => r.post_id));
    }

    const posts = (postsResult.data ?? []).map((p: Record<string, unknown>) => ({
      id:                p.id,
      post_type:         p.post_type,
      caption:           p.caption,
      reaction_count:    p.reaction_count ?? 0,
      comment_count:     p.comment_count  ?? 0,
      share_count:       p.share_count    ?? 0,
      reacted:           reactedSet.has(p.id as string),
      metadata:          p.metadata,
      created_at:        p.created_at,
      user_display_name: (p.user as Record<string,unknown>)?.display_name ?? 'User',
      user_avatar_url:   (p.user as Record<string,unknown>)?.avatar_url ?? null,
      mission_title:     (p.mission as Record<string,unknown>)?.title ?? null,
    }));

    return NextResponse.json({ liveSessions, posts });
  } catch (err) {
    console.error('[api/timeline]', err);
    return NextResponse.json({ liveSessions: [], posts: [] });
  }
}
