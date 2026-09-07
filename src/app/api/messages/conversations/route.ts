import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// POST /api/messages/conversations
// Find or create a conversation.
// Body: { type: 'direct' | 'mission' | 'team', mission_id?, participant_ids?, name? }
// Returns: { conversation_id: string }

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as {
    type: 'direct' | 'mission' | 'team' | 'organization' | 'community';
    mission_id?: string;
    participant_ids?: string[];
    name?: string;
  };

  const admin = createAdminClient();

  // ── Mission conversation ──────────────────────────────────────────────
  if (body.type === 'mission' && body.mission_id) {
    const { data: existing } = await admin
      .from('conversations')
      .select('id')
      .eq('type', 'mission')
      .eq('mission_id', body.mission_id)
      .maybeSingle();

    let convId: string;

    if (existing) {
      convId = existing.id;
    } else {
      // Fetch mission name for conversation label
      const { data: mission } = await admin
        .from('missions')
        .select('title, tenant_id')
        .eq('id', body.mission_id)
        .single();

      const { data: conv, error } = await admin
        .from('conversations')
        .insert({
          type:       'mission',
          mission_id: body.mission_id,
          tenant_id:  mission?.tenant_id ?? null,
          name:       mission?.title ? `${mission.title} Chat` : 'Mission Chat',
          created_by: session.sub,
        })
        .select('id')
        .single();

      if (error || !conv) {
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }
      convId = conv.id;
    }

    // Ensure requesting user is a member
    await admin
      .from('conversation_members')
      .upsert(
        { conversation_id: convId, user_id: session.sub, role: 'member' },
        { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
      );

    return NextResponse.json({ conversation_id: convId });
  }

  // ── Direct message ────────────────────────────────────────────────────────────────
  if (body.type === 'direct' && body.participant_ids?.length === 1) {
    const otherId = body.participant_ids[0];
    if (!otherId || otherId === session.sub) {
      return NextResponse.json({ error: 'Invalid participant' }, { status: 400 });
    }

    // Find existing direct conversation between these two users
    const { data: existingId } = await admin.rpc('find_direct_conversation', {
      user_a: session.sub,
      user_b: otherId,
    });

    if (existingId) {
      return NextResponse.json({ conversation_id: existingId });
    }

    // Create new direct conversation
    const { data: conv, error } = await admin
      .from('conversations')
      .insert({ type: 'direct', created_by: session.sub })
      .select('id')
      .single();

    if (error || !conv) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }

    // Add both users as members
    await admin.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: session.sub,  role: 'owner' },
      { conversation_id: conv.id, user_id: otherId,  role: 'member' },
    ]);

    return NextResponse.json({ conversation_id: conv.id });
  }

  // ── Named group / community ────────────────────────────────────────────────
  if (['team', 'organization', 'community'].includes(body.type) && body.name) {
    const { data: conv, error } = await admin
      .from('conversations')
      .insert({ type: body.type, name: body.name, created_by: session.sub })
      .select('id')
      .single();

    if (error || !conv) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }

    const members = [
      { conversation_id: conv.id, user_id: session.sub, role: 'owner' },
      ...(body.participant_ids ?? []).map((uid) => ({
        conversation_id: conv.id, user_id: uid, role: 'member' as const,
      })),
    ];
    await admin.from('conversation_members').insert(members);

    return NextResponse.json({ conversation_id: conv.id });
  }

  return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
}
