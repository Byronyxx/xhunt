-- Migration 031: Session idle timeout
--
-- Adds last_active_at to user_profiles so src/proxy.ts can force-sign-out
-- any authenticated request that has gone idle past its role's threshold:
--   - 30 minutes for hunters (role = 'participant')
--   - 45 minutes for everyone tenant-side (mission_creator, analyst,
--     tenant_admin, platform_admin — see the role CHECK constraint in
--     migration 001)
--
-- Enforcement and the throttled-write logic live in src/proxy.ts, not
-- here — this migration is schema only.

alter table public.user_profiles
  add column if not exists last_active_at timestamptz not null default now();

comment on column public.user_profiles.last_active_at is
  'Last-seen timestamp for this user, throttle-updated by src/proxy.ts (at most once per ~60s per user). Used to enforce the inactivity-logout timeout — see proxy.ts for the actual enforcement.';
