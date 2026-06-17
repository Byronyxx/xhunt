/**
 * XIL — X-Hunt Intelligence Layer
 *
 * Primary intelligence orchestration endpoint.
 * Routes requests to specialist agents, applies constitutional checks,
 * and returns coordinated intelligence with full provenance.
 *
 * GET  /api/xil   — Agent registry + ecosystem health summary
 * POST /api/xil   — Invoke XIL intelligence function
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import { orchestrate, type IntelligenceFunction } from '@/lib/xil/orchestrator';
import { getAgentRegistry } from '@/lib/xil/constitution';

// GET /api/xil  — transparency endpoint: registered agents + recent health metrics
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = await createClient();
    const url = new URL(req.url);
    const view = url.searchParams.get('view') ?? 'registry';

    if (view === 'registry') {
      const agents = await getAgentRegistry();
      return NextResponse.json({
        agents,
        totalAgents: agents.length,
        categories: [...new Set(agents.map((a: { category: string }) => a.category))],
        constitutionalPrinciples: [
          'Human agency takes precedence over optimization objectives',
          'Trust is the platform\'s most valuable asset',
          'Neither financial nor impact materiality may be ignored',
          'Recommendations must be relevant, explainable, fair, and beneficial',
          'Fairness means maximizing opportunity, not reinforcing advantages',
          'Engage for value, not for engagement itself',
        ],
      });
    }

    if (view === 'health') {
      const [evalData, checkData, routingData] = await Promise.all([
        supabase
          .from('xil_agent_evaluations')
          .select('agent_id, composite_score, utility_score, trust_score, created_at')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('xil_constitutional_checks')
          .select('verdict, constitutional_score, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('xil_routing_log')
          .select('intelligence_function, processing_ms, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      type CheckRow = { verdict: string; constitutional_score: number; created_at: string };
      const checks: CheckRow[] = (checkData.data ?? []) as CheckRow[];
      const approvalRate = checks.length
        ? Math.round((checks.filter((c: CheckRow) => c.verdict === 'approved').length / checks.length) * 100)
        : null;

      return NextResponse.json({
        recentEvaluations: evalData.data ?? [],
        constitutionalHealth: {
          approvalRate,
          recentChecks: checks.slice(0, 10),
          totalChecks: checks.length,
        },
        routingMetrics: {
          recentCalls: routingData.data ?? [],
          avgProcessingMs: routingData.data?.length
            ? Math.round((routingData.data.reduce((acc: number, r: { processing_ms: number | null }) => acc + (r.processing_ms ?? 0), 0)) / routingData.data.length)
            : null,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown view. Use ?view=registry or ?view=health' }, { status: 400 });
  } catch (err) {
    console.error('[xil GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/xil  — invoke XIL intelligence orchestration
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { intelligenceFunction, objective, context, sessionId } = body;

    if (!intelligenceFunction || !objective) {
      return NextResponse.json(
        { error: 'intelligenceFunction and objective are required' },
        { status: 400 }
      );
    }

    const validFunctions: IntelligenceFunction[] = [
      'personal', 'community', 'marketplace', 'impact', 'governance', 'foundry',
    ];

    if (!validFunctions.includes(intelligenceFunction)) {
      return NextResponse.json(
        { error: `intelligenceFunction must be one of: ${validFunctions.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('id', session!.sub)
      .single();

    // Governance and Foundry functions require admin role
    if (['governance', 'foundry'].includes(intelligenceFunction)) {
      const adminRoles = new Set(['platform_admin', 'tenant_admin']);
      if (!profile || !adminRoles.has(profile.role as string)) {
        return NextResponse.json(
          { error: 'governance and foundry intelligence functions require admin role' },
          { status: 403 }
        );
      }
    }

    const result = await orchestrate({
      intelligenceFunction: intelligenceFunction as IntelligenceFunction,
      objective,
      context: context ?? {},
      userId: profile?.id,
      sessionId,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[xil POST]', err);
    return NextResponse.json({ error: 'Intelligence orchestration failed' }, { status: 500 });
  }
}
