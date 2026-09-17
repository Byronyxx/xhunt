import OpenAI from 'openai';

// Google Gemini, accessed through its OpenAI-compatible endpoint.
// Free tier: no card/billing required, doesn't expire on a credit clock.
const llm = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY ?? '',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

export const TIER_MODELS: Record<string, string> = {
  trial: 'gemini-2.5-flash-lite',
  pro:   'gemini-2.5-flash',
};

export function modelForTier(tier: string): string {
  return TIER_MODELS[tier] ?? TIER_MODELS.trial;
}

export default llm;
