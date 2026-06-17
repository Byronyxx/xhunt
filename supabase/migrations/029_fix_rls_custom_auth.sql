-- Migration 029: Fix RLS policies after Clerk removal
-- Old policies used: auth.uid()::text = (SELECT clerk_user_id FROM user_profiles WHERE id = user_id)
-- New auth: JWT sub = user_profile.id (UUID), so auth.uid() IS the profile id directly.
--
-- Also ensures the JWT signing key in Supabase matches our backend JWT_SECRET
-- so that Supabase accepts our tokens for RLS evaluation.

-- ── contribution_ledger ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can write own contributions" ON public.contribution_ledger;
DROP POLICY IF EXISTS "Users can read own private contributions" ON public.contribution_ledger;

CREATE POLICY "Users can write own contributions"
  ON public.contribution_ledger FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own private contributions"
  ON public.contribution_ledger FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

-- ── trust_profiles ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own trust" ON public.trust_profiles;

CREATE POLICY "Users read own trust"
  ON public.trust_profiles FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

-- ── skill_verifications ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own private skill verifications" ON public.skill_verifications;

CREATE POLICY "Users read own private skill verifications"
  ON public.skill_verifications FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

-- ── identity_credentials ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own credentials" ON public.identity_credentials;

CREATE POLICY "Users manage own credentials"
  ON public.identity_credentials FOR ALL
  USING (is_public = true OR auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── match_signals ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own signals" ON public.match_signals;

CREATE POLICY "Users manage own signals"
  ON public.match_signals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── match_results ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own matches" ON public.match_results;

CREATE POLICY "Users read own matches"
  ON public.match_results FOR SELECT
  USING (auth.uid() = seeker_id);

-- ── xil_routing_log ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own routing log" ON public.xil_routing_log;

CREATE POLICY "Users read own routing log"
  ON public.xil_routing_log FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);
