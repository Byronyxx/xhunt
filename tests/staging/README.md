# Staging test harness: missions direct-write guard (migration 039)

Tests `supabase/migrations/039_missions_direct_write_guard.sql` against **xhunt-staging only**
(`vzcrxjmfqpspcqlwvozs`) with real sign-ins. It never applies or rolls back the migration: you do
that between runs. It has no SQL or DDL path at all.

**Status:** written without network access to staging; never run by its author. The SQL itself was
checked on a local throwaway Postgres replica only (not staging, not real sign-ins). Read the first
evidence file critically.

## Before you start
- Node 20+ (uses built-in `fetch`). For the route cases: `npm ci` in the repo root, and no other
  `next dev` running (Next allows one dev server per checkout).
- Checkout must be `fix/missions-direct-write-guard`. The route cases only run if `src/`,
  `package.json`, `package-lock.json` and `next.config.ts` are identical to the verified fix commit
  `f250233f84798f9c70cbf96e164f8ea87e956ec4` and the tree is clean there.
- Settings come **only** from environment variables. Set them in your shell, never in a file:

```bash
export SUPABASE_URL=https://vzcrxjmfqpspcqlwvozs.supabase.co
export SUPABASE_ANON_KEY=...            # public key of xhunt-staging
export SUPABASE_SERVICE_ROLE_KEY=...    # secret key of xhunt-staging
```

The harness **refuses to run** (exit 2) if: the URL is not exactly the staging URL; the production ref
`mtimvvmycryssxzzvnbj` appears in any environment variable or in any `.env*` file in the repo root;
a key's JWT `ref` claim is a different project or its `role` claim is wrong; a setting is missing.

## Run order
```bash
H=tests/staging/missions-direct-write-guard.mjs

# 0. Check settings and guards. No network, nothing written.
node $H --mode dry-run

# 1. BEFORE the fix: proves the bypass (CB-1..CB-5, CB-5b, CB-9, CB-10). PASS here = bypass reproduced.
node $H --mode baseline

# 2. Operator applies supabase/migrations/039_missions_direct_write_guard.sql to staging.
#    Record live definitions (queries below).

# 3. AFTER the fix: refusals, positive controls, unchanged behaviour, service-role path, and RT-01..RT-12.
node $H --mode after-fix            # add --skip-route to omit the route cases

# 4. Operator applies supabase/rollbacks/039_missions_direct_write_guard_rollback.sql.
#    Record live definitions and diff them against step 1's recording.
node $H --mode after-rollback       # same cases and expectations as baseline: the bypass is back

# 5. Operator re-applies the migration. Record definitions. Then re-run the full after-suite:
node $H --mode after-fix
```
The final staging state has the migration applied (end of step 5).

Options: `--evidence-dir <dir>` (default: a temp directory), `--repo-root <dir>`, `--port <n>` (default 3100).

## Live definitions to record (read-only; run in the Supabase SQL editor for staging)
```sql
select policyname, cmd, roles::text, qual, with_check from pg_policies
 where schemaname='public' and tablename='missions' order by cmd, policyname;
select tgname, tgenabled, pg_get_triggerdef(oid) from pg_trigger
 where tgrelid='public.missions'::regclass and not tgisinternal;
select proname, prosecdef, proconfig::text, pg_get_functiondef(oid) from pg_proc
 where pronamespace='public'::regnamespace and proname='guard_missions_protected_columns';
```
Record them: before migration, after migration, after rollback, after re-apply. After rollback the policy
text must equal the "before migration" recording and the trigger and function must be gone.

## What each run does
1. Records global counts (missions, tenants, user_profiles, auth users).
2. Creates two organisations and fixture users through the admin API (`email_confirm: true`,
   `<marker>-<role>@example.invalid`, random in-memory passwords): in org A a tenant_admin, platform_admin,
   mission_creator, participant and analyst; in org B a tenant_admin and mission_creator; one user with no
   organisation (plus one extra tenant_admin in org A for RT-02c, route runs only). Roles/tenants are set
   through the service role. Every title carries a unique run marker.
3. Runs the cases with real password sign-ins through the REST API (public key + the user's own access token).
   Each case records marker-scoped mission counts before and after.
4. In a `finally` step: stops the dev server; deletes only this run's missions (tracked ids and the unique
   title marker), users, profile leftovers and tenants; re-counts and compares with step 1.
5. Writes an evidence JSON (mode `0600`) with every case `PASS`, `FAIL` or `NOT RUN`, secrets redacted.

Exit codes: `0` all PASS and counts equal; `1` any FAIL, count mismatch or fatal error; `2` refused or bad
settings. A `NOT RUN` is not a pass: read its `note`.

## What the harness assumes
- **Local dev server (route cases):** it starts `npx next dev -p <port>` itself in the repo root, with
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` set in the child
  process environment only (staging values), then stops it. RT-12 restarts it with a deliberately invalid service
  key. The route code reads only those three variables; any other variable the app wants is inherited from your
  shell. Nothing is deployed.
- **Session cookies:** the route authenticates through `@supabase/ssr`. The harness builds the cookie
  `sb-vzcrxjmfqpspcqlwvozs-auth-token` as `base64-` + base64url(session JSON), chunked at 3180 characters
  (the `@supabase/ssr` ^0.10 format, **an assumption**). A precheck asserts signed-out GET = 401 and signed-in GET
  = 200; if it fails, all RT cases are `NOT RUN` with the reason, never silently passed.
- **Schema:** `tenants` needs `name` and a unique `slug`; signing up creates a `participant` profile with no
  tenant (migration 030 trigger); the harness then sets `role` and `tenant_id` through the service role.
- **Baseline expectations:** before the fix, CB-1..CB-5, CB-9, CB-10 are ACCEPTED/CHANGED and CB-5b is READABLE.
  After the fix they are REFUSED/UNCHANGED, and CB-5b is NOT_READABLE because CB-5 stored nothing.
- **Observed items:** `OBS-PLAT-DELETE` records the platform_admin delete as observed (policy unchanged; schema
  read says allowed). `AF-DEMOTED-PUBLISH` and `RT-06p` are extras beyond the handoff.
- **Admin `is_public`:** the route accepts any boolean for admins, so the database does too; admin
  "active + public" inserts are expected to be ACCEPTED.

## Not covered
No approval workflow, `submitted` status, grants/TRUNCATE, other tables or routes, or Production. Evidence files
are written outside the repo by default: do not commit them.
