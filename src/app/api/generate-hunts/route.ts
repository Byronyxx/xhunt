import { NextRequest } from 'next/server';
import { MOCK_HUNTS } from '@/lib/mockHunts';
import { validateHuntsArray } from '@/lib/schemas';
import groq from '@/lib/groq';

const HUNT_SCHEMA_EXAMPLE = `{
  "id": "unique-kebab-slug",
  "title": "Hunt Title (5-8 words max)",
  "story_context": "2-3 sentences of rich narrative context that emotionally grounds the user.",
  "difficulty": "easy | medium | hard",
  "estimated_time": "30 min",
  "steps": [
    {
      "id": 1,
      "type": "action | reflection | discovery",
      "instruction": "Specific, real-world executable instruction (1-3 sentences).",
      "success_criteria": "Concrete signal the user uses to know this step is done."
    }
  ],
  "reward": "Compelling reward name (e.g. 'Urban Pioneer Explorer Badge + 150 XP')",
  "tags": ["tag1", "tag2", "tag3"]
}`;

export async function POST(req: NextRequest) {
  try {
    const { interests, goals } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      const shuffled = [...MOCK_HUNTS].sort(() => Math.random() - 0.5);
      return Response.json({ hunts: shuffled.slice(0, 6) });
    }

    const prompt = `You are the Hunt Generation Engine for X-hunt — an AI-native experience platform that transforms real-world engagement into guided, narrative-driven missions.

Generate exactly 4 personalized Hunts for a user with:
- Interests: ${(interests as string[]).join(', ')}
- Goals: ${(goals as string[]).join(', ')}

RULES (non-negotiable):
1. Return ONLY a raw JSON array. No markdown. No explanation. No code fences.
2. Each Hunt MUST have 4-5 steps. Never fewer than 4, never more than 5.
3. Step types must be distributed: at least 1 "action", 1 "reflection", 1 "discovery" per hunt.
4. Every instruction must be executable in the physical world — not digital tasks.
5. Each step.id must be sequential integers starting from 1.
6. difficulty must be exactly one of: easy, medium, hard (lowercase).
7. Tags must be lowercase, single words or hyphenated.

Hunt schema:
${HUNT_SCHEMA_EXAMPLE}

Generate hunts that feel emotionally alive — narratively rich, not generic checklists. Each should have a distinct voice and setting.`;

    const completion = await groq.chat.completions.create({
      model: 'gemini-3.5-flash',
      max_tokens: 4500,
      temperature: 0.85,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (completion.choices[0]?.message?.content ?? '')
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');

    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch {
      console.error('[generate-hunts] JSON parse failed, using mock hunts');
      return Response.json({ hunts: MOCK_HUNTS.slice(0, 4) });
    }

    const rawArray = Array.isArray(parsed) ? parsed : ((parsed as { hunts?: unknown[] })?.hunts ?? []);
    const validHunts = validateHuntsArray(
      (rawArray as unknown[]).map((h, i) => ({
        ...(h as object),
        id: (h as { id?: string }).id || `hunt-ai-${Date.now()}-${i}`,
        createdAt: new Date().toISOString(),
      }))
    );

    if (validHunts.length === 0) {
      return Response.json({ hunts: MOCK_HUNTS.slice(0, 4) });
    }

    return Response.json({ hunts: [...validHunts, ...MOCK_HUNTS.slice(0, 2)] });
  } catch (err) {
    console.error('[generate-hunts]', err);
    return Response.json({ hunts: MOCK_HUNTS });
  }
}
