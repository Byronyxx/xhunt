-- Migration 031: Hunter session hardening
--
-- Fix 1: OAuth signups (Google) populate raw_user_meta_data with
-- full_name/name, not display_name -- widen the fallback so OAuth
-- hunters get a real display name instead of the email-prefix fallback.
--
-- Fix 2: inactivity-logout support -- adds last_active_at so
-- src/proxy.ts can force-sign-out any authenticated request that's
-- gone idle past its role's threshold (30 min for hunters, 45 min for
-- everyone tenant-side -- see the role CHECK constraint in migration
-- 001). Enforcement and the throttled-write logic live in
-- src/proxy.ts, not here -- this migration is schema/function only.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    'participant',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.user_profiles.last_active_at IS
  'Last-seen timestamp for this user, throttle-updated by src/proxy.ts (at most once per ~60s per user). Used to enforce the inactivity-logout timeout -- see proxy.ts for the actual enforcement.';
