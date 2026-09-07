import { NextRequest } from 'next/server';
import { z } from 'zod';
import { StepSchema } from '@/lib/schemas';
import { getSession } from '@/lib/auth/server';
import { getUserTierInfo } from '@/lib/freemium';
import groq, { modelForTier } from '@/lib/groq';

const AdaptRequestSchema = z.object({
  huntTitle:     z.string(),
  storyContext:  z.string(),
  step:          StepSchema,
  context:       z.enum(['user_skipped', 'user_struggling', 'user_failed']),
  userInterests: z.array(z.string()).optional(),
});

const CONTEXT_DESCRIPTIONS = {
  user_skipped:    'The user skipped this step — it felt too demanding, unclear, or inaccessible.',
  user_struggling: 'The user is struggling with this step and needs a more achievable version.',
  user_failed:     'The user attempted this step but was unable to complete it.',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AdaptRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { huntTitle, storyContext, step, context, userInterests } = parsed.data;

    // Check tier — fall back gracefully if unauthenticated
    let model = 'llama-3.1-8b-instant';
    try {
      const session = await getSession(req);
      if (session) {
        const tierInfo = await getUserTierInfo(session.sub);
        if (!tierInfo.canUseAI) {
          return Response.json({ adaptedStep: simplifyStep(step) });
        }
        model = modelForTier(tierInfo.tier);
      }
    } catch { /* unauthenticated — continue with default */ }

    if (!process.env.GROQ_API_KEY) {
      return Response.json({ adaptedStep: simplifyStep(step) });
    }

    const prompt = `You are the Step Adaptation Engine for X-hunt — a system that makes missions accessible to users who are struggling or stuck.

CONTEXT: ${CONTEXT_DESCRIPTIONS[context]}

HUNT: "${huntTitle}"
Story: "${storyContext}"

CURRENT STEP:
- Type: ${step.type}
- Instruction: "${step.instruction}"
- Success criteria: "${step.success_criteria}"

${userInterests?.length ? `USER INTERESTS: ${userInterests.join(', ')}` : ''}

YOUR TASK:
Rewrite this step to be more achievable while:
1. Keeping the same step type (${step.type})
2. Maintaining narrative coherence with the hunt
3. Reducing scope or effort — not eliminating it entirely
4. Keeping the spirit of what the step is trying to accomplish
5. Making success criteria clear and immediately checkable

Return ONLY a valid JSON object. No markdown. No explanation. Exact schema:
{
  "id": ${step.id},
  "type": "${step.type}",
  "instruction": "...",
  "success_criteria": "..."
}`;

    const completion = await groq.chat.completions.create({
      model,
      max_tokens: 500,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (completion.choices[0]?.message?.content ?? '')
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');

    let parsed2: unknown;
    try { parsed2 = JSON.parse(raw); }
    catch { return Response.json({ adaptedStep: simplifyStep(step) }); }

    const validated = StepSchema.safeParse({ ...(parsed2 as object), id: step.id, type: step.type });
    if (!validated.success) return Response.json({ adaptedStep: simplifyStep(step) });

    return Response.json({ adaptedStep: validated.data });
  } catch (err) {
    console.error('[adapt-step]', err);
    return Response.json({ error: 'Adaptation failed' }, { status: 500 });
  }
}

function simplifyStep(step: z.infer<typeof StepSchema>) {
  const sentences = step.instruction.split(/[.!?]+/).filter(Boolean);
  return {
    ...step,
    instruction: (sentences[0]?.trim() ?? step.instruction) + '. Take just 5 minutes on this.',
    success_criteria: 'You made a genuine, mindful attempt at this — that counts.',
  };
}
