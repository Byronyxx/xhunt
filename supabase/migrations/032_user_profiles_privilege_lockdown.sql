-- ============================================================================
-- 032_user_profiles_privilege_lockdown.sql          [NEW — forward-only repair]
-- ----------------------------------------------------------------------------
-- STATUS      : NEW file written during the recovery audit. NOT an original.
--               Proposed version number — rename if you create other migrations.
-- PURPOSE     : Stop signed-in users from changing their own privileged
--               columns (role, tenant_id, xp_balance, subscription_*, ...) and
--               from reading other users' secrets (password_hash, Stripe ids).
--               Also removes direct INSERT/DELETE on user_profiles and direct
--               INSERT on tenants / writes to tenants.plan from API roles.
-- WHY         : Verified on a replay of migrations 001-031 (see AUDIT_REPORT
--               findings S-01..S-05, S-08): policy "update_own_profile" (001)
--               has no column restriction, so
--                 update user_profiles set role='platform_admin' ...   works
--                 update user_profiles set tenant_id=<victim>, role='tenant_admin'
--                   -> reads the victim tenant's invoices
--                 select password_hash from user_profiles (same-tenant peer) works
-- RUN ON      : EXISTING database (safe) and FRESH database (after originals).
-- PREREQS     : Originals 001-030 applied (031 recommended). preflight/*.sql
--               reviewed. A backup exists (ROLLBACK_AND_RECOVERY.md section 1).
-- DESTRUCTIVE : NO data is changed, dropped or rewritten. Only GRANT/REVOKE
--               (privileges), one new trigger + function.
-- IDEMPOTENT  : YES — safe to re-run (revokes/grants are absolute; function is
--               CREATE OR REPLACE; trigger is DROP IF EXISTS + CREATE).
-- SERVICE ROLE: Unaffected. service_role / postgres / dashboard SQL editor keep
--               full access. Your createAdminClient() code paths keep working.
-- APP IMPACT  : The browser/user-scoped client can still update these
--               user_profiles columns: display_name, avatar_url, interests,
--               goals, onboarding_complete, bio, website_url, location_*, lat,
--               lng, default_surface, ai_requests_today, ai_requests_reset_at,
--               onboard_requests_today, onboard_requests_reset_at,
--               last_active_at (needed by proxy.ts idle timeout), updated_at.
--               NOT updatable any more from the user-scoped client:
--               subscription_tier (src/lib/freemium.ts line 46 will now be
--               denied; the call is un-awaited-for-errors and the tier is
--               re-derived from trial_ends_at on every read, so behaviour is
--               unchanged; trigger trg_expire_trial still downgrades in-DB).
-- ASSUMPTIONS TO CONFIRM: see preflight/01 (column list) — the grant lists are
--               built from information_schema, so missing columns are skipped
--               rather than raising an error.
-- VALIDATION  : validation/01_validate_security.sql  (checks S-01..S-05)
-- ============================================================================

begin;

-- 0. Fail fast (nothing has changed yet) ------------------------------------
do $$
begin
  if to_regclass('public.user_profiles') is null then
    raise exception 'public.user_profiles does not exist — stop and run preflight/01_inspect_schema.sql';
  end if;
  if to_regclass('public.tenants') is null then
    raise exception 'public.tenants does not exist — stop and run preflight/01_inspect_schema.sql';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'Supabase roles anon/authenticated not found — this is not a Supabase project';
  end if;
end $$;

-- 1. user_profiles: reset API-role privileges to an explicit allow-list -------
--    (REVOKE at table level also removes any column-level grants.)
revoke all on public.user_profiles from anon;
revoke insert, update, delete, truncate, references, trigger, select
  on public.user_profiles from authenticated;

-- 1a. SELECT: every column EXCEPT secrets / billing identifiers.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_profiles'
    and column_name not in ('password_hash', 'clerk_user_id',
                            'stripe_customer_id', 'stripe_subscription_id',
                            'stripe_subscription_status', 'subscription_status');
  execute format('grant select (%s) on public.user_profiles to authenticated', cols);
end $$;

-- 1b. UPDATE: only self-service columns that exist in this database.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_profiles'
    and column_name in ('display_name', 'avatar_url', 'interests', 'goals',
                        'onboarding_complete', 'bio', 'website_url',
                        'location_city', 'location_country', 'lat', 'lng',
                        'default_surface',
                        'ai_requests_today', 'ai_requests_reset_at',
                        'onboard_requests_today', 'onboard_requests_reset_at',
                        'last_active_at', 'updated_at');
  execute format('grant update (%s) on public.user_profiles to authenticated', cols);
end $$;

-- 2. Defence in depth: guard trigger --------------------------------------
--    Blocks changes to privileged columns by any role other than the
--    trusted ones, even if someone later re-grants UPDATE by mistake.
--    Uses to_jsonb() so it tolerates columns that do not exist yet.
create or replace function public.guard_user_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  k       text;
  guarded text[] := array[
    'id', 'role', 'tenant_id', 'email', 'password_hash', 'clerk_user_id',
    'xp_balance', 'missions_completed', 'followers_count', 'following_count',
    'subscription_tier', 'subscription_status', 'trial_started_at',
    'trial_ends_at', 'trial_reminder_sent', 'stripe_customer_id',
    'stripe_subscription_id', 'stripe_subscription_status', 'public_key'
  ];
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role',
                      'supabase_auth_admin') then
    return new;
  end if;

  foreach k in array guarded loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      -- trg_expire_trial (006) may downgrade a lapsed trial to 'free'
      if k = 'subscription_tier' and (to_jsonb(new) ->> k) = 'free' then
        continue;
      end if;
      raise exception 'user_profiles.% can only be changed by the service role', k
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function public.guard_user_profile_privileged_columns()
  from public, anon, authenticated;

drop trigger if exists trg_guard_user_profile_privileged on public.user_profiles;
create trigger trg_guard_user_profile_privileged
  before update on public.user_profiles
  for each row execute function public.guard_user_profile_privileged_columns();

-- 3. tenants: no tenant creation by API roles; tenant admins may only edit
--    name / logo_url (plan, slug, settings go through your server routes).
--    Policy "authenticated_create_tenant" (018) is intentionally LEFT in place
--    (inert without the INSERT privilege) so no policy is dropped.
revoke insert, delete, truncate on public.tenants from anon, authenticated;
revoke update on public.tenants from anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'tenants'
    and column_name in ('name', 'logo_url', 'updated_at');
  execute format('grant update (%s) on public.tenants to authenticated', cols);
end $$;

commit;

-- ============================================================================
-- VERIFY (read-only; run after the script):
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_schema='public' and table_name='user_profiles'
--     and grantee in ('anon','authenticated') and privilege_type='UPDATE'
--   order by column_name;
--   -- expect NO row for role, tenant_id, xp_balance, subscription_tier,
--   -- email, password_hash, stripe_*.
-- Then run validation/01_validate_security.sql.
-- ============================================================================
