-- Migration 020: Add clerk_user_id to user_profiles for Clerk authentication
-- Clerk manages auth sessions; profiles are looked up by clerk_user_id
-- using the service-role admin client (bypasses Supabase Auth RLS).
--
-- NOTE: originally targeted a table called "profiles", which never existed
-- (the real table is "user_profiles", created in migration 001). Fixed here
-- so downstream migrations (022–026) that reference user_profiles.clerk_user_id
-- in RLS policies don't fail. Migration 027 re-applies the same column with
-- IF NOT EXISTS, so it stays a safe no-op once this fix is in place.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS user_profiles_clerk_user_id_idx
  ON public.user_profiles (clerk_user_id);

-- Add clerk_user_id to message participants and conversation lookups
-- (allows server-side queries scoped to the requesting Clerk user)
COMMENT ON COLUMN public.user_profiles.clerk_user_id IS
  'Clerk user ID (user_*) — used for server-side identity when Supabase Auth session is not present';
