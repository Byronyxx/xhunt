-- ============================================================================
-- 038_enterprise_org_registration.sql                  [Phase 2 — additive only]
-- ----------------------------------------------------------------------------
-- PURPOSE     : Self-service Enterprise organization registration.
--   * tenants gains an owner, a status and an activation timestamp.
--   * enterprise_registrations keeps a registrant's intent (org name, terms
--     acceptance) SERVER-SIDE until their email address is verified.
--   * activate_enterprise_org(user_id) creates the tenant and makes the user its
--     owner (role tenant_admin + tenants.owner_user_id) atomically and
--     idempotently, and ONLY after auth.users.email_confirmed_at is set.
--     Registration alone therefore never grants any organization access.
-- NUMBERING   : 037 is intentionally skipped — the Phase 3 package reserved it
--               for the optional audit_logs / branding-bucket migration.
-- PREREQS     : 001-036 applied (032's guard trigger on user_profiles in
--               particular: this function runs as its owner, `postgres`, which
--               that trigger allows).
-- DESTRUCTIVE : NO. Additive columns/table/function only. No existing row is
--               changed. Existing tenants get status='active' (the default),
--               owner_user_id NULL, activated_at NULL.
-- IDEMPOTENT  : YES (IF NOT EXISTS / CREATE OR REPLACE / guarded constraint).
-- SECURITY    : * New tenant columns are NOT writable from the browser: 032
--                 granted UPDATE on tenants only for name/logo_url/updated_at.
--               * enterprise_registrations: RLS on, no policies, all API-role
--                 privileges revoked -> reachable only with the service role.
--               * activate_enterprise_org: SECURITY DEFINER, search_path
--                 pinned, EXECUTE only for service_role.
-- NOT INCLUDED: trial timestamps and subscription state (Phases 3 and 4).
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.tenants') is null or to_regclass('public.user_profiles') is null then
    raise exception 'public.tenants / public.user_profiles missing — originals 001-036 not applied';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'service_role not found — this is not a Supabase project';
  end if;
end $$;

-- 1. tenants: owner, status, activation -------------------------------------
alter table public.tenants
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null,
  add column if not exists status        text not null default 'active',
  add column if not exists activated_at  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.tenants'::regclass
                   and conname  = 'tenants_status_check') then
    alter table public.tenants
      add constraint tenants_status_check check (status in ('active', 'suspended'));
  end if;
end $$;

-- one organization per owner (legacy tenants keep owner_user_id NULL)
create unique index if not exists tenants_owner_user_id_key
  on public.tenants (owner_user_id)
  where owner_user_id is not null;

-- 2. enterprise_registrations -------------------------------------------------
create table if not exists public.enterprise_registrations (
  user_id           uuid        primary key references auth.users (id) on delete cascade,
  email             text        not null check (email = lower(email)),
  org_name          text        not null check (char_length(btrim(org_name)) between 2 and 120),
  org_name_key      text        not null check (char_length(org_name_key) >= 2),
  terms_accepted_at timestamptz not null,
  tenant_id         uuid        references public.tenants (id) on delete set null,
  created_at        timestamptz not null default now(),
  activated_at      timestamptz
);

create unique index if not exists enterprise_registrations_name_key_idx
  on public.enterprise_registrations (org_name_key);
create index if not exists enterprise_registrations_email_idx
  on public.enterprise_registrations (email);

alter table public.enterprise_registrations enable row level security;
-- Supabase default privileges would otherwise hand anon/authenticated table
-- grants; RLS with no policy already denies them, revoke as defence in depth.
revoke all on public.enterprise_registrations from anon, authenticated;
grant select, insert, update, delete on public.enterprise_registrations to service_role;

comment on table public.enterprise_registrations is
  'Server-side record of an Enterprise sign-up (org name, terms acceptance) kept until the registrant verifies their email. Service role only.';

-- 3. activation -----------------------------------------------------------------
--    SQLSTATEs raised: XH001 email not verified, XH002 account ineligible
--    (already in an organization or not a plain hunter profile), XH003 profile
--    missing, XH004 slug generation failed.
create or replace function public.activate_enterprise_org(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reg        public.enterprise_registrations%rowtype;
  v_confirmed  timestamptz;
  v_cur_tenant uuid;
  v_role       text;
  v_tenant_id  uuid;
  v_base       text;
  v_slug       text;
  v_try        int := 0;
begin
  -- Serialise concurrent activations for the same user on the registration row.
  select * into v_reg
  from public.enterprise_registrations
  where user_id = p_user_id
  for update;

  if not found then
    return null;                       -- not an Enterprise registrant
  end if;

  if v_reg.tenant_id is not null then
    return v_reg.tenant_id;            -- already activated: idempotent no-op
  end if;

  select u.email_confirmed_at into v_confirmed
  from auth.users u
  where u.id = p_user_id;

  if v_confirmed is null then
    raise exception 'email_not_verified' using errcode = 'XH001';
  end if;

  select p.tenant_id, p.role into v_cur_tenant, v_role
  from public.user_profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'profile_missing' using errcode = 'XH003';
  end if;

  if v_cur_tenant is not null or v_role <> 'participant' then
    raise exception 'ineligible_account' using errcode = 'XH002';
  end if;

  v_base := trim(both '-' from lower(regexp_replace(v_reg.org_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if v_base = '' then
    v_base := 'org';
  end if;
  v_base := left(v_base, 40);
  v_slug := v_base;
  while exists (select 1 from public.tenants t where t.slug = v_slug) loop
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'slug_generation_failed' using errcode = 'XH004';
    end if;
    v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
  end loop;

  insert into public.tenants (name, slug, settings, status, owner_user_id, activated_at)
  values (btrim(v_reg.org_name), v_slug,
          jsonb_build_object('source', 'enterprise_signup'),
          'active', p_user_id, now())
  returning id into v_tenant_id;

  update public.user_profiles
     set tenant_id = v_tenant_id,
         role = 'tenant_admin',
         onboarding_complete = true
   where id = p_user_id;

  update public.enterprise_registrations
     set tenant_id = v_tenant_id,
         activated_at = now()
   where user_id = p_user_id;

  return v_tenant_id;
end;
$$;

revoke all on function public.activate_enterprise_org(uuid) from public, anon, authenticated;
grant execute on function public.activate_enterprise_org(uuid) to service_role;

comment on function public.activate_enterprise_org(uuid) is
  'Creates the organization for a verified Enterprise registrant and makes them its owner (tenant_admin). Idempotent. Service role only.';

commit;

-- ============================================================================
-- ROLLBACK (emergency only — run manually; never part of the migration):
--   begin;
--   drop function if exists public.activate_enterprise_org(uuid);
--   drop table    if exists public.enterprise_registrations;
--   drop index    if exists public.tenants_owner_user_id_key;
--   alter table public.tenants drop constraint if exists tenants_status_check;
--   alter table public.tenants
--     drop column if exists activated_at,
--     drop column if exists status,
--     drop column if exists owner_user_id;
--   commit;
-- NOTE: rolling back after organizations were activated detaches them from
-- their owner record; users keep tenant_id/role (set on user_profiles).
-- ============================================================================
