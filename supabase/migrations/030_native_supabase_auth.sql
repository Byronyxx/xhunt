-- Migration 030: Native Supabase Auth
--
-- Switches identity from the custom FastAPI JWT backend to Supabase's own
-- Auth system (auth.users). This also fixes a foreign-key mismatch that has
-- been present since migration 001: user_profiles.id was always defined as
-- `references auth.users(id)`, but the custom backend inserted rows with a
-- freshly-generated uuid.uuid4() that was never actually present in
-- auth.users — every registration through that backend would fail with a
-- foreign-key violation (and separately, a CHECK constraint violation, since
-- the backend used role='explorer', which was never a valid value per the
-- role CHECK constraint in migration 001). This migration restores the
-- originally-intended design: auth.users is the source of truth for
-- identity, and user_profiles is created automatically alongside it.

-- ── 1. Auto-create a user_profiles row whenever someone signs up ───────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'participant',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Keep display email in sync if it's ever changed via Supabase Auth directly
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.user_profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_email_update();

-- NOTE: if you have leftover test accounts created by the old custom
-- backend, their email may already be taken in user_profiles, which would
-- block a fresh Supabase Auth signup using that same email (UNIQUE
-- constraint). For a dev/preview project, the simplest fix is to clear old
-- test rows first:
--   DELETE FROM public.user_profiles WHERE email = 'your-test-account@example.com';

-- ── 2. Fix remaining Clerk-era RLS policies that migration 029 missed ──────
-- (029 only replaced policies that happened to share its exact policy
-- names; several others were left broken or dangling under different names)

-- contribution_ledger: UPDATE had no working replacement at all
DROP POLICY IF EXISTS "contributions_insert_own" ON public.contribution_ledger;
DROP POLICY IF EXISTS "contributions_update_own" ON public.contribution_ledger;

CREATE POLICY "Users can update own contributions"
  ON public.contribution_ledger FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- identity_exports: had no working SELECT policy at all
DROP POLICY IF EXISTS "identity_exports_own" ON public.identity_exports;

CREATE POLICY "Users read own identity exports"
  ON public.identity_exports FOR SELECT
  USING (auth.uid() = user_id);

-- trust_anchors: had no working SELECT policy at all
DROP POLICY IF EXISTS "trust_anchors_select_own" ON public.trust_anchors;

CREATE POLICY "Users read own trust anchors"
  ON public.trust_anchors FOR SELECT
  USING (auth.uid() = user_id);

-- match_signals: 029 already added a correct "Users manage own signals"
-- policy; these two clerk-based duplicates never matched anything and are
-- just dead weight — removing them for clarity.
DROP POLICY IF EXISTS "match_signals_own" ON public.match_signals;
DROP POLICY IF EXISTS "match_signals_insert_own" ON public.match_signals;

-- match_results: same situation, 029 already added "Users read own matches"
DROP POLICY IF EXISTS "match_results_own" ON public.match_results;

-- xil_routing_log: same situation, 029 already added "Users read own routing log"
DROP POLICY IF EXISTS "xil_routing_log_own" ON public.xil_routing_log;
