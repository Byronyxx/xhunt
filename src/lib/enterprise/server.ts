import { env, publicEnv } from '@/lib/env';

/**
 * Enterprise routes need Supabase (anon + service role). Validated through
 * src/lib/env.ts like the other routes; callers answer 503 when this is false.
 */
export function enterpriseConfigured(): boolean {
  return !!(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey && env.supabaseServiceRoleKey);
}

/** Origin used for links in auth emails. Supabase additionally enforces its redirect allow-list. */
export function appOrigin(req: Request): string {
  return new URL(req.url).origin;
}

export const PROFILE_COLUMNS =
  'id, email, display_name, avatar_url, role, default_surface, onboarding_complete, tenant_id';

export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  default_surface: string | null;
  onboarding_complete: boolean | null;
  tenant_id: string | null;
}

/** Postgres error codes raised by public.activate_enterprise_org (migration 038). */
export const ACTIVATION_ERRORS = {
  EMAIL_NOT_VERIFIED: 'XH001',
  INELIGIBLE: 'XH002',
  PROFILE_MISSING: 'XH003',
} as const;
