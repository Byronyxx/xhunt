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

  const { following_id } = await req.json() as { following_id?: string };
  if (!following_id) return NextResponse.json({ error: 'following_id required' }, { status: 400 });
  if (following_id === session.sub) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

  const { error } = await sb
    .from('user_follows')
    .insert({ follower_id: session.sub, following_id });

  if (error) {
    if (error.code === '23505') return NextResponse.json({ already: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ following: true });
}

export async function DELETE(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  const { following_id } = await req.json() as { following_id?: string };
  if (!following_id) return NextResponse.json({ error: 'following_id required' }, { status: 400 });

  await sb
    .from('user_follows')
    .delete()
    .eq('follower_id', session.sub)
    .eq('following_id', following_id);

  return NextResponse.json({ following: false });
}
