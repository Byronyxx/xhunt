-- Migration 028: custom auth columns
-- Adds email + password_hash to user_profiles so we can authenticate
-- without Clerk. clerk_user_id is kept for data migration purposes only.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email
  ON public.user_profiles (email);

-- auth_user_id: internal UUID for future Supabase Auth integration
-- (not used now — email/password_hash are the auth source)

COMMENT ON COLUMN public.user_profiles.email IS 'Login email — unique, managed by x-hunt auth service';
COMMENT ON COLUMN public.user_profiles.password_hash IS 'bcrypt hash — set by auth service, never exposed via API';
