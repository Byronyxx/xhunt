-- ============================================================================
-- 039_missions_direct_write_guard.sql
-- ----------------------------------------------------------------------------
-- SCOPE       : public.missions ONLY. No other table, grant, TRUNCATE,
--               constraint, default, SELECT/DELETE policy, helper function or
--               app route is touched.
-- PURPOSE     : Close the direct-database mission-write bypass. Before this
--               migration a signed-in mission_creator, using the public key and
--               their own login, could insert missions with any created_by,
--               status 'archived', or is_public = true, and could publish or
--               archive their own missions (staging cases CB-1..CB-5, CB-9,
--               CB-10, tested 2026-11-06). The API route fix does not cover
--               that path.
-- DECIDED BY BYRON
--   (a) A mission's creator is always the signed-in user (auth.uid()).
--   (b) Pilot: publishing and archiving are admin-only; mission_creators write
--       private drafts.
--   (c) Creation contract: tenant_admin / platform_admin, status draft|active,
--       archived rejected on create (same as POST /api/admin/missions).
-- CHANGES (exactly four objects)
--   1. policy   creator_insert_missions   replaced (tighter WITH CHECK)
--   2. policy   creator_update_missions   replaced: same USING, explicit
--                                         WITH CHECK that mirrors USING
--   3. function public.guard_missions_protected_columns()   new
--   4. trigger  trg_guard_missions_protected_columns        new (BEFORE UPDATE)
-- INSERT RULE
--   created_by IS NOT NULL AND created_by = auth.uid()
--   AND tenant_id = my_tenant_id()
--   AND ( mission_creator : status = 'draft' AND is_public = false
--         tenant_admin / platform_admin : status IN ('draft','active') )
--   An insert that omits status receives the column default 'active' BEFORE
--   the check runs, so it is refused for a mission_creator. The default is
--   deliberately NOT changed.
--   is_public for admins is left unrestricted: POST /api/admin/missions
--   accepts any boolean and defaults to false (route.ts, is_public handling),
--   so the database applies the same rule.
-- UPDATE RULE
--   Who may update is unchanged (USING is copied verbatim from the live
--   policy). The new WITH CHECK is the same expression, so a row cannot be
--   moved out of scope. NOTE: PostgreSQL already applies USING as the check
--   when WITH CHECK is absent, so this part alone does not change behaviour;
--   it makes the intent explicit. The behavioural change comes from the
--   trigger below, because RLS cannot compare OLD and NEW.
-- TRIGGER RULE (anon / authenticated callers only)
--   * id, tenant_id, created_by, created_at cannot change after insert.
--   * status and is_public can change only if my_role() is tenant_admin or
--     platform_admin. This covers mission_creator (required), and also a
--     former creator/admin who was demoted but still authored the row.
--     (Deliberately a little stricter than "mission_creator only"; see
--     report. Easy to narrow if Byron prefers the literal wording.)
-- EXECUTION CONTEXT
--   Trigger functions run as the invoking role. Requests through the Supabase
--   API run as 'authenticated' (user JWT) or 'anon' (public key, no session);
--   the service-role key runs as 'service_role'. The guard returns early for
--   postgres, supabase_admin, service_role and supabase_auth_admin, which is
--   the same list the existing user_profiles guard
--   (guard_user_profile_privileged_columns) uses. The Next.js routes use
--   createAdminClient() (service role), so they are not blocked, and no route
--   code is changed. Any other role is guarded.
-- SECURITY     : The function is SECURITY INVOKER (no elevated rights needed:
--   it calls the existing SECURITY DEFINER helper public.my_role()). It sets
--   search_path to empty and fully qualifies every name.
-- RE-RUNNABLE : YES (drop-if-exists + create; create or replace).
-- ROLLBACK    : supabase/rollbacks/039_missions_direct_write_guard_rollback.sql
-- ============================================================================

-- 1. INSERT policy ----------------------------------------------------------
drop policy if exists creator_insert_missions on public.missions;

create policy creator_insert_missions on public.missions
  for insert
  with check (
    created_by is not null
    and created_by = auth.uid()
    and tenant_id = public.my_tenant_id()
    and (
      (
        public.my_role() = 'mission_creator'
        and status = 'draft'
        and is_public = false
      )
      or (
        public.my_role() = any (array['tenant_admin'::text, 'platform_admin'::text])
        and status = any (array['draft'::text, 'active'::text])
      )
    )
  );

-- 2. UPDATE policy: same USING as the live policy, explicit WITH CHECK -------
drop policy if exists creator_update_missions on public.missions;

create policy creator_update_missions on public.missions
  for update
  using (
    (tenant_id = my_tenant_id())
    and (
      (created_by = auth.uid())
      or (my_role() = any (array['tenant_admin'::text, 'platform_admin'::text]))
    )
  )
  with check (
    (tenant_id = my_tenant_id())
    and (
      (created_by = auth.uid())
      or (my_role() = any (array['tenant_admin'::text, 'platform_admin'::text]))
    )
  );

-- 3. Trigger function -------------------------------------------------------
create or replace function public.guard_missions_protected_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Service-role and owner paths are not restricted (see EXECUTION CONTEXT).
  if current_user in ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin') then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'missions.id cannot be changed' using errcode = '42501';
  end if;
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'missions.tenant_id cannot be changed' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'missions.created_by cannot be changed' using errcode = '42501';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'missions.created_at cannot be changed' using errcode = '42501';
  end if;

  if (new.status is distinct from old.status
      or new.is_public is distinct from old.is_public)
     and (public.my_role() is null
          or public.my_role() <> all (array['tenant_admin'::text, 'platform_admin'::text])) then
    raise exception 'missions.status and missions.is_public can only be changed by an organisation admin'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 4. Trigger ----------------------------------------------------------------
drop trigger if exists trg_guard_missions_protected_columns on public.missions;

create trigger trg_guard_missions_protected_columns
  before update on public.missions
  for each row
  execute function public.guard_missions_protected_columns();
