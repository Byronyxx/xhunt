import OpenAI from 'openai';

// Google Gemini, accessed through its OpenAI-compatible endpoint.
// Free tier: no card/billing required, doesn't expire on a credit clock.
const llm = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY ?? '',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

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
