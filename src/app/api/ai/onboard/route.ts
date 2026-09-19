import { NextRequest } from 'next/server';
import llm from '@/lib/groq';

export const dynamic = 'force-dynamic';

interface ChatMessage { role: 'user' | 'assistant'; content: string }

// ── IP rate limiter ───────────────────────────────────────────────────────────
// In-memory per instance. For multi-instance deployments, swap for Upstash Redis.
// Max 15 chat requests per IP per hour; max 2 extract requests per IP per hour.
const ipStore = new Map<string, { chat: number; extract: number; resetAt: number }>();

function checkRateLimit(ip: string, mode: 'chat' | 'extract'): { allowed: boolean } {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const limits = { chat: 15, extract: 2 };

  const entry = ipStore.get(ip);
  if (!entry || now > entry.resetAt) {
    ipStore.set(ip, { chat: 0, extract: 0, resetAt: now + window });
  }

  const rec = ipStore.get(ip)!;
  if (rec[mode] >= limits[mode]) return { allowed: false };

  rec[mode]++;
  return { allowed: true };
}

// Purge stale entries every 100 calls to prevent memory growth
let purgeCount = 0;
function maybePurge() {
  if (++purgeCount % 100 !== 0) return;
  const now = Date.now();
  for (const [key, val] of ipStore) {
    if (now > val.resetAt) ipStore.delete(key);
  }
}

// ── System prompts ───────────────────────────────────────────────────────────────

// Must stay in this exact order — the frontend's STAGE_REPLIES/STAGE_LABELS
// arrays (src/app/get-started/page.tsx) are hardcoded to this same 6-topic
// order and assume exactly one question per topic, no repeats. If the model
// deviates (asks a follow-up, revisits a topic), the frontend's quick-reply
// chips desync from what's actually being asked. The per-turn instruction
// below (not just this static list) is what actually enforces that.
const TOPICS = [
  "What they're passionate about / what gets them excited (work, hobbies, causes, anything)",
  'Skills and strengths — professional, creative, technical, or personal',
  'Causes or world problems they care about or want to fix',
  'How they prefer to work — solo vs. team, quick tasks vs. long projects, pace',
  'How much time they can realistically commit each week',
  'What success looks like for them — money, skills, impact, recognition, purpose',
];

const XENO_CHAT_SYSTEM = `
You are Xeno, the AI guide for X-Hunt — a platform where people earn money, build skills, and create real-world impact by completing missions for brands, NGOs, governments, startups, and social enterprises.

Your role: have a warm, natural conversation to understand this person so we can match them with the best missions and opportunities.

RULES (strict — the app's UI is hardcoded to expect exactly this pattern):
- Ask exactly ONE question at a time. Never bundle multiple questions.
- Keep each response to 2–3 sentences maximum.
- Be warm, genuinely curious, and slightly playful — not clinical.
- Always acknowledge what they said in ONE short phrase, then move to the next topic — even if their answer was brief or a short button-tap label like "Mix of both". Do NOT ask a follow-up or clarifying question on the same topic. Do NOT ask "tell me more about X" — move forward instead.
- Never mention "profile", "extracting data", or "building a database".
- Do NOT list all questions upfront.
- You will be told exactly which numbered topic to ask about on each turn (see the instruction appended after the conversation history) — ask ONLY that topic, never a different one, never a repeat.
`.trim();

const EXTRACT_SYSTEM = `
You are an NLP extraction engine. Based on a conversation transcript, extract a structured impact profile.
Return ONLY valid, complete, single-line-safe JSON — no markdown fences, no explanation, no extra text before or after the JSON object.
Escape any double quotes, apostrophes-as-curly-quotes, or newlines that appear inside a string value so the JSON stays valid.
Keep every string value concise — a few words — so the full object fits comfortably within the response length.

JSON schema (all fields required):
{
  "archetype": "one of: Explorer | Builder | Innovator | Mentor | Creator | Analyst | Activist",
  "strengths": [{"name": "string", "score": <integer 60-99>}],
  "causes": ["string"],
  "personality": ["string"],
  "motivations": ["string"],
  "growthAreas": ["string"],
  "availability": "string like '5-10 hrs/week'",
  "impactScore": <integer 40-95>
}

Rules:
- strengths: 4–6 items, infer from what they described even if not explicitly named
- causes: 2–4 items, map to: Climate, Education, Health, Civic Tech, Circular Economy, Accessibility, Community, Sustainability, Arts & Culture, Social Justice
- personality: 2–3 traits from: Explorer, Builder, Innovator, Mentor, Creator, Analyst, Activist
- motivations: 2–3 from: Income, Learning, Career Growth, Volunteering, Networking, Purpose, Recognition
- growthAreas: 2–3 skills they'd benefit from but didn't strongly claim
- impactScore: reflect enthusiasm and depth of answers (higher = more engaged, purpose-driven)
`.trim();

