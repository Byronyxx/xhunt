import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { getUserTierInfo } from '@/lib/freemium';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);

    if (!session) {
      return Response.json({
        tier: 'free', isTrialActive: false, trialDaysLeft: 0,
        trialEndsAt: null, canUseAI: false, canAccessPremiumMissions: false,
        aiRequestsPerDay: 0, hasUsedTrial: false,
      });
    }

    const info = await getUserTierInfo(session.sub);
    return Response.json(info);
  } catch {
    return Response.json({
      tier: 'free', isTrialActive: false, trialDaysLeft: 0,
      trialEndsAt: null, canUseAI: false, canAccessPremiumMissions: false,
      aiRequestsPerDay: 0, hasUsedTrial: false,
    });
  }
}
