-- ============================================================================
-- 034_rls_tenant_finance_events.sql                 [NEW — forward-only repair]
-- ----------------------------------------------------------------------------
-- STATUS      : NEW file written during the recovery audit. NOT an original.
-- PURPOSE     : Correct RLS policies that let the wrong people read/write
--               tenant, finance and behavioural-event data.
--   1. mission_events  : SELECT leaked every NULL-tenant (hunter) event to
--                        EVERYONE including anonymous callers; INSERT was
--                        WITH CHECK (true).                     (S-07, S-09)
--   2. mission_progress: client could tag progress with ANOTHER tenant's id.
--                                                                   (S-10)
--   3. reward_events   : client could tag rewards with another tenant's id or
--                        insert pre-redeemed rewards.                (S-11)
--   4. escrow_accounts / escrow_transactions / revenue_records / invoices /
--      outcome_validations: ANY tenant member (even role 'participant') had
--      FULL read+write.                                              (S-12)
--   5. contact_submissions: admin read policy tested role='admin', which the
--      role CHECK constraint (001) forbids -> policy never matched. (F-07)
--   6. v_step_dropoff / v_mission_funnel: views ran with owner rights and
--      bypassed RLS -> cross-tenant analytics readable.            (S-13)
-- RUN ON      : EXISTING and FRESH database.
-- PREREQS     : Originals 001-030 applied; 032 and 033 applied (032 gives the
--               user_profiles column grants that make my_role() trustworthy).
-- DESTRUCTIVE : NO data change. Policies are dropped ONLY with a stricter or
--               equivalent replacement created in the same transaction.
-- IDEMPOTENT  : YES (DROP POLICY IF EXISTS + CREATE POLICY; ALTER VIEW SET).
-- BEHAVIOUR CHANGES TO APPROVE (explicit):
--   * Hunters' NULL-tenant events are no longer world-readable. Staff of a
--     mission's tenant (roles tenant_admin/platform_admin/analyst/
--     mission_creator) can read events for THEIR tenant's missions; everyone
--     can read their own events.
--   * Role 'participant' can no longer read escrow/revenue/invoice/validation
--     rows via the Data API. Writes require tenant_admin/platform_admin.
--     (All writes in your code already go through createAdminClient().)
--   * platform_admin can now read contact_submissions (documented intent).
-- NOT FIXED HERE (needs app change + approval): completion/XP integrity — see
--   AUDIT_REPORT S-14. The browser can still write mission_progress.completed_at
--   for its OWN user_id.
-- VALIDATION  : validation/01_validate_security.sql, validation/03_...
-- ============================================================================

begin;

do $$
begin
  if to_regprocedure('public.my_tenant_id()') is null or to_regprocedure('public.my_role()') is null then
    raise exception 'my_tenant_id()/my_role() missing — originals 001 not applied';
  end if;
end $$;

-- 1. mission_events ----------------------------------------------------------
drop policy if exists "tenant_read_events"   on public.mission_events;
drop policy if exists "anyone_insert_events" on public.mission_events;
drop policy if exists "events_read_own_or_tenant_staff" on public.mission_events;
drop policy if exists "events_insert_own"               on public.mission_events;

create policy "events_read_own_or_tenant_staff" on public.mission_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      public.my_role() in ('tenant_admin', 'platform_admin', 'analyst', 'mission_creator')
      and (
        tenant_id = public.my_tenant_id()
        or exists (select 1 from public.missions m
                   where m.id = mission_events.mission_id
                     and m.tenant_id = public.my_tenant_id())
      )
    )
  );

create policy "events_insert_own" on public.mission_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (tenant_id is null or tenant_id = public.my_tenant_id())
  );

-- 2. mission_progress --------------------------------------------------------
drop policy if exists "own_progress" on public.mission_progress;
create policy "own_progress" on public.mission_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (tenant_id is null or tenant_id = public.my_tenant_id())
  );

-- 3. reward_events -----------------------------------------------------------
drop policy if exists "insert_rewards" on public.reward_events;
create policy "insert_rewards" on public.reward_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and redeemed = false
    and (tenant_id is null or tenant_id = public.my_tenant_id())
  );

-- 4. finance / validation tables ---------------------------------------------
--    read  : tenant staff (any role except 'participant')
--    write : tenant_admin / platform_admin of that tenant
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('escrow_accounts',     'tenant_members_own_escrow',      'escrow'),
      ('escrow_transactions', 'tenant_members_own_escrow_tx',   'escrow_tx'),
      ('revenue_records',     'tenant_members_own_revenue',     'revenue'),
      ('invoices',            'tenant_members_own_invoices',    'invoices'),
      ('outcome_validations', 'tenant_members_own_validations', 'validations')
    ) as v(tbl, old_policy, short)
  loop
    continue when to_regclass('public.' || t.tbl) is null;
    execute format('drop policy if exists %I on public.%I', t.old_policy, t.tbl);
    execute format('drop policy if exists %I on public.%I', t.short || '_select_staff', t.tbl);
    execute format('drop policy if exists %I on public.%I', t.short || '_write_admin', t.tbl);
    execute format($p$create policy %I on public.%I for select to authenticated
      using (tenant_id = public.my_tenant_id() and public.my_role() <> 'participant')$p$,
      t.short || '_select_staff', t.tbl);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (tenant_id = public.my_tenant_id() and public.my_role() in ('tenant_admin','platform_admin'))
      with check (tenant_id = public.my_tenant_id() and public.my_role() in ('tenant_admin','platform_admin'))$p$,
      t.short || '_write_admin', t.tbl);
  end loop;
end $$;

-- 5. contact_submissions: fix the dead 'admin' role -------------------------
drop policy if exists "contact_admin_read" on public.contact_submissions;
create policy "contact_admin_read" on public.contact_submissions
  for select to authenticated
  using (public.my_role() = 'platform_admin');

-- 6. views: evaluate RLS as the caller (PostgreSQL 15+) ----------------------
do $$
begin
  if to_regclass('public.v_step_dropoff')  is not null then
    execute 'alter view public.v_step_dropoff  set (security_invoker = true)';
  end if;
  if to_regclass('public.v_mission_funnel') is not null then
    execute 'alter view public.v_mission_funnel set (security_invoker = true)';
  end if;
end $$;

commit;
