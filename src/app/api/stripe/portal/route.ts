import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!env.stripeSecretKey || env.stripeSecretKey.includes('REPLACE_ME')) {
    return Response.json({ error: 'Payment system not configured' }, { status: 503 });
  }

  let auth;
  try {
    auth = await requireSession(request);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  const { data: profile } = await sb
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('id', auth.sub)
    .single();

  const customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return Response.json({ error: 'No Stripe customer found. Subscribe first.' }, { status: 404 });
  }

  const stripe  = new Stripe(env.stripeSecretKey);
  const origin  = new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${origin}/workspace/billing`,
  });

  return Response.json({ url: session.url });
}
