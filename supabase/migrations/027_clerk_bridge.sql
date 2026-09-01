-- Migration 027: Clerk auth bridge — ensure user_profiles has clerk_user_id
-- and add default_surface for post-auth routing.
-- Note: migration 020 incorrectly targeted "profiles" (which does not exist);
-- this migration corrects it against the actual "user_profiles" table.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS clerk_user_id  VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS default_surface TEXT        NOT NULL DEFAULT 'home'
    CHECK (default_surface IN ('home', 'workspace', 'admin'));

CREATE INDEX IF NOT EXISTS user_profiles_clerk_user_id_idx
  ON public.user_profiles (clerk_user_id);

COMMENT ON COLUMN public.user_profiles.clerk_user_id IS
  'Clerk user ID (user_*) — used for server-side identity lookups when Supabase Auth is not the session provider';

COMMENT ON COLUMN public.user_profiles.default_surface IS
  'Post-authentication redirect target; mirrored into Clerk publicMetadata.default_surface via webhook';

-- RLS: allow service-role to update clerk_user_id during Clerk webhook provisioning
-- (service role bypasses RLS by default; this comment documents the intended access pattern)

-- Update RLS policy so users can read their own profile by clerk_user_id
-- (needed in layouts that resolve the Clerk userId to a Supabase row)
-- Note: CREATE POLICY has no IF NOT EXISTS clause in Postgres — the
-- idempotent pattern is DROP POLICY IF EXISTS followed by a plain CREATE.
DROP POLICY IF EXISTS "read_own_profile_by_clerk_id" ON public.user_profiles;

CREATE POLICY "read_own_profile_by_clerk_id"
  ON public.user_profiles
  FOR SELECT
  USING (clerk_user_id = auth.uid()::text OR id = auth.uid());
