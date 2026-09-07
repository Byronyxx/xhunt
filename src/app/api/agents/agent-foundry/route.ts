import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_SYSTEM_PROMPTS } from '@/lib/agents/prompts';
import type { AgentFoundryInput, AgentFoundryOutput } from '@/lib/agents/types';
import { requireTenantAgent } from '@/lib/agents/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/server';

const client = new Anthropic();

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);

export async function POST(req: NextRequest) {
  const agentAuth = await requireTenantAgent();
  if (!agentAuth.ok) return agentAuth.response;

  // Agent Foundry is admin-only — it defines new agents, which is a governance action
  const supabase = createAdminClient();
  const session = await getSession(req);
  if (session) {
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.sub).single();
    if (profile && !ADMIN_ROLES.has(profile.role as string)) {
      return NextResponse.json({ error: 'Agent Foundry requires admin role' }, { status: 403 });
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  let input: AgentFoundryInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { agentName, purpose, category, stakeholders, problemContext, constraints } = input;

  if (!agentName || !purpose || !category || !problemContext) {
    return NextResponse.json({ error: 'agentName, purpose, category, and problemContext are required' }, { status: 400 });
  }

  const userPrompt = `Design a new specialized AI agent for the X-Hunt ecosystem.

Agent Name: ${agentName}
Proposed Purpose: ${purpose}
Category: ${category}
Primary Stakeholders: ${JSON.stringify(stakeholders ?? [])}
Problem Context: ${problemContext}
${constraints?.length ? `Additional Constraints: ${constraints.join('; ')}` : ''}

Apply the full 11-step Agent Development Framework.
Every field in the agent_spec is mandatory — do not leave any empty.
Be rigorous about anti-objectives — they should be specific to this agent, not generic.
The constitutional_compliance verdict must reflect honest assessment, not optimism.
The implementation_roadmap must be realistic.

Return a JSON object matching the AgentFoundryOutput schema exactly. No markdown, no code fences — raw JSON only.`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: AGENT_SYSTEM_PROMPTS['agent-foundry'],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const output: AgentFoundryOutput = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    // Optionally register the new agent in the registry (if constitutionally approved)
    if (output.constitutional_compliance.verdict === 'approved' && output.agent_spec) {
      const spec = output.agent_spec;
      await supabase.from('xil_agent_registry').upsert({
        agent_id: spec.agent_id,
        name: spec.name,
        category: spec.category as 'participant_intelligence' | 'experience_intelligence' | 'community_intelligence' | 'marketplace_intelligence' | 'governance' | 'sustainability' | 'analytics',
        purpose: spec.purpose,
        primary_stakeholders: spec.primary_stakeholders,
        scope_of_authority: spec.scope_of_authority,
        operational_boundaries: spec.operational_boundaries,
        primary_objective: spec.primary_objective,
        secondary_objectives: spec.secondary_objectives,
        anti_objectives: spec.anti_objectives,
        desiderata_alignment: spec.desiderata_alignment,
        financial_materiality_score: spec.financial_materiality.score,
        impact_materiality_score: spec.impact_materiality.score,
        requires_human_approval: output.estimated_complexity !== 'low',
        is_active: false,   // requires human review before activation
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' });
    }

    return NextResponse.json(output);
  } catch (err) {
    console.error('[agent-foundry]', err);
    return NextResponse.json({ error: 'Agent Foundry failed to generate specification' }, { status: 500 });
  }
}
