import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;    // app role (platform_admin, participant, etc.)
  surface: string;
}

// Identity now comes from a real Supabase Auth session (see
// src/lib/supabase/server.ts) rather than a custom-signed JWT — Supabase's
// own session cookies are read automatically by the SSR client. `req` is
// kept in the signature for compatibility with every existing call site,
// even though the underlying cookie read no longer needs it directly.
export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  void req;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Supabase's own session JWT doesn't carry our app-level role/surface
  // fields, so look them up from user_profiles (created automatically by
  // the on_auth_user_created trigger — see migration 030).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role, default_surface')
    .eq('id', user.id)
    .single();

  return {
    sub: user.id,
    email: user.email ?? '',
    // Falls back to the same defaults the signup trigger inserts, in the
    // rare case this runs before that trigger's row has landed.
    role: profile?.role ?? 'participant',
    surface: profile?.default_surface ?? 'home',
  };
}

export async function requireSession(req: NextRequest): Promise<SessionPayload> {
  const session = await getSession(req);
  if (!session) throw new Error('Unauthorized');
  return session;
}
