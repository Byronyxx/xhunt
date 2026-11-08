-- ============================================================================
-- 033_definer_function_hardening.sql                [NEW — forward-only repair]
-- ----------------------------------------------------------------------------
-- STATUS      : NEW file written during the recovery audit. NOT an original.
-- PURPOSE     : (a) pin search_path on the SECURITY DEFINER functions created
--               by migrations 001/006/012/014/016 (they had none — a classic
--               privilege-escalation vector), and (b) stop anonymous / signed-in
--               API callers from executing definer functions that only your
--               server code (service role) should call.
-- WHY         : Verified on replay (AUDIT_REPORT S-06): anon could execute
--                 find_direct_conversation(a,b)  -> leaks the private
--                                                    conversation id of any 2 users
--                 compute_and_store_mei(m)       -> writes mission_scores
--                 increment_listing_views(l)     -> mutates counters
--               because PostgreSQL grants EXECUTE to PUBLIC by default.
-- RUN ON      : EXISTING and FRESH database.
-- PREREQS     : Originals 001-030 applied.
-- DESTRUCTIVE : NO. No function body is changed. Only ALTER FUNCTION ... SET
--               search_path and GRANT/REVOKE EXECUTE.
-- IDEMPOTENT  : YES. Functions that do not exist are skipped.
-- APP IMPACT  : Callers verified in application code:
--                 compute_and_store_mei   <- src/app/api/cron/compute-mei/route.ts
--                    uses SUPABASE_SERVICE_ROLE_KEY when set. CONFIRM that the
--                    env var is set in Vercel, otherwise the nightly job falls
--                    back to the anon key and will be (correctly) denied.
--                 find_direct_conversation <- /api/messages/conversations (admin)
--                 increment_listing_views  <- /api/marketplace/apply (admin)
--               my_tenant_id() / my_role() stay executable by anon+authenticated
--               because RLS policies call them with the caller's privileges.
-- VALIDATION  : validation/01_validate_security.sql (S-06)
-- ============================================================================

begin;

-- A. Pin search_path (no body change) ----------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in ('my_tenant_id', 'my_role', 'compute_mei',
                        'compute_and_store_mei', 'increment_listing_views',
                        'find_direct_conversation', 'expire_trial_if_needed')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- B. Server-only functions: service_role only ---------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('compute_mei', 'compute_and_store_mei',
                        'increment_listing_views', 'find_direct_conversation')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant  execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- C. Trigger-only definer functions: nobody needs to call them directly.
--    (Triggers fire regardless of EXECUTE privilege; it is only checked at
--     CREATE TRIGGER time.)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user', 'handle_new_auth_user',
                        'handle_auth_user_email_update', 'expire_trial_if_needed')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

commit;

-- VERIFY (read-only):
--   select p.proname, p.prosecdef, p.proconfig,
--          has_function_privilege('anon', p.oid, 'execute')          as anon_x,
--          has_function_privilege('authenticated', p.oid, 'execute') as auth_x
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef order by 1;
