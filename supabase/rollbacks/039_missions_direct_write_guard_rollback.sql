-- ============================================================================
-- ROLLBACK for 039_missions_direct_write_guard.sql
-- ----------------------------------------------------------------------------
-- Restores the exact definitions that were live on xhunt-staging on 2026-11-06
-- (read from pg_policies before the migration) and removes the new trigger and
-- function. Not in supabase/migrations on purpose: it must never be applied
-- automatically.
--
-- ORIGINAL creator_insert_missions  (cmd INSERT, roles {public}, permissive)
--   WITH CHECK ((tenant_id = my_tenant_id()) AND (my_role() = ANY (ARRAY[
--     'mission_creator'::text, 'tenant_admin'::text, 'platform_admin'::text])))
--
-- ORIGINAL creator_update_missions  (cmd UPDATE, roles {public}, permissive)
--   USING ((tenant_id = my_tenant_id()) AND ((created_by = auth.uid()) OR
--     (my_role() = ANY (ARRAY['tenant_admin'::text, 'platform_admin'::text]))))
--   WITH CHECK: none (PostgreSQL then applies USING as the check)
--
-- ORIGINAL triggers on public.missions: none.
-- ============================================================================

drop trigger if exists trg_guard_missions_protected_columns on public.missions;
drop function if exists public.guard_missions_protected_columns();

drop policy if exists creator_insert_missions on public.missions;
create policy creator_insert_missions on public.missions
  for insert
  with check (
    (tenant_id = my_tenant_id())
    and (my_role() = any (array['mission_creator'::text, 'tenant_admin'::text, 'platform_admin'::text]))
  );

drop policy if exists creator_update_missions on public.missions;
create policy creator_update_missions on public.missions
  for update
  using (
    (tenant_id = my_tenant_id())
    and (
      (created_by = auth.uid())
      or (my_role() = any (array['tenant_admin'::text, 'platform_admin'::text]))
    )
  );
