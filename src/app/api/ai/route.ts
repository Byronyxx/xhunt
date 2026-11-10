import { NextRequest, NextResponse } from 'next/server';
import { getLLMInfo } from '@/lib/llm/router';
import { requireSession } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai
 * Requires a signed-in Supabase session; unauthenticated requests get 401.
 * Returns the currently configured LLM provider and model.
 * Never exposes API keys.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  return NextResponse.json(getLLMInfo());
}
