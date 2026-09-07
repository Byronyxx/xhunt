import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  const body = await req.json().catch(() => ({})) as { post_id?: string; emoji?: string };
  const { post_id, emoji = '🔥' } = body;
  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 });

  // Check if reaction exists
  const { data: existing } = await sb
    .from('post_reactions')
    .select('post_id')
    .eq('post_id', post_id)
    .eq('user_id', session.sub)
    .maybeSingle();

  // Fetch current count once (used for both paths)
  const { data: postRow } = await sb
    .from('experience_posts')
    .select('reaction_count')
    .eq('id', post_id)
    .single();

  const currentCount = (postRow as { reaction_count: number } | null)?.reaction_count ?? 0;

  if (existing) {
    await sb.from('post_reactions').delete().eq('post_id', post_id).eq('user_id', session.sub);
    await sb.from('experience_posts')
      .update({ reaction_count: Math.max(0, currentCount - 1) })
      .eq('id', post_id);
    return NextResponse.json({ reacted: false });
  } else {
    await sb.from('post_reactions').insert({ post_id, user_id: session.sub, emoji });
    await sb.from('experience_posts')
      .update({ reaction_count: currentCount + 1 })
      .eq('id', post_id);
    return NextResponse.json({ reacted: true });
  }
}
