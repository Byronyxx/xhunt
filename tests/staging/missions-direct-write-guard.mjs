#!/usr/bin/env node
// =============================================================================
// XHUNT staging harness: public.missions direct-write guard (migration 039)
// =============================================================================
// STATUS: written without network access to staging. Syntax-checked and the
// dry-run/guard paths exercised locally; the staging cases have NEVER been run
// by the author. Treat the first real run as a shakedown and read the evidence.
//
// WHAT IT DOES: real sign-ins (password grant) through the Supabase REST API
// with the public key, plus service-role fixtures, against xhunt-staging ONLY.
// It never applies or rolls back the migration (it contains no SQL execution
// and no DDL path). The operator applies the migration between runs.
//
// MODES (one run per mode):
//   dry-run         checks settings, target guards and repo checkout. No network
//                   calls, no files written, no server started.
//   baseline        BEFORE the migration: CB-1..CB-5, CB-5b, CB-9, CB-10.
//                   Expected: every one of them is ACCEPTED/CHANGED/READABLE
//                   (the proven bypass).
//   after-fix       AFTER the migration: all database cases (refusals, positive
//                   controls, unchanged behaviour) plus route cases RT-01..RT-12
//                   (needs a local dev server; use --skip-route to omit).
//   after-rollback  AFTER the rollback script: same cases as baseline, same
//                   expectations (proves the rollback restored prior behaviour).
// "Re-apply and re-run" = apply the migration again, then run after-fix again.
//
// SETTINGS (environment variables only; never written anywhere):
//   SUPABASE_URL                must be exactly https://vzcrxjmfqpspcqlwvozs.supabase.co
//   SUPABASE_ANON_KEY           public (anon/publishable) key of that project
//   SUPABASE_SERVICE_ROLE_KEY   service-role (secret) key of that project
// The run refuses (exit 2) if the production ref appears in ANY environment
// variable name or value, or in any .env* file of the repo root, or in a key's
// JWT "ref" claim, or if a key's role claim is wrong.
//
// FLAGS: --mode <m>  --evidence-dir <dir>  --repo-root <dir>  --port <n>
//        --skip-route
// EXIT: 0 all PASS and cleanup counts equal | 1 any FAIL / count mismatch /
//       fatal error | 2 refused or bad settings.
// =============================================================================
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS_VERSION = '1.0.0';
const STAGING_REF = 'vzcrxjmfqpspcqlwvozs';
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const PROD_REF = 'mtimvvmycryssxzzvnbj';
const VERIFIED_FIX_SHA = 'f250233f84798f9c70cbf96e164f8ea87e956ec4';
const MODES = ['dry-run', 'baseline', 'after-fix', 'after-rollback'];
const here = path.dirname(fileURLToPath(import.meta.url));

class Refusal extends Error {}
class NotRun extends Error {}

// ---------------------------------------------------------------- redaction --
const secrets = new Set();
const addSecret = (s) => { if (s && String(s).length >= 8) secrets.add(String(s)); };
const PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
];
function redact(value) {
  let t = String(value);
  for (const s of secrets) t = t.split(s).join('[REDACTED]');
  for (const p of PATTERNS) t = t.replace(p, '[REDACTED]');
  return t;
}
const log = (...a) => console.log(redact(a.join(' ')));

// --------------------------------------------------------------------- args --
function parseArgs(argv) {
  const a = { mode: null, evidenceDir: path.join(os.tmpdir(), 'xhunt-missions-guard-evidence'), repoRoot: path.resolve(here, '..', '..'), port: 3100, skipRoute: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--mode') a.mode = argv[++i];
    else if (k === '--evidence-dir') a.evidenceDir = path.resolve(argv[++i]);
    else if (k === '--repo-root') a.repoRoot = path.resolve(argv[++i]);
    else if (k === '--port') a.port = Number(argv[++i]);
    else if (k === '--skip-route') a.skipRoute = true;
    else throw new Refusal(`Unknown argument: ${k}`);
  }
  if (!MODES.includes(a.mode)) throw new Refusal(`--mode must be one of: ${MODES.join(', ')}`);
  if (!Number.isInteger(a.port) || a.port < 1024 || a.port > 65000) throw new Refusal('--port must be 1024-65000');
  return a;
}

// ------------------------------------------------------------ config guards --
function jwtClaims(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return null; }
}
function loadConfig(args) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [['SUPABASE_URL', url], ['SUPABASE_ANON_KEY', anon], ['SUPABASE_SERVICE_ROLE_KEY', service]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Refusal(`Missing environment variable(s): ${missing.join(', ')}`);
  addSecret(anon); addSecret(service);
  if (url !== STAGING_URL) throw new Refusal(`SUPABASE_URL must be exactly ${STAGING_URL}`);
  for (const [k, v] of Object.entries(process.env)) {
    if (k.includes(PROD_REF) || String(v ?? '').includes(PROD_REF)) {
      throw new Refusal(`Production project ref found in environment variable "${k}". Refusing to run.`);
    }
  }
  if (fs.existsSync(args.repoRoot)) {
    for (const f of fs.readdirSync(args.repoRoot).filter((n) => n === '.env' || n.startsWith('.env.'))) {
      let content = '';
      try { content = fs.readFileSync(path.join(args.repoRoot, f), 'utf8'); } catch { /* unreadable: ignore */ }
      if (content.includes(PROD_REF)) throw new Refusal(`Production project ref found in ${f} in the repo root. Refusing to run.`);
    }
  }
  if (anon === service) throw new Refusal('SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are identical.');
  const notes = [];
  for (const [label, key, role] of [['anon', anon, 'anon'], ['service', service, 'service_role']]) {
    const c = jwtClaims(key);
    if (c) {
      if (c.ref !== STAGING_REF) throw new Refusal(`The ${label} key is bound to a different project (ref claim mismatch).`);
      if (c.role !== role) throw new Refusal(`The ${label} key has the wrong role claim.`);
      notes.push(`${label}: JWT ref/role verified`);
    } else {
      notes.push(`${label}: opaque key format; project binding verified by URL only`);
    }
  }
  return { url, anon, service, keyNotes: notes };
}