// Pulls the JSON object out of a model response defensively: strips any
// ```json fences, then takes the substring between the first "{" and the
// last "}" so stray preamble/postamble text around the object doesn't
// break parsing.
function extractJsonObject(raw: string): string {
  const stripped = raw.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = stripped.indexOf('{');
  const end   = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return stripped;
  return stripped.slice(start, end + 1);
}

async function callExtract(transcript: string, extraNote?: string) {
  const completion = await llm.chat.completions.create({
    model: 'gemini-3.5-flash',
    messages: [
      { role: 'system', content: EXTRACT_SYSTEM },
      {
        role: 'user',
        content: `Conversation transcript:\n\n${transcript}\n\nExtract the profile JSON now.`
          + (extraNote ? `\n\n${extraNote}` : ''),
      },
    ],
    temperature: 0.2,
    max_tokens: 1500,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
  return JSON.parse(extractJsonObject(raw));
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? req.headers.get('x-real-ip')
          ?? 'unknown';

  let mode: 'chat' | 'extract' = 'chat';

  try {
    const body = await req.json() as {
      messages: ChatMessage[];
      mode: 'chat' | 'extract';
      userId?: string;
    };
    const { messages } = body;
    mode = body.mode;

    // ── Rate limit check ──────────────────────────────────────────────────
    maybePurge();
    const { allowed } = checkRateLimit(ip, mode);
    if (!allowed) {
      return Response.json(
        { error: 'Too many requests. Please wait a moment before continuing.' },
        { status: 429 }
      );
    }

    // ── Message count guard (server-side) ─────────────────────────────────
    // Reject if client sends more than 20 messages in chat mode (10 user + 10 AI)
    if (mode === 'chat' && messages.length > 20) {
      return Response.json(
        { error: 'Session limit reached.' },
        { status: 429 }
      );
    }

    // ── Extract mode ──────────────────────────────────────────────────────
    if (mode === 'extract') {
      const transcript = messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Xeno'}: ${m.content}`)
        .join('\n');

      let profile: unknown;
      try {
        profile = await callExtract(transcript);
      } catch (parseErr) {
        // One retry: malformed/truncated JSON from an LLM is often
        // transient. Tell it plainly what went wrong and ask again before
        // giving up and surfacing a real error to the user.
        console.error('[onboard/extract] first attempt failed, retrying:', parseErr);
        profile = await callExtract(
          transcript,
          'Your previous response was not valid, complete JSON. Return ONLY a single valid JSON object matching the schema exactly, fully closed, with all strings properly escaped.'
        );
      }

      return Response.json({ profile: { ...(profile as object), extractedAt: new Date().toISOString() } });
    }

    // ── Chat mode ─────────────────────────────────────────────────────────
    // Tell the model exactly which topic to ask next, based on how many
    // questions the user has actually answered — rather than trusting it to
    // track progress from raw history alone. Keeps the model's question
    // order in lockstep with the frontend's hardcoded per-topic quick-reply
    // chips regardless of how a given model likes to phrase follow-ups.
    const userAnswerCount = messages.filter((m) => m.role === 'user').length;
    const turnInstruction = userAnswerCount >= 6
      ? 'The user has now answered all 6 questions. Respond with EXACTLY this line and nothing else: "Perfect — I have everything I need to create your Impact DNA. Just give me a moment! ✨"'
      : `This is question ${userAnswerCount + 1} of 6. Ask ONLY about this topic, in your own warm words: "${TOPICS[userAnswerCount]}". Do not ask about any other topic. Do not repeat an earlier topic. Do not ask a follow-up or clarifying question on the previous topic, no matter how short their last answer was — acknowledge it in one short phrase, then ask this new topic.`;

    const completion = await llm.chat.completions.create({
      model: 'gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: XENO_CHAT_SYSTEM },
        ...messages,
        { role: 'system', content: turnInstruction },
      ],
      temperature: 0.75,
      max_tokens: 200,
    });

    const reply = completion.choices[0]?.message?.content?.trim()
      ?? "I'm here to help you find the right missions. What are you passionate about?";
    return Response.json({ message: reply });

  } catch (err) {
    console.error('/api/ai/onboard error:', err);

    // IMPORTANT: extract mode must surface a real failure. The frontend's
    // beginExtraction() only acts when `data.profile` is present — if this
    // returns 200 with no `profile` field (as the old chat-mode-style
    // fallback below does), the UI hangs on the "Building your Impact DNA"
    // screen forever with no error and no recovery. Chat mode keeps the
    // soft-fallback behavior since a conversational message is an
    // acceptable degraded response there.
    if (mode === 'extract') {
      return Response.json(
        { error: 'Could not generate your Impact DNA right now. Please try again.' },
        { status: 502 }
      );
    }

    return Response.json(
      { message: "Something went wrong on my end. What are you most passionate about?" },
      { status: 200 }
    );
  }
}
