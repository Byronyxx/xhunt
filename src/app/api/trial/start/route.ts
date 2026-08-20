import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';
import { TRIAL_DAYS } from '@/lib/freemium';

export async function POST(req: NextRequest) {
  try {
    let session;
    try {
      session = await requireSession(req);
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    const sb = createAdminClient();

    let { data: profile } = await sb
      .from('user_profiles')
      .select('subscription_tier, trial_started_at')
      .eq('id', session.sub)
      .single();

    // Profile missing — trigger may not have fired (e.g. migrations not applied).
    // Create a default profile so trial can proceed.
    if (!profile) {
      const display = session.email?.split('@')[0] ?? 'User';
      const { data: created, error: createErr } = await sb
        .from('user_profiles')
        .upsert({ id: session.sub, display_name: display, subscription_tier: 'free' })
        .select('subscription_tier, trial_started_at')
        .single();
      if (createErr || !created) {
        return Response.json({ error: 'Profile could not be created' }, { status: 500 });
      }
      profile = created;
    }

    if (profile.trial_started_at) {
      return Response.json({ error: 'Trial already used' }, { status: 409 });
    }
    if (profile.subscription_tier !== 'free') {
      return Response.json({ error: 'Already on an active plan' }, { status: 409 });
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const { error } = await sb.from('user_profiles').update({
      subscription_tier: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
    }).eq('id', session.sub);

    if (error) throw error;

    return Response.json({
      tier: 'trial',
      trialEndsAt: trialEndsAt.toISOString(),
      trialDaysLeft: TRIAL_DAYS,
    });
  } catch (err) {
    console.error('[trial/start]', err);
    return Response.json({ error: 'Failed to start trial' }, { status: 500 });
  }
}