// -------------------------------------------------------------- repo checks --
function git(repoRoot, ...a) { return execFileSync('git', ['-C', repoRoot, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function repoChecks(repoRoot) {
  const r = { head: null, branch: null, routeReady: false, reasons: [] };
  try {
    r.head = git(repoRoot, 'rev-parse', 'HEAD');
    r.branch = git(repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD');
  } catch { r.reasons.push('repo root is not a git checkout'); return r; }
  try { git(repoRoot, 'cat-file', '-e', `${VERIFIED_FIX_SHA}^{commit}`); } catch { r.reasons.push(`verified fix commit ${VERIFIED_FIX_SHA} is not in this checkout`); return r; }
  const watched = ['src', 'package.json', 'package-lock.json', 'next.config.ts'];
  const diff = git(repoRoot, 'diff', '--name-only', VERIFIED_FIX_SHA, 'HEAD', '--', ...watched);
  if (diff) r.reasons.push(`route-relevant files differ from the verified fix commit: ${diff.split('\n').join(', ')}`);
  const dirty = git(repoRoot, 'status', '--porcelain', '--', ...watched);
  if (dirty) r.reasons.push('uncommitted changes in src/package files');
  if (!fs.existsSync(path.join(repoRoot, 'node_modules', 'next'))) r.reasons.push('node_modules/next missing (run npm ci)');
  r.routeReady = r.reasons.length === 0;
  return r;
}

// ------------------------------------------------------------------ http ----
async function http(method, url, { headers = {}, body, raw = false } = {}) {
  const res = await fetch(url, { method, headers: { ...headers, ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)), signal: AbortSignal.timeout(30000), redirect: 'manual' });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, ok: res.ok, text, json, headers: res.headers };
}
const looksJwt = (k) => k.split('.').length === 3;
const enc = encodeURIComponent;

// ---------------------------------------------------------------- main ------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig(args);
  const repo = repoChecks(args.repoRoot);
  const mode = args.mode;
  const marker = `XHG-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const state = { tenants: {}, tenantIds: [], users: {}, userIds: [], missionIds: [], sessions: {} };
  const results = new Map();
  let ctx = { cb5Title: null };

  // ---- REST helpers (closures over cfg/state) ----
  const svcHeaders = () => ({ apikey: cfg.service, ...(looksJwt(cfg.service) ? { Authorization: `Bearer ${cfg.service}` } : {}) });
  const svc = (p, { method = 'GET', body, prefer, extra } = {}) => http(method, `${cfg.url}/rest/v1/${p}`, { headers: { ...svcHeaders(), ...(prefer ? { Prefer: prefer } : {}), ...(extra ?? {}) }, body });
  const usr = (actor, p, { method = 'GET', body, prefer } = {}) => {
    if (actor === 'anon') return http(method, `${cfg.url}/rest/v1/${p}`, { headers: { apikey: cfg.anon, ...(looksJwt(cfg.anon) ? { Authorization: `Bearer ${cfg.anon}` } : {}), ...(prefer ? { Prefer: prefer } : {}) }, body });
    const tok = state.sessions[actor]?.access_token;
    if (!tok) throw new NotRun(`no session for ${actor}`);
    return http(method, `${cfg.url}/rest/v1/${p}`, { headers: { apikey: cfg.anon, Authorization: `Bearer ${tok}`, ...(prefer ? { Prefer: prefer } : {}) }, body });
  };
  const count = async (table, filter = '') => {
    const r = await svc(`${table}?select=id${filter ? `&${filter}` : ''}`, { extra: { Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' } });
    const m = /\/(\d+)$/.exec(r.headers.get('content-range') ?? '');
    if (!m) throw new Error(`count failed for ${table} (HTTP ${r.status})`);
    return Number(m[1]);
  };
  const countAuthUsers = async () => {
    let n = 0;
    for (let page = 1; page < 200; page++) {
      const r = await http('GET', `${cfg.url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: svcHeaders() });
      if (!r.ok) throw new Error(`auth user count failed (HTTP ${r.status})`);
      const len = (r.json?.users ?? []).length; n += len;
      if (len < 200) break;
    }
    return n;
  };
  const globalCounts = async () => ({ missions: await count('missions'), tenants: await count('tenants'), user_profiles: await count('user_profiles'), auth_users: await countAuthUsers() });
  const markerCount = () => count('missions', `title=like.${marker}*`);
  const snap = async (id) => {
    const r = await svc(`missions?id=eq.${id}&select=*`);
    const row = Array.isArray(r.json) ? r.json[0] : null;
    if (!row) return null;
    const { updated_at, ...rest } = row; void updated_at; // updated_at is not part of the comparison
    return rest;
  };

  // ---- fixtures ----
  const U = (k) => state.users[k].id;
  const T = (k) => state.tenants[k];
  const USERS = [
    { key: 'adminA', role: 'tenant_admin', org: 'A' }, { key: 'platA', role: 'platform_admin', org: 'A' },
    { key: 'creatorA', role: 'mission_creator', org: 'A' }, { key: 'partA', role: 'participant', org: 'A' },
    { key: 'analystA', role: 'analyst', org: 'A' }, { key: 'adminB', role: 'tenant_admin', org: 'B' },
    { key: 'creatorB', role: 'mission_creator', org: 'B' }, { key: 'noorg', role: 'participant', org: null },
  ];
  async function makeUser(spec) {
    const password = crypto.randomBytes(18).toString('base64url'); addSecret(password);
    const email = `${marker.toLowerCase()}-${spec.key.toLowerCase()}@example.invalid`;
    const r = await http('POST', `${cfg.url}/auth/v1/admin/users`, { headers: svcHeaders(), body: { email, password, email_confirm: true, user_metadata: { run_marker: marker } } });
    if (!r.ok || !r.json?.id) throw new Error(`create user ${spec.key} failed (HTTP ${r.status})`);
    state.userIds.push(r.json.id);
    state.users[spec.key] = { id: r.json.id, email };
    const patch = { role: spec.role, tenant_id: spec.org ? T(spec.org) : null };
    const have = await svc(`user_profiles?id=eq.${r.json.id}&select=id`);
    let w;
    if (Array.isArray(have.json) && have.json.length) w = await svc(`user_profiles?id=eq.${r.json.id}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
    else w = await svc('user_profiles', { method: 'POST', body: { id: r.json.id, email, ...patch }, prefer: 'return=minimal' });
    if (!w.ok) throw new Error(`profile setup for ${spec.key} failed (HTTP ${w.status})`);
    const s = await signIn(email, password);
    state.sessions[spec.key] = s;
    return { email, password };
  }
  async function signIn(email, password) {
    const r = await http('POST', `${cfg.url}/auth/v1/token?grant_type=password`, { headers: { apikey: cfg.anon }, body: { email, password } });
    if (!r.ok || !r.json?.access_token) throw new Error(`sign-in failed (HTTP ${r.status})`);
    addSecret(r.json.access_token); addSecret(r.json.refresh_token);
    return r.json;
  }
  async function setupFixtures(withLogoutUser) {
    for (const k of ['A', 'B']) {
      const r = await svc('tenants', { method: 'POST', body: { name: `${marker} org ${k}`, slug: `${marker.toLowerCase()}-${k.toLowerCase()}` }, prefer: 'return=representation' });
      if (!r.ok || !r.json?.[0]?.id) throw new Error(`create tenant ${k} failed (HTTP ${r.status})`);
      state.tenants[k] = r.json[0].id; state.tenantIds.push(r.json[0].id);
    }
    for (const u of USERS) await makeUser(u);
    if (withLogoutUser) await makeUser({ key: 'logoutUser', role: 'tenant_admin', org: 'A' });
  }

  // ---- case actions ----
  async function seed(authorKey, { tenant = 'A', status = 'draft', is_public = false, label }) {
    const r = await svc('missions', { method: 'POST', body: { tenant_id: T(tenant), created_by: authorKey ? U(authorKey) : null, title: `${marker} seed ${label}`, status, is_public }, prefer: 'return=representation' });
    if (!r.ok || !r.json?.[0]?.id) throw new Error(`seed ${label} failed (HTTP ${r.status})`);
    state.missionIds.push(r.json[0].id);
    return r.json[0].id;
  }
  async function doInsert(caseId, actor, spec) {
    const title = `${marker} ${caseId}`;
    const row = { tenant_id: T(spec.tenant ?? 'A'), title };
    for (const k of ['created_by', 'status', 'is_public']) if (k in spec) row[k] = spec[k];
    const before = await markerCount();
    const r = await usr(actor, 'missions', { method: 'POST', body: row, prefer: 'return=minimal' });
    const found = await svc(`missions?title=eq.${enc(title)}&select=id,tenant_id,created_by,status,is_public`);
    const rows = Array.isArray(found.json) ? found.json : [];
    rows.forEach((x) => state.missionIds.push(x.id));
    const after = await markerCount();
    const observed = rows.length === 0 ? 'REFUSED' : rows.length === 1 ? 'ACCEPTED' : 'ANOMALY';
    return { observed, http: r.status, rows_before: before, rows_after: after, stored: rows[0] ?? null, title };
  }
  async function doUpdate(actor, id, patch) {
    const before = await markerCount();
    const b = await snap(id);
    const r = await usr(actor, `missions?id=eq.${id}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
    const a = await snap(id);
    const after = await markerCount();
    return { observed: JSON.stringify(b) !== JSON.stringify(a) ? 'CHANGED' : 'UNCHANGED', http: r.status, rows_before: before, rows_after: after, before: b, after: a };
  }
  async function doDelete(actor, id) {
    const before = await markerCount();
    const r = await usr(actor, `missions?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
    const a = await snap(id);
    return { observed: a ? 'KEPT' : 'DELETED', http: r.status, rows_before: before, rows_after: await markerCount() };
  }
  async function doRead(actor, id) {
    const r = await usr(actor, `missions?id=eq.${id}&select=id`);
    return { observed: Array.isArray(r.json) && r.json.length ? 'READABLE' : 'NOT_READABLE', http: r.status };
  }

  // ---- case definitions (db) ----
  const defs = [];
  const add = (d) => defs.push(d);
  // set 'cb' runs in every non-dry mode; set 'db' only in after-fix; set 'route' only in after-fix.
  add({ id: 'CB-1', set: 'cb', actor: 'creatorA', org: 'A', desc: 'mission_creator inserts with created_by = another org A user', before: 'ACCEPTED', after: 'REFUSED',
    run: () => doInsert('CB-1', 'creatorA', { created_by: U('adminA'), status: 'draft', is_public: false }) });
  add({ id: 'CB-2', set: 'cb', actor: 'creatorA', org: 'A', desc: 'mission_creator inserts with created_by = an org B user', before: 'ACCEPTED', after: 'REFUSED',
    run: () => doInsert('CB-2', 'creatorA', { created_by: U('creatorB'), status: 'draft', is_public: false }) });
  add({ id: 'CB-3', set: 'cb', actor: 'creatorA', org: 'A', desc: 'mission_creator inserts with created_by NULL', before: 'ACCEPTED', after: 'REFUSED',
    run: () => doInsert('CB-3', 'creatorA', { created_by: null, status: 'draft', is_public: false }) });
  add({ id: 'CB-4', set: 'cb', actor: 'creatorA', org: 'A', desc: 'mission_creator inserts status archived', before: 'ACCEPTED', after: 'REFUSED',
    run: () => doInsert('CB-4', 'creatorA', { created_by: U('creatorA'), status: 'archived', is_public: false }) });
  add({ id: 'CB-5', set: 'cb', actor: 'creatorA', org: 'A', desc: 'mission_creator inserts an active public mission', before: 'ACCEPTED', after: 'REFUSED',
    run: async () => { const r = await doInsert('CB-5', 'creatorA', { created_by: U('creatorA'), status: 'active', is_public: true }); ctx.cb5Title = r.title; return r; } });
  add({ id: 'CB-5b', set: 'cb', actor: 'anon', org: '-', desc: 'anon can read the CB-5 mission (after fix: nothing was stored, so nothing to read)', before: 'READABLE', after: 'NOT_READABLE',
    run: async () => {
      if (!ctx.cb5Title) throw new NotRun('CB-5 did not run');
      const r = await usr('anon', `missions?title=eq.${enc(ctx.cb5Title)}&select=id`);
      return { observed: Array.isArray(r.json) && r.json.length ? 'READABLE' : 'NOT_READABLE', http: r.status };
    } });
  add({ id: 'CB-9', set: 'cb', actor: 'creatorA', org: 'A', desc: 'mission_creator archives own mission', before: 'CHANGED', after: 'UNCHANGED',
    run: async () => doUpdate('creatorA', await seed('creatorA', { label: 'CB-9' }), { status: 'archived' }) });
  add({ id: 'CB-10', set: 'cb', actor: 'creatorA', org: 'A', desc: 'mission_creator makes own mission public', before: 'CHANGED', after: 'UNCHANGED',
    run: async () => doUpdate('creatorA', await seed('creatorA', { label: 'CB-10' }), { is_public: true }) });

  // after-fix refusals
  const refuseIns = (id, actor, org, desc, spec) => add({ id, set: 'db', actor, org, desc, after: 'REFUSED', run: () => doInsert(id, actor, typeof spec === 'function' ? spec() : spec) });
  refuseIns('AF-ADM-ARCH', 'adminA', 'A', 'tenant_admin inserts archived', () => ({ created_by: U('adminA'), status: 'archived', is_public: false }));
  refuseIns('AF-PLAT-ARCH', 'platA', 'A', 'platform_admin inserts archived', () => ({ created_by: U('platA'), status: 'archived', is_public: false }));
  refuseIns('AF-CRE-PUBLIC', 'creatorA', 'A', 'mission_creator inserts a draft with is_public true', () => ({ created_by: U('creatorA'), status: 'draft', is_public: true }));
  refuseIns('AF-CRE-ACTIVE', 'creatorA', 'A', 'mission_creator inserts status active (private)', () => ({ created_by: U('creatorA'), status: 'active', is_public: false }));
  refuseIns('AF-CRE-NOSTATUS', 'creatorA', 'A', 'mission_creator inserts with no status (column default active)', () => ({ created_by: U('creatorA') }));
  const refuseUpd = (id, actor, org, desc, authorKey, patchFn) => add({ id, set: 'db', actor, org, desc, after: 'UNCHANGED',
    run: async () => doUpdate(actor, await seed(authorKey, { label: id }), patchFn()) });
  refuseUpd('AF-ADM-CREATEDBY', 'adminA', 'A', 'tenant_admin changes created_by on an own-org mission', 'creatorA', () => ({ created_by: U('adminA') }));
  refuseUpd('AF-ADM-TENANT', 'adminA', 'A', 'tenant_admin changes tenant_id of an own-org mission', 'creatorA', () => ({ tenant_id: T('B') }));
  refuseUpd('AF-ADM-ID', 'adminA', 'A', 'tenant_admin changes id of an own-org mission', 'creatorA', () => ({ id: crypto.randomUUID() }));
  refuseUpd('AF-ADM-CREATEDAT', 'adminA', 'A', 'tenant_admin changes created_at', 'creatorA', () => ({ created_at: '2000-01-01T00:00:00Z' }));
  refuseUpd('AF-PLAT-CREATEDBY', 'platA', 'A', 'platform_admin changes created_by on an own-org mission', 'creatorA', () => ({ created_by: U('platA') }));
  refuseUpd('CB-11', 'creatorA', 'A', 'mission_creator reassigns the creator of own mission', 'creatorA', () => ({ created_by: U('adminA') }));
  refuseUpd('AF-CRE-TENANT', 'creatorA', 'A', 'mission_creator changes tenant_id of own mission', 'creatorA', () => ({ tenant_id: T('B') }));
  refuseUpd('AF-DEMOTED-PUBLISH', 'partA', 'A', 'EXTRA (stricter rule): non-admin author (participant) publishes own mission', 'partA', () => ({ status: 'active' }));
  // positive controls
  const posIns = (id, actor, org, desc, spec) => add({ id, set: 'db', actor, org, desc, after: 'ACCEPTED',
    run: async () => { const r = await doInsert(id, actor, typeof spec === 'function' ? spec() : spec); if (r.observed === 'ACCEPTED' && r.stored?.created_by !== U(actor)) { r.observed = 'ACCEPTED_WRONG_CREATOR'; } return r; } });
  posIns('POS-CRE-DRAFT', 'creatorA', 'A', 'mission_creator inserts own private draft', () => ({ created_by: U('creatorA'), status: 'draft', is_public: false }));
  add({ id: 'POS-CRE-EDIT', set: 'db', actor: 'creatorA', org: 'A', desc: 'mission_creator edits content of own mission (title), protected fields untouched', after: 'CHANGED',
    run: async () => { const r = await doUpdate('creatorA', await seed('creatorA', { label: 'POS-CRE-EDIT' }), { title: `${marker} POS-CRE-EDIT edited` });
      if (r.observed === 'CHANGED') { const keep = ['id', 'tenant_id', 'created_by', 'created_at', 'status', 'is_public'].every((k) => r.before[k] === r.after[k]); if (!keep) r.observed = 'CHANGED_PROTECTED_FIELDS'; } return r; } });
  for (const who of ['adminA', 'platA']) {
    posIns(`POS-${who}-DRAFT`, who, 'A', `${who} inserts a draft as themselves`, () => ({ created_by: U(who), status: 'draft', is_public: false }));
    posIns(`POS-${who}-ACTIVE`, who, 'A', `${who} inserts an active mission as themselves`, () => ({ created_by: U(who), status: 'active', is_public: false }));
    add({ id: `POS-${who}-EDIT`, set: 'db', actor: who, org: 'A', desc: `${who} edits an own-org mission`, after: 'CHANGED', run: async () => doUpdate(who, await seed('creatorA', { label: `POS-${who}-EDIT` }), { title: `${marker} edited by ${who}` }) });
    add({ id: `POS-${who}-PUBLISH`, set: 'db', actor: who, org: 'A', desc: `${who} publishes an own-org mission (active + public)`, after: 'CHANGED', run: async () => doUpdate(who, await seed('creatorA', { label: `POS-${who}-PUBLISH` }), { status: 'active', is_public: true }) });
    add({ id: `POS-${who}-ARCHIVE`, set: 'db', actor: who, org: 'A', desc: `${who} archives an own-org mission`, after: 'CHANGED', run: async () => doUpdate(who, await seed('creatorA', { label: `POS-${who}-ARCHIVE` }), { status: 'archived' }) });
  }
  add({ id: 'POS-ADM-DELETE', set: 'db', actor: 'adminA', org: 'A', desc: 'tenant_admin deletes an own-org mission', after: 'DELETED', run: async () => doDelete('adminA', await seed('creatorA', { label: 'POS-ADM-DELETE' })) });
  add({ id: 'OBS-PLAT-DELETE', set: 'db', actor: 'platA', org: 'A', desc: 'platform_admin deletes an own-org mission (recorded as observed; DELETE policy unchanged, schema read says allowed)', after: 'DELETED', run: async () => doDelete('platA', await seed('creatorA', { label: 'OBS-PLAT-DELETE' })) });
  // unchanged behaviour
  add({ id: 'CTL-ANON-READ-PUBLIC', set: 'db', actor: 'anon', org: '-', desc: 'anon can read an admin-created public active mission (SELECT policy unchanged)', after: 'READABLE', run: async () => doRead('anon', await seed('adminA', { status: 'active', is_public: true, label: 'CTL-ANON-READ-PUBLIC' })) });
  add({ id: 'ISO-READ', set: 'db', actor: 'adminA', org: 'A', desc: 'org A admin cannot read an org B private mission', after: 'NOT_READABLE', run: async () => doRead('adminA', await seed('creatorB', { tenant: 'B', label: 'ISO-READ' })) });
  add({ id: 'ISO-UPDATE', set: 'db', actor: 'adminA', org: 'A', desc: 'org A admin cannot update an org B mission', after: 'UNCHANGED', run: async () => doUpdate('adminA', await seed('creatorB', { tenant: 'B', label: 'ISO-UPDATE' }), { title: `${marker} hijack` }) });
  add({ id: 'ISO-DELETE', set: 'db', actor: 'adminA', org: 'A', desc: 'org A admin cannot delete an org B mission', after: 'KEPT', run: async () => doDelete('adminA', await seed('creatorB', { tenant: 'B', label: 'ISO-DELETE' })) });
  refuseIns('CTL-ANON-INSERT', 'anon', '-', 'anon cannot insert', () => ({ created_by: null, status: 'draft', is_public: false }));
  add({ id: 'CTL-ANON-UPDATE', set: 'db', actor: 'anon', org: '-', desc: 'anon cannot update', after: 'UNCHANGED', run: async () => doUpdate('anon', await seed('adminA', { status: 'active', is_public: true, label: 'CTL-ANON-UPDATE' }), { title: `${marker} anon` }) });
  add({ id: 'CTL-ANON-DELETE', set: 'db', actor: 'anon', org: '-', desc: 'anon cannot delete', after: 'KEPT', run: async () => doDelete('anon', await seed('adminA', { status: 'active', is_public: true, label: 'CTL-ANON-DELETE' })) });
  refuseIns('CTL-PART-INSERT', 'partA', 'A', 'participant cannot insert', () => ({ created_by: U('partA'), status: 'draft', is_public: false }));
  refuseIns('CTL-ANALYST-INSERT', 'analystA', 'A', 'analyst cannot insert', () => ({ created_by: U('analystA'), status: 'draft', is_public: false }));
  refuseIns('CTL-NOORG-INSERT', 'noorg', '-', 'user with no organisation cannot insert (tenant A)', () => ({ created_by: U('noorg'), status: 'draft', is_public: false }));
  for (const who of ['creatorA', 'partA', 'analystA']) add({ id: `CTL-DELETE-${who}`, set: 'db', actor: who, org: 'A', desc: `${who} cannot delete`, after: 'KEPT', run: async () => doDelete(who, await seed('adminA', { label: `CTL-DELETE-${who}` })) });
  add({ id: 'CB-12', set: 'db', actor: 'creatorA', org: 'A', desc: "mission_creator cannot edit another user's mission", after: 'UNCHANGED', run: async () => doUpdate('creatorA', await seed('adminA', { label: 'CB-12' }), { title: `${marker} hijack` }) });
  // service-role path
  add({ id: 'SVC-UPDATE', set: 'db', actor: 'service_role', org: '-', desc: 'service role can still change created_by/status/is_public (the route path is not blocked)', after: 'CHANGED',
    run: async () => { const id = await seed('creatorA', { label: 'SVC-UPDATE' }); const b = await snap(id); const r = await svc(`missions?id=eq.${id}`, { method: 'PATCH', body: { created_by: U('adminA'), status: 'archived', is_public: true }, prefer: 'return=minimal' }); const a = await snap(id); return { observed: JSON.stringify(a) !== JSON.stringify(b) ? 'CHANGED' : 'UNCHANGED', http: r.status }; } });
  add({ id: 'SVC-INSERT', set: 'db', actor: 'service_role', org: '-', desc: 'service role can still insert (draft, created_by set explicitly)', after: 'ACCEPTED',
    run: async () => { const title = `${marker} SVC-INSERT`; const r = await svc('missions', { method: 'POST', body: { tenant_id: T('A'), created_by: U('adminA'), title, status: 'draft', is_public: false }, prefer: 'return=representation' }); if (r.ok && r.json?.[0]?.id) state.missionIds.push(r.json[0].id); return { observed: r.ok && r.json?.[0]?.id ? 'ACCEPTED' : 'REFUSED', http: r.status }; } });

  // ---- route cases (RT) ----
  const REF = new URL(cfg.url).hostname.split('.')[0];
  const cookieFor = (session) => {
    const val = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
    const name = `sb-${REF}-auth-token`;
    const chunks = val.match(/.{1,3180}/g) ?? [val];
    return chunks.length === 1 ? `${name}=${val}` : chunks.map((c, i) => `${name}.${i}=${c}`).join('; ');
  };
  let routeBase = null;
  async function rtPostJson(cookie, bodyObj) { return http('POST', `${routeBase}/api/admin/missions`, { headers: cookie ? { Cookie: cookie } : {}, body: bodyObj }); }
  async function rtPostRaw(cookie, rawText) { return http('POST', `${routeBase}/api/admin/missions`, { headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: rawText, raw: true }); }
  const rt = (id, desc, actor, org, expectStatus, expectRows, send, verify) => add({ id, set: 'route', actor, org, desc, after: `HTTP ${expectStatus}, rows ${expectRows}`, needsRoute: true,
    run: async () => {
      const title = `${marker} ${id}`;
      const before = await markerCount();
      const r = await send(title);
      const found = await svc(`missions?title=eq.${enc(title)}&select=id,tenant_id,created_by,status,is_public`);
      const rows = Array.isArray(found.json) ? found.json : [];
      rows.forEach((x) => state.missionIds.push(x.id));
      const after = await markerCount();
      let note = '';
      let observed = `HTTP ${r.status}, rows ${rows.length}`;
      if (verify && observed === `HTTP ${expectStatus}, rows ${expectRows}`) { const v = verify(rows[0], r); if (v) { observed += ` (${v})`; note = v; } }
      return { observed, http: r.status, rows_before: before, rows_after: after, note };
    } });
  const okBody = (title, extra = {}) => ({ title, ...extra });
  const ck = (k) => cookieFor(state.sessions[k]);
  rt('RT-01', 'signed out', '-', '-', 401, 0, (t) => rtPostJson(null, okBody(t)));
  rt('RT-02a', 'tampered access token', 'adminA', 'A', 401, 0, (t) => {
    const s = { ...state.sessions.adminA }; const p = s.access_token.split('.'); const last = p[2]; p[2] = last.slice(0, -2) + (last.endsWith('AA') ? 'BB' : 'AA'); s.access_token = p.join('.'); return rtPostJson(cookieFor(s), okBody(t)); });
  rt('RT-02b', 'expired session with failed refresh', 'adminA', 'A', 401, 0, (t) => rtPostJson(cookieFor({ ...state.sessions.adminA, expires_at: Math.floor(Date.now() / 1000) - 3600, refresh_token: 'invalid-refresh-token-0000000000' }), okBody(t)));
  rt('RT-02c', 'session signed out server-side (global logout, then old cookie)', 'logoutUser', 'A', 401, 0, async (t) => {
    const s = state.sessions.logoutUser; const cookie = cookieFor(s);
    const lo = await http('POST', `${cfg.url}/auth/v1/logout?scope=global`, { headers: { apikey: cfg.anon, Authorization: `Bearer ${s.access_token}` } });
    if (!(lo.status >= 200 && lo.status < 300)) throw new NotRun(`logout call failed (HTTP ${lo.status})`);
    return rtPostJson(cookie, okBody(t)); });
  rt('RT-03', 'participant whose body claims admin roles', 'partA', 'A', 403, 0, (t) => rtPostJson(ck('partA'), okBody(t, { role: 'platform_admin', roles: ['platform_admin', 'tenant_admin'], is_admin: true })));
  rt('RT-04', 'analyst', 'analystA', 'A', 403, 0, (t) => rtPostJson(ck('analystA'), okBody(t)));
  rt('RT-05', 'mission_creator', 'creatorA', 'A', 403, 0, (t) => rtPostJson(ck('creatorA'), okBody(t)));
  rt('RT-06', 'tenant_admin valid body', 'adminA', 'A', 200, 1, (t) => rtPostJson(ck('adminA'), okBody(t, { status: 'draft' })),
    (row) => (row.tenant_id !== T('A') ? 'wrong tenant' : row.created_by !== U('adminA') ? 'created_by is not the caller' : ''));
  rt('RT-06b', 'tenant_admin, status omitted: stored as private draft', 'adminA', 'A', 200, 1, (t) => rtPostJson(ck('adminA'), okBody(t)),
    (row) => (row.status !== 'draft' ? `status is ${row.status}` : row.is_public !== false ? 'is_public is not false' : row.created_by !== U('adminA') ? 'created_by is not the caller' : ''));
  rt('RT-06p', 'EXTRA: platform_admin valid body, own organisation', 'platA', 'A', 200, 1, (t) => rtPostJson(ck('platA'), okBody(t, { status: 'active' })),
    (row) => (row.tenant_id !== T('A') ? 'wrong tenant' : row.created_by !== U('platA') ? 'created_by is not the caller' : ''));
  rt('RT-07', 'admin A targets org B via tenant_id', 'adminA', 'A', 403, 0, (t) => rtPostJson(ck('adminA'), okBody(t, { tenant_id: T('B') })));
  rt('RT-07b', 'admin A targets org B via tenantId', 'adminA', 'A', 403, 0, (t) => rtPostJson(ck('adminA'), okBody(t, { tenantId: T('B') })));
  rt('RT-08', 'user with no organisation', 'noorg', '-', 403, 0, (t) => rtPostJson(ck('noorg'), okBody(t)));
  rt('RT-09a', 'status archived', 'adminA', 'A', 400, 0, (t) => rtPostJson(ck('adminA'), okBody(t, { status: 'archived' })));
  rt('RT-09b', 'status published', 'adminA', 'A', 400, 0, (t) => rtPostJson(ck('adminA'), okBody(t, { status: 'published' })));
  rt('RT-10a', 'body is not JSON', 'adminA', 'A', 400, 0, () => rtPostRaw(ck('adminA'), 'this is not json'));
  rt('RT-10b', 'body is a JSON array', 'adminA', 'A', 400, 0, () => rtPostRaw(ck('adminA'), '[{"title":"x"}]'));
  rt('RT-10c', 'no title', 'adminA', 'A', 400, 0, () => rtPostJson(ck('adminA'), { story_context: 'no title here' }));
  const forgedId = crypto.randomUUID();
  rt('RT-11', 'body forges created_by, id, user_id, sub, role', 'adminA', 'A', 200, 1, (t) => rtPostJson(ck('adminA'), okBody(t, { created_by: U('creatorB'), id: forgedId, user_id: U('creatorB'), sub: U('creatorB'), role: 'platform_admin' })),
    (row) => (row.tenant_id !== T('A') ? 'wrong tenant' : row.created_by !== U('adminA') ? 'created_by is not the caller' : row.id === forgedId ? 'forged id was stored' : ''));
  rt('RT-12', 'profile lookup fails (dev server started with an invalid service key)', 'adminA', 'A', 500, 0, (t) => rtPostJson(ck('adminA'), okBody(t)));

  // ---- dev server ----
  let child = null; const tail = [];
  async function startDev(port, serviceKeyOverride) {
    const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: cfg.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: cfg.anon, SUPABASE_SERVICE_ROLE_KEY: serviceKeyOverride ?? cfg.service, NEXT_TELEMETRY_DISABLED: '1' };
    delete env.SUPABASE_URL; delete env.SUPABASE_ANON_KEY;
    child = spawn('npx', ['next', 'dev', '-p', String(port)], { cwd: args.repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const keep = (b) => { tail.push(...b.toString().split('\n')); while (tail.length > 40) tail.shift(); };
    child.stdout.on('data', keep); child.stderr.on('data', keep);
    let exited = false; child.on('exit', () => { exited = true; });
    routeBase = `http://127.0.0.1:${port}`;
    const t0 = Date.now();
    while (Date.now() - t0 < 180000) {
      if (exited) throw new NotRun(`dev server exited early: ${redact(tail.slice(-5).join(' | '))}`);
      try { const r = await fetch(`${routeBase}/api/admin/missions`, { signal: AbortSignal.timeout(20000) }); void r.status; return; } catch { await new Promise((res) => setTimeout(res, 1500)); }
    }
    throw new NotRun('dev server did not become ready in 180 s');
  }
  async function stopDev() {
    if (!child) return;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
    await new Promise((res) => setTimeout(res, 4000));
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
    child = null;
  }

  // ---- run ----
  const record = (d, expected, o) => {
    const observed = o.observed;
    results.set(d.id, { id: d.id, desc: d.desc, actor: d.actor, org: d.org, set: d.set, expected, observed, status: observed === expected ? 'PASS' : 'FAIL', project_ref: STAGING_REF, rows_before: o.rows_before ?? null, rows_after: o.rows_after ?? null, http: o.http ?? null, note: o.note ?? '' });
  };
  const notRun = (d, why) => results.set(d.id, { id: d.id, desc: d.desc, actor: d.actor, org: d.org, set: d.set, expected: mode === 'after-fix' ? d.after ?? null : d.before ?? null, observed: null, status: 'NOT RUN', project_ref: STAGING_REF, rows_before: null, rows_after: null, http: null, note: why });
  const inMode = (d) => (d.set === 'cb' ? true : mode === 'after-fix');

  const startedAt = new Date().toISOString();
  let startCounts = null; let endCounts = null; let fatal = null; let cleanup = { ok: false };
  let routeNote = '';
  try {
    startCounts = await globalCounts();
    const wantRoute = mode === 'after-fix' && !args.skipRoute;
    await setupFixtures(wantRoute);
    for (const d of defs.filter((x) => x.set !== 'route')) {
      if (!inMode(d)) { notRun(d, `not in scope for mode ${mode}`); continue; }
      try { record(d, mode === 'after-fix' ? d.after : d.before, await d.run()); } catch (e) { if (e instanceof NotRun) notRun(d, redact(e.message)); else record(d, mode === 'after-fix' ? d.after : d.before, { observed: `ERROR: ${redact(e.message)}` }); }
    }
    const routeDefs = defs.filter((x) => x.set === 'route');
    if (!wantRoute) routeNote = mode === 'after-fix' ? '--skip-route given' : `route cases run only in after-fix mode`;
    else if (!repo.routeReady) routeNote = `repo checkout not route-ready: ${repo.reasons.join('; ')}`;
    if (wantRoute && repo.routeReady) {
      try {
        await startDev(args.port);
        const so = await http('GET', `${routeBase}/api/admin/missions`);
        const si = await http('GET', `${routeBase}/api/admin/missions`, { headers: { Cookie: ck('adminA') } });
        if (so.status !== 401 || si.status !== 200) routeNote = `session cookie precheck failed (signed-out GET ${so.status}, signed-in GET ${si.status}); the SSR cookie format assumption may be wrong for this @supabase/ssr version`;
        else {
          for (const d of routeDefs.filter((x) => x.id !== 'RT-12')) {
            try { record(d, d.after, await d.run()); } catch (e) { if (e instanceof NotRun) notRun(d, redact(e.message)); else record(d, d.after, { observed: `ERROR: ${redact(e.message)}` }); }
          }
          await stopDev();
          await startDev(args.port, `invalid-${crypto.randomBytes(12).toString('hex')}`);
          const d12 = routeDefs.find((x) => x.id === 'RT-12');
          try { record(d12, d12.after, await d12.run()); } catch (e) { if (e instanceof NotRun) notRun(d12, redact(e.message)); else record(d12, d12.after, { observed: `ERROR: ${redact(e.message)}` }); }
        }
      } catch (e) { routeNote = redact(e.message); }
    }
    for (const d of routeDefs) if (!results.has(d.id)) notRun(d, routeNote || 'route phase did not complete');
  } catch (e) {
    fatal = redact(e.message);
  } finally {
    await stopDev().catch(() => {});
    const del = [];
    try {
      const ids = [...new Set(state.missionIds)];
      if (ids.length) { const r = await svc(`missions?id=in.(${ids.join(',')})`, { method: 'DELETE', prefer: 'return=minimal' }); del.push(`missions(tracked) HTTP ${r.status}`); }
      const r2 = await svc(`missions?title=like.${marker}*`, { method: 'DELETE', prefer: 'return=minimal' }); del.push(`missions(marker) HTTP ${r2.status}`);
      for (const id of state.userIds) { const r = await http('DELETE', `${cfg.url}/auth/v1/admin/users/${id}`, { headers: svcHeaders() }); del.push(`user HTTP ${r.status}`); }
      if (state.userIds.length) { const r = await svc(`user_profiles?id=in.(${state.userIds.join(',')})`, { method: 'DELETE', prefer: 'return=minimal' }); del.push(`profiles(leftover) HTTP ${r.status}`); }
      if (state.tenantIds.length) { const r = await svc(`tenants?id=in.(${state.tenantIds.join(',')})`, { method: 'DELETE', prefer: 'return=minimal' }); del.push(`tenants HTTP ${r.status}`); }
      endCounts = await globalCounts();
      cleanup = { ok: true, steps: del };
    } catch (e) { cleanup = { ok: false, error: redact(e.message), steps: del }; }
  }

  for (const d of defs) if (!results.has(d.id)) notRun(d, fatal ? `run aborted: ${fatal}` : 'not executed');
  const list = defs.map((d) => results.get(d.id));
  const summary = { PASS: 0, FAIL: 0, 'NOT RUN': 0 }; list.forEach((r) => { summary[r.status]++; });
  const countsEqual = !!(startCounts && endCounts && JSON.stringify(startCounts) === JSON.stringify(endCounts));
  const evidence = { harness_version: HARNESS_VERSION, mode, run_marker: marker, project_ref: STAGING_REF, started_at: startedAt, finished_at: new Date().toISOString(),
    repo: { head: repo.head, branch: repo.branch, verified_fix_sha: VERIFIED_FIX_SHA, route_ready: repo.routeReady, route_blockers: repo.reasons }, settings: { url: cfg.url, key_checks: cfg.keyNotes },
    fatal, route_note: routeNote || null, summary, cleanup: { ...cleanup, counts_start: startCounts, counts_end: endCounts, counts_equal: countsEqual }, cases: list };
  fs.mkdirSync(args.evidenceDir, { recursive: true });
  const file = path.join(args.evidenceDir, `missions-guard-${mode}-${marker}.json`);
  fs.writeFileSync(file, redact(JSON.stringify(evidence, null, 2)), { mode: 0o600 });
  for (const r of list) log(`${r.status.padEnd(7)} ${r.id.padEnd(24)} expected=${r.expected} observed=${r.observed}${r.note ? ` | ${r.note}` : ''}`);
  log(`SUMMARY ${JSON.stringify(summary)} | cleanup ok=${cleanup.ok} counts_equal=${countsEqual} | fatal=${fatal ?? 'none'}`);
  log(`EVIDENCE ${file}`);
  process.exit(summary.FAIL === 0 && cleanup.ok && countsEqual && !fatal ? 0 : 1);
}

// ------------------------------------------------------------------ entry ----
async function entry() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`REFUSED: ${e.message}`); process.exit(2); }
  if (args.mode === 'dry-run') {
    try {
      const cfg = loadConfig(args);
      const repo = repoChecks(args.repoRoot);
      log('DRY RUN: settings and target guards OK');
      log(`  target: ${STAGING_URL} (project ref ${STAGING_REF}); production ref absent from environment and .env* files`);
      for (const n of cfg.keyNotes) log(`  ${n}`);
      log(`  repo: branch=${repo.branch} head=${repo.head}`);
      log(`  route cases ready: ${repo.routeReady ? 'yes' : `no (${repo.reasons.join('; ')})`}`);
      log(`  Node ${process.version} (fetch available: ${typeof fetch === 'function'})`);
      log('  no network calls made, no files written, no server started');
      process.exit(0);
    } catch (e) { console.error(`REFUSED: ${redact(e.message)}`); process.exit(2); }
  }
  try { await main(); } catch (e) {
    if (e instanceof Refusal) { console.error(`REFUSED: ${redact(e.message)}`); process.exit(2); }
    console.error(`FATAL: ${redact(e.stack ?? e.message)}`); process.exit(1);
  }
}
entry();
