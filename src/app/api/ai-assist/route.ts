import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/server';
import { getUserTierInfo } from '@/lib/freemium';
import { checkAndIncrementRateLimit } from '@/lib/rate-limit';
import groq, { modelForTier } from '@/lib/groq';

const BodySchema = z.object({
  message:         z.string().min(1).max(1000),
  huntTitle:       z.string().optional(),
  huntStory:       z.string().optional(),
  stepInstruction: z.string().optional(),
  stepType:        z.string().optional(),
  mode:            z.enum(['hint', 'explain', 'motivate', 'general']).default('general'),
});

export async function POST(req: NextRequest) {
  try {
    let session;
    try {
      session = await requireSession(req);
    } catch {
      return Response.json({ error: 'auth_required', upgradeUrl: '/auth/login' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const tierInfo = await getUserTierInfo(session.sub);

    if (!tierInfo.canUseAI) {
      return Response.json({
        error: 'upgrade_required',
        tier: tierInfo.tier,
        hasUsedTrial: tierInfo.hasUsedTrial,
        upgradeUrl: '/upgrade',
      }, { status: 402 });
    }

    const rateLimit = await checkAndIncrementRateLimit(session.sub, tierInfo.tier);
    if (!rateLimit.allowed) {
      return Response.json({
        error: 'rate_limit_exceeded',
        remaining: 0,
        resetAt: rateLimit.resetAt,
        dailyLimit: tierInfo.aiRequestsPerDay,
      }, { status: 429 });
    }

    if (!process.env.GROQ_API_KEY) {
      return Response.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const { message, huntTitle, huntStory, stepInstruction, stepType } = parsed.data;
    const model = modelForTier(tierInfo.tier);

    const systemParts = [
      "You are X-hunt's AI Mission Guide — a warm, encouraging coach helping users complete real-world missions.",
      '',
    ];
    if (huntTitle) systemParts.push(`Mission: "${huntTitle}"`);
    if (huntStory) systemParts.push(`Story context: "${huntStory}"`);
    if (stepInstruction) systemParts.push(`Current step (${stepType ?? 'action'}): "${stepInstruction}"`);
    systemParts.push('', 'Reply in 2-4 sentences. Be encouraging and practical. Guide discovery — never just give the answer.');

    const completion = await groq.chat.completions.create({
      model,
      max_tokens: 200,
      temperature: 0.75,
      messages: [
        { role: 'system', content: systemParts.join('\n') },
        { role: 'user', content: message },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim()
      ?? "I'm here to help! What would you like to know?";

    return Response.json({ reply, remaining: rateLimit.remaining, tier: tierInfo.tier });
  } catch (err) {
    console.error('[ai-assist]', err);
    return Response.json({ error: 'AI service temporarily unavailable' }, { status: 500 });
  }
}
