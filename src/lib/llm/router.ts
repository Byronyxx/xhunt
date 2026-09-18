/**
 * XHunt LLM Router
 *
 * Selects and calls the correct AI provider based on the LLM_PROVIDER env var.
 * Supported providers: groq (default, now backed by Google Gemini) | anthropic | openai | ollama
 *
 * Usage:
 *   const text = await callLLM({ messages, systemPrompt, model, maxTokens });
 *
 * Model resolution priority:
 *   1. Explicit `model` argument
 *   2. LLM_MODEL env var
 *   3. Provider default
 *
 * Environment variables:
 *   LLM_PROVIDER       groq | anthropic | openai | ollama  (default: groq)
 *   LLM_MODEL          override model name
 *   GEMINI_API_KEY     required if provider=groq (the 'groq' provider now calls
 *                      Google Gemini's OpenAI-compatible endpoint -- kept the
 *                      'groq' name to avoid touching every caller of this router)
 *   ANTHROPIC_API_KEY  required if provider=anthropic (admin routes only)
 *   OPENAI_API_KEY     required if provider=openai
 *   OLLAMA_BASE_URL    required if provider=ollama (e.g. http://localhost:11434)
 *   OLLAMA_MODEL       default model for Ollama (e.g. llama3.2)
 */

export type LLMProvider = 'groq' | 'anthropic' | 'openai' | 'ollama';

export interface LLMMessage {
  role:    'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMCallOptions {
  messages:     LLMMessage[];
  systemPrompt?: string;
  model?:        string;
  maxTokens?:    number;
  temperature?:  number;
  /** Force a specific provider, overriding LLM_PROVIDER. */
  provider?:     LLMProvider;
}

export interface LLMResponse {
  content:    string;
  provider:   LLMProvider;
  model:      string;
  inputTokens?:  number;
  outputTokens?: number;
}

// ── Provider defaults ──────────────────────────────────────────────────────────

const DEFAULTS: Record<LLMProvider, string> = {
  groq:      'gemini-2.5-flash-lite',
  anthropic:  'claude-sonnet-4-6',
  openai:     'gpt-4o-mini',
  ollama:     process.env.OLLAMA_MODEL ?? 'llama3.2',
};

function resolveProvider(): LLMProvider {
  const raw = (process.env.LLM_PROVIDER ?? 'groq').toLowerCase();
  if (['groq', 'anthropic', 'openai', 'ollama'].includes(raw)) return raw as LLMProvider;
  return 'groq';
}

function resolveModel(provider: LLMProvider, explicit?: string): string {
  return explicit ?? process.env.LLM_MODEL ?? DEFAULTS[provider];
}

// ── "groq" provider ── actually calls Google Gemini's OpenAI-compatible endpoint ──────────────────
// Kept the function/provider name 'groq' rather than renaming it everywhere this
// router is called from -- only the network destination changed (Groq -> Gemini),
// same as the fix applied to src/lib/groq.ts.

async function callGroq(opts: LLMCallOptions, model: string): Promise<LLMResponse> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.systemPrompt
        ? [{ role: 'system', content: opts.systemPrompt }, ...opts.messages]
        : opts.messages,
      max_tokens:  opts.maxTokens  ?? 1024,
      temperature: opts.temperature ?? 0.7,
    }),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content:      data.choices[0]?.message?.content ?? '',
    provider:     'groq',
    model,
    inputTokens:  data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}

// ── Anthropic ────────────────────────────────────────────────────────────

async function callAnthropic(opts: LLMCallOptions, model: string): Promise<LLMResponse> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const res = await client.messages.create({
    model,
    system:      opts.systemPrompt,
    messages:    opts.messages.filter((m) => m.role !== 'system') as Parameters<typeof client.messages.create>[0]['messages'],
    max_tokens:  opts.maxTokens  ?? 1024,
  });

  const content = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return {
    content,
    provider:     'anthropic',
    model,
    inputTokens:  res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  };
}

// ── OpenAI ───────────────────────────────────────────────────────────────

async function callOpenAI(opts: LLMCallOptions, model: string): Promise<LLMResponse> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.systemPrompt
        ? [{ role: 'system', content: opts.systemPrompt }, ...opts.messages]
        : opts.messages,
      max_tokens:  opts.maxTokens  ?? 1024,
      temperature: opts.temperature ?? 0.7,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content:      data.choices[0]?.message?.content ?? '',
    provider:     'openai',
    model,
    inputTokens:  data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}

// ── Ollama (local) ───────────────────────────────────────────────────────

async function callOllama(opts: LLMCallOptions, model: string): Promise<LLMResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

  const messages: LLMMessage[] = opts.systemPrompt
    ? [{ role: 'system', content: opts.systemPrompt }, ...opts.messages]
    : opts.messages;

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = await res.json() as {
    message: { content: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };

  return {
    content:      data.message?.content ?? '',
    provider:     'ollama',
    model,
    inputTokens:  data.prompt_eval_count,
    outputTokens: data.eval_count,
  };
}

// ── Main router ────────────────────────────────────────────────────────────────

export async function callLLM(opts: LLMCallOptions): Promise<LLMResponse> {
  const provider = opts.provider ?? resolveProvider();
  const model    = resolveModel(provider, opts.model);

  switch (provider) {
    case 'groq':      return callGroq(opts, model);
    case 'anthropic': return callAnthropic(opts, model);
    case 'openai':    return callOpenAI(opts, model);
    case 'ollama':    return callOllama(opts, model);
    default:          return callGroq(opts, model);
  }
}

/**
 * Convenience: fast, cheap call for user-facing chat (Gemini by default, via
 * the 'groq' provider key -- see note above).
 * Never uses the Anthropic key -- that's reserved for admin agent routes.
 */
export async function callChatLLM(
  messages: LLMMessage[],
  systemPrompt?: string,
  model?: string,
): Promise<string> {
  const provider = resolveProvider();
  // If provider is anthropic, downgrade to groq for chat — anthropic is admin-only
  const safeProvider: LLMProvider = provider === 'anthropic' ? 'groq' : provider;
  const res = await callLLM({ messages, systemPrompt, model, provider: safeProvider });
  return res.content;
}

/** Returns metadata about the currently configured provider — safe to expose to frontend. */
export function getLLMInfo(): { provider: LLMProvider; model: string; isLocal: boolean } {
  const provider = resolveProvider();
  const model    = resolveModel(provider);
  return { provider, model, isLocal: provider === 'ollama' };
}
