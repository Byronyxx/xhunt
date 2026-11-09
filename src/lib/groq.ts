import OpenAI from 'openai';

// Google Gemini, accessed through its OpenAI-compatible endpoint.
// Free tier: no card/billing required, doesn't expire on a credit clock.
//
// Server-only: this file reads GEMINI_API_KEY and must only be imported from
// API routes or other server code, never from a client component.
//
// The client is created lazily, on the first real AI call, not when this file
// is imported. The openai SDK (v7) throws "Missing credentials" the moment a
// client is built without a key, so the old module-load `new OpenAI(...)` made
// `next build` fail in any environment without GEMINI_API_KEY (for example
// Vercel Preview, where the key is not set). Now a missing key only affects
// the AI call itself, which fails with a clear MissingGeminiKeyError that the
// calling route's existing try/catch handles.

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

export class MissingGeminiKeyError extends Error {
  constructor() {
    super('GEMINI_API_KEY is not set: AI features are unavailable in this environment.');
    this.name = 'MissingGeminiKeyError';
  }
}

/** True when a non-blank GEMINI_API_KEY is present. Never exposes the value. */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  // A blank or whitespace-only key counts as missing. Previously a blank key
  // fell back to '' and produced a client that could never authenticate.
  if (!apiKey) throw new MissingGeminiKeyError();
  client = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
  return client;
}

type ChatCreate = OpenAI['chat']['completions']['create'];

// Same call shape the routes already use (`llm.chat.completions.create(...)`),
// so no route needs to change. Only chat completions are exposed, because
// that is the only part of the SDK any caller uses.
const llm = {
  chat: {
    completions: {
      create: ((...args: Parameters<ChatCreate>) =>
        getClient().chat.completions.create(...args)) as ChatCreate,
    },
  },
};

// NOTE: gemini-2.5-flash / gemini-2.5-flash-lite were retired for new API
// keys (404'd in production on 2026-09-19). Using the 3.5 generation, which
// Google's own error message names as the direct replacement pair.
export const TIER_MODELS: Record<string, string> = {
  trial: 'gemini-3.5-flash-lite',
  pro:   'gemini-3.5-flash',
};

export function modelForTier(tier: string): string {
  return TIER_MODELS[tier] ?? TIER_MODELS.trial;
}

export default llm;
