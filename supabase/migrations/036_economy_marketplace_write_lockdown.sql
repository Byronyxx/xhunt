-- ============================================================================
-- 036_economy_marketplace_write_lockdown.sql        [NEW — forward-only repair]
-- ----------------------------------------------------------------------------
-- STATUS      : NEW file written during the recovery audit. NOT an original.
-- PURPOSE     : Make the "economy" tables write-protected from API roles and
--               make the is_public privacy flag introduced by 029 effective.
--   S-18: contribution_ledger  — "Users can update own contributions" (030)
--         lets a user set value_points = 1000000 on their own row.
--   S-19: identity_credentials — policy "Users manage own credentials" (029)
--         is FOR ALL with USING (is_public OR own): a user can DELETE or
--         re-assign (user_id := me) anyone's PUBLIC credential, and can
--         self-issue credentials with issuer='xhunt'.
--   S-20: 029 added is_public (default false = private) but never dropped the
--         original USING(true) SELECT policies (022/023/024), and permissive
--         policies are OR-ed, so "private" rows were readable by everyone.
--   S-21: marketplace_applications "ma_own_all" (014) lets an applicant insert
--         or update their own application with status='accepted'.
-- RUN ON      : EXISTING and FRESH database.
-- PREREQS     : Originals 001-030 applied (029 and 030 especially).
-- DESTRUCTIVE : NO data change. Policies are replaced in the same transaction;
--               write privileges are revoked from anon/authenticated only.
-- IDEMPOTENT  : YES.
-- APP IMPACT  : Verified in application code that ALL writes to these tables go
--               through createAdminClient() (src/lib/economy/*, /api/economy/*,
--               /api/marketplace/apply, /api/workspace/marketplace/*), which is
--               service_role and bypasses these privileges.
-- BEHAVIOUR CHANGES TO APPROVE (explicit):
--   * Rows with is_public=false in contribution_ledger, trust_profiles,
--     skill_verifications, identity_credentials stop being readable by other
--     users through the Data API (that is what is_public=false was meant to
--     do). Server routes using the service role still see everything.
--   * Left UNCHANGED on purpose (design decisions for you — AUDIT_REPORT D-01):
--     trust_scores, trust_events, identity_dids, governance_actions,
--     coordination_workflows, team_formations, xil_* tables still use USING(true).
-- VALIDATION  : validation/01_validate_security.sql (S-18..S-21)
-- ============================================================================

begin;

-- S-18 contribution_ledger: server-only writes -------------------------------
revoke insert, update, delete on public.contribution_ledger from anon, authenticated;

-- S-19 identity_credentials: read public-or-own; no client writes --------------
drop policy if exists "Users manage own credentials" on public.identity_credentials;
drop policy if exists "credentials_read_public_or_own" on public.identity_credentials;
create policy "credentials_read_public_or_own" on public.identity_credentials
  for select to authenticated
  using (is_public = true or auth.uid() = user_id);
revoke insert, update, delete on public.identity_credentials from anon, authenticated;

-- S-20 make is_public effective: drop the always-true twins -------------------
--      (each table keeps its 029 replacement policy)
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public'
             and tablename='contribution_ledger' and policyname='Users can read own private contributions') then
    execute 'drop policy if exists "contributions_select_all" on public.contribution_ledger';
  end if;
  if exists (select 1 from pg_policies where schemaname='public'
             and tablename='trust_profiles' and policyname='Users read own trust') then
    execute 'drop policy if exists "trust_profiles_select_all" on public.trust_profiles';
  end if;
  if exists (select 1 from pg_policies where schemaname='public'
             and tablename='skill_verifications' and policyname='Users read own private skill verifications') then
    execute 'drop policy if exists "skill_verif_select_all" on public.skill_verifications';
  end if;
  if exists (select 1 from pg_policies where schemaname='public'
             and tablename='identity_credentials' and policyname='credentials_read_public_or_own') then
    execute 'drop policy if exists "credentials_select_all" on public.identity_credentials';
  end if;
end $$;

-- S-21 marketplace_applications: applicants cannot self-accept ----------------
drop policy if exists "ma_own_all" on public.marketplace_applications;
drop policy if exists "ma_own_select" on public.marketplace_applications;
drop policy if exists "ma_own_insert" on public.marketplace_applications;
drop policy if exists "ma_own_update" on public.marketplace_applications;
drop policy if exists "ma_own_delete" on public.marketplace_applications;

create policy "ma_own_select" on public.marketplace_applications
  for select to authenticated using (user_id = auth.uid());
create policy "ma_own_insert" on public.marketplace_applications
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "ma_own_update" on public.marketplace_applications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status in ('pending', 'withdrawn'));
create policy "ma_own_delete" on public.marketplace_applications
  for delete to authenticated using (user_id = auth.uid());

commit;
