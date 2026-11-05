import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/auth/server';

// GET /api/admin/missions — tenant-scoped mission list
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', session.sub)
    .single();

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No organization found.' }, { status: 400 });

  const { data, error } = await admin
    .from('missions')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ missions: data ?? [] });
}

// POST /api/admin/missions — create a mission scoped to the caller's tenant.
// Used by both the "Save" (status: 'active'/'draft') and "Submit for review"
// (status: 'draft') flows in admin/missions/new. The review flow follows up
// with a separate POST to /api/admin/missions/[id]/review.
export async function POST(req: NextRequest) {
  // Roles allowed to create missions through this ADMIN endpoint. Mirrors the
  // sibling admin handlers (PATCH/DELETE/links) and the missions insert RLS
  // policy; platform_admin is scoped to the caller's own tenant, exactly like
  // tenant_admin. mission_creator/analyst/participant are NOT admins.
  const CREATE_ROLES = new Set(['platform_admin', 'tenant_admin']);
  // Statuses valid at creation (UI sends 'draft' or 'active'; DB CHECK also
  // allows 'archived', which is not a creation state).
  const CREATE_STATUSES = new Set(['draft', 'active']);
  const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
  const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });

  // 1. Identity (server-validated Supabase session). Nothing is trusted from
  //    the request until this succeeds.
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Trusted role + organisation, read server-side. Fail closed on any
  //    lookup failure: no write is attempted.
  let profile: { tenant_id: string | null; role: string | null } | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', session.sub)
      .single();
    // PGRST116 = no row (not a member of anything); anything else is an
    // infrastructure failure, not an authorisation answer.
    if (error && error.code !== 'PGRST116') throw error;
    profile = data ?? null;
  } catch (err) {
    console.error('[admin/missions POST] profile lookup failed', err);
    return NextResponse.json({ error: 'Unable to verify permissions.' }, { status: 500 });
  }

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No organization found.' }, { status: 403 });
  }
  if (!profile.role || !CREATE_ROLES.has(profile.role)) {
    return NextResponse.json({ error: 'Admin role required.' }, { status: 403 });
  }
  const tenantId = profile.tenant_id;

  // 3. Body. Only parsed after the caller is authorised.
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return bad('Invalid request body.');
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return bad('Invalid JSON body.');
  }

  // 4. Organisation scope: an explicit target organisation must be the
  //    caller's own. Never silently replaced.
  for (const key of ['tenant_id', 'tenantId']) {
    const claimed = body[key];
    if (claimed !== undefined && claimed !== null && claimed !== tenantId) {
      return NextResponse.json(
        { error: 'Cannot create missions for another organization.' },
        { status: 403 },
      );
    }
  }

  // 5. Validate and select permitted fields explicitly. Ownership fields
  //    (tenant_id, created_by) and anything else in the body are never copied.
  const { title, story_context, difficulty, estimated_time, steps, reward, tags, status, is_public } = body;

  if (typeof title !== 'string' || title.trim() === '') return bad('Title is required.');
  if (story_context != null && typeof story_context !== 'string') return bad('Invalid story_context.');
  if (difficulty !== undefined && (typeof difficulty !== 'string' || !DIFFICULTIES.has(difficulty))) {
    return bad('Invalid difficulty.');
  }
  if (estimated_time != null && typeof estimated_time !== 'string') return bad('Invalid estimated_time.');
  if (
    steps !== undefined &&
    (!Array.isArray(steps) || steps.some((s) => typeof s !== 'object' || s === null || Array.isArray(s)))
  ) {
    return bad('Invalid steps.');
  }
  if (reward != null && typeof reward !== 'string') return bad('Invalid reward.');
  if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string'))) {
    return bad('Invalid tags.');
  }
  if (status !== undefined && (typeof status !== 'string' || !CREATE_STATUSES.has(status))) {
    return bad('Invalid status.');
  }
  if (is_public !== undefined && typeof is_public !== 'boolean') return bad('Invalid is_public.');

  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    created_by: session.sub,
    title,
    story_context: story_context ?? null,
    estimated_time: estimated_time ?? null,
    reward: reward ?? '',
    status: status ?? 'draft',
    is_public: is_public ?? false,
  };
  // Omitted optional fields fall back to the column defaults, as before.
  if (difficulty !== undefined) row.difficulty = difficulty;
  if (steps !== undefined) row.steps = steps;
  if (tags !== undefined) row.tags = tags;

  // 6. Privileged write (service role bypasses RLS: authorisation above is
  //    what protects this insert).
  const { data, error } = await createAdminClient()
    .from('missions')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[admin/missions POST] insert failed', error);
    return NextResponse.json({ error: 'Failed to create mission.' }, { status: 500 });
  }

  return NextResponse.json({ mission: data });
}
