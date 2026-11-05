// UNIT TESTS WITH MOCKS for POST /api/admin/missions.
//
// These exercise the REAL route handler source with `next/server`,
// `@/lib/auth/server` and `@/lib/supabase/admin` replaced by in-memory stubs.
// They prove the handler's authorisation/validation branches and that no insert
// is attempted on denied paths. They do NOT prove real Supabase session
// validation, RLS/database permissions, persisted ownership, or production
// runtime security.
//
// Run (no package.json change needed):
//   node --test --experimental-strip-types tests/admin-missions-post.test.ts
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const dataUrl = (src: string) => 'data:text/javascript,' + encodeURIComponent(src);

const stubs: Record<string, string> = {
  'next/server': dataUrl(`
    export class NextRequest {}
    export const NextResponse = { json: (body, init) => Response.json(body, init) };
  `),
  '@/lib/auth/server': dataUrl(`
    export async function requireSession() {
      const t = globalThis.__t;
      if (t.session === null) throw new Error('Unauthorized');
      return t.session;
    }
  `),
  '@/lib/supabase/admin': dataUrl(`
    export function createAdminClient() {
      const t = globalThis.__t;
      return {
        from(table) {
          const q = { table, filters: [] };
          const b = {
            select() { return b; },
            eq(col, val) { q.filters.push([col, val]); return b; },
            async single() {
              t.lookups.push({ table: q.table, filters: q.filters });
              if (t.profileThrows) throw new Error('boom');
              return t.profile;
            },
            insert(row) { t.inserts.push({ table: q.table, row }); return b; },
          };
          // after insert(): select().single() resolves the insert result
          const origSingle = b.single;
          b.single = async () => (t.inserts.length && q.table === 'missions' && t.inserting
            ? t.insertResult : origSingle());
          const origInsert = b.insert;
          b.insert = (row) => { t.inserting = true; return origInsert(row); };
          return b;
        },
      };
    }
  `),
};

const hooks = `
  const stubs = ${JSON.stringify(stubs)};
  export async function resolve(specifier, context, next) {
    if (stubs[specifier]) return { url: stubs[specifier], shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const { existsSync } = await import('node:fs');
      const { pathToFileURL } = await import('node:url');
      const base = ${JSON.stringify(path.join(root, 'src'))} + '/' + specifier.slice(2);
      for (const f of [base + '.ts', base + '/index.ts']) {
        if (existsSync(f)) return { url: pathToFileURL(f).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  }
`;
register(dataUrl(hooks), import.meta.url);

type Profile = { data: { tenant_id: string | null; role: string | null } | null; error: { code?: string; message?: string } | null };
interface T {
  session: { sub: string; email: string; role: string; surface: string } | null;
  profile: Profile;
  profileThrows: boolean;
  insertResult: { data: unknown; error: { message: string } | null };
  inserts: { table: string; row: Record<string, unknown> }[];
  lookups: { table: string; filters: unknown[] }[];
  inserting: boolean;
}
const g = globalThis as unknown as { __t: T };

const TENANT_A = '00000000-0000-0000-0000-00000000000a';
const TENANT_B = '00000000-0000-0000-0000-00000000000b';
const USER = '11111111-1111-1111-1111-111111111111';

function setup(role: string | null, tenant: string | null = TENANT_A) {
  g.__t = {
    session: { sub: USER, email: 'x@example.test', role: 'participant', surface: 'home' },
    profile: { data: { tenant_id: tenant, role }, error: null },
    profileThrows: false,
    insertResult: { data: { id: 'm1', title: 'T' }, error: null },
    inserts: [],
    lookups: [],
    inserting: false,
  };
}

function req(body: unknown, raw = false) {
  return {
    json: async () => {
      if (raw) throw new SyntaxError('bad json');
      return body;
    },
  } as never;
}

const valid = (extra: Record<string, unknown> = {}) => ({
  title: 'Mission',
  difficulty: 'easy',
  steps: [{ title: 's1' }],
  tags: ['a'],
  status: 'draft',
  ...extra,
});

let POST: (r: never) => Promise<Response>;
let GET: (r: never) => Promise<Response>;
await (async () => {
  g.__t = undefined as never;
  const mod = await import(pathToFileURL(path.join(root, 'src/app/api/admin/missions/route.ts')).href);
  POST = mod.POST;
  GET = mod.GET;
})();

const noInsert = () => assert.equal(g.__t.inserts.length, 0, 'no insert may occur on a denied request');

describe('POST /api/admin/missions (mocked unit tests)', () => {
  beforeEach(() => setup('tenant_admin'));

  test('signed-out caller → 401, no insert, no lookup', async () => {
    g.__t.session = null;
    const res = await POST(req(valid()));
    assert.equal(res.status, 401);
    noInsert();
    assert.equal(g.__t.lookups.length, 0);
  });

  test('invalid/expired session (requireSession rejects) → 401, no insert', async () => {
    // The real helper returns null/throws for invalid or expired sessions;
    // here that is simulated by the stub rejecting. Real validation: NOT tested.
    g.__t.session = null;
    assert.equal((await POST(req(valid()))).status, 401);
    noInsert();
  });

  for (const role of ['participant', 'analyst', 'mission_creator']) {
    test(`${role} with valid org → 403, no insert`, async () => {
      setup(role);
      const res = await POST(req(valid()));
      assert.equal(res.status, 403);
      noInsert();
    });
  }

  for (const claim of ['tenant_admin', 'platform_admin']) {
    test(`participant claiming ${claim} in body → 403, no insert`, async () => {
      setup('participant');
      const res = await POST(req(valid({ role: claim, user_role: claim, app_role: claim, is_admin: true })));
      assert.equal(res.status, 403);
      noInsert();
    });
  }

  test('role null / unknown → 403', async () => {
    setup(null);
    assert.equal((await POST(req(valid()))).status, 403);
    setup('superuser');
    assert.equal((await POST(req(valid()))).status, 403);
    noInsert();
  });

  test('missing organisation membership (tenant null) → 403', async () => {
    setup('tenant_admin', null);
    assert.equal((await POST(req(valid()))).status, 403);
    noInsert();
  });

  test('no profile row (PGRST116) → 403, no insert', async () => {
    g.__t.profile = { data: null, error: { code: 'PGRST116' } };
    assert.equal((await POST(req(valid()))).status, 403);
    noInsert();
  });

  test('trusted-profile lookup error → 500, no insert (fail closed)', async () => {
    g.__t.profile = { data: null, error: { code: '08006', message: 'connection failure' } };
    const res = await POST(req(valid()));
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(await res.json()), /connection failure/);
    noInsert();
  });

  test('trusted-profile lookup throws → 500, no insert', async () => {
    g.__t.profileThrows = true;
    assert.equal((await POST(req(valid()))).status, 500);
    noInsert();
  });

  test('profile lookup uses the verified session id, not the body', async () => {
    await POST(req(valid({ user_id: 'attacker', id: 'attacker' })));
    assert.deepEqual(g.__t.lookups[0].filters, [['id', USER]]);
  });

  test('tenant_admin → success; tenant/creator come from trusted sources; response shape kept', async () => {
    const res = await POST(req(valid()));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { mission: { id: 'm1', title: 'T' } });
    assert.equal(g.__t.inserts.length, 1);
    const { table, row } = g.__t.inserts[0];
    assert.equal(table, 'missions');
    assert.equal(row.tenant_id, TENANT_A);
    assert.equal(row.created_by, USER);
  });

  test('platform_admin acts only within own tenant', async () => {
    setup('platform_admin');
    assert.equal((await POST(req(valid()))).status, 200);
    assert.equal(g.__t.inserts[0].row.tenant_id, TENANT_A);
    setup('platform_admin');
    assert.equal((await POST(req(valid({ tenant_id: TENANT_B })))).status, 403);
    noInsert();
  });

  test('cross-organisation target → 403, no insert in either org', async () => {
    for (const key of ['tenant_id', 'tenantId']) {
      setup('tenant_admin');
      const res = await POST(req(valid({ [key]: TENANT_B })));
      assert.equal(res.status, 403);
      noInsert();
    }
  });

  test('claiming own tenant id is accepted and cannot change the target', async () => {
    assert.equal((await POST(req(valid({ tenant_id: TENANT_A })))).status, 200);
    assert.equal(g.__t.inserts[0].row.tenant_id, TENANT_A);
  });

  test('forged ownership/privileged fields never reach the insert', async () => {
    const res = await POST(req(valid({
      created_by: 'attacker', owner_id: 'attacker', user_id: 'attacker', id: 'attacker',
      created_at: '2000-01-01', updated_at: '2000-01-01', approved: true, role: 'platform_admin',
    })));
    assert.equal(res.status, 200);
    const row = g.__t.inserts[0].row;
    assert.equal(row.created_by, USER);
    assert.equal(row.tenant_id, TENANT_A);
    assert.deepEqual(
      Object.keys(row).sort(),
      ['created_by', 'difficulty', 'estimated_time', 'is_public', 'reward', 'status', 'steps', 'story_context', 'tags', 'tenant_id', 'title'].sort(),
    );
  });

  for (const status of ['published', 'paused', 'archived', 'ACTIVE', '', 1, null, {}]) {
    test(`invalid creation status ${JSON.stringify(status)} → 400, no insert`, async () => {
      const res = await POST(req(valid({ status })));
      assert.equal(res.status, 400);
      noInsert();
    });
  }

  test('status draft/active accepted; omitted defaults to draft', async () => {
    for (const status of ['draft', 'active']) {
      setup('tenant_admin');
      assert.equal((await POST(req(valid({ status })))).status, 200);
      assert.equal(g.__t.inserts[0].row.status, status);
    }
    setup('tenant_admin');
    const { status: _omit, ...noStatus } = valid();
    void _omit;
    assert.equal((await POST(req(noStatus))).status, 200);
    assert.equal(g.__t.inserts[0].row.status, 'draft');
  });

  test('minimal body uses defaults (optional fields omitted from insert)', async () => {
    assert.equal((await POST(req({ title: 'Only title' }))).status, 200);
    const row = g.__t.inserts[0].row;
    assert.equal('difficulty' in row, false);
    assert.equal('steps' in row, false);
    assert.equal('tags' in row, false);
    assert.equal(row.is_public, false);
    assert.equal(row.reward, '');
  });

  const malformed: [string, unknown][] = [
    ['missing title', { difficulty: 'easy' }],
    ['blank title', valid({ title: '   ' })],
    ['non-string title', valid({ title: 5 })],
    ['array body', []],
    ['null body', null],
    ['string body', 'x'],
    ['bad difficulty', valid({ difficulty: 'extreme' })],
    ['steps not array', valid({ steps: 'x' })],
    ['steps with non-object', valid({ steps: [1] })],
    ['tags not array', valid({ tags: 'a' })],
    ['tags with non-string', valid({ tags: [1] })],
    ['is_public not boolean', valid({ is_public: 'true' })],
    ['story_context not string', valid({ story_context: 1 })],
    ['reward not string', valid({ reward: 1 })],
    ['estimated_time not string', valid({ estimated_time: 1 })],
  ];
  for (const [name, body] of malformed) {
    test(`malformed body: ${name} → 400, no insert`, async () => {
      assert.equal((await POST(req(body))).status, 400);
      noInsert();
    });
  }

  test('invalid JSON → 400, no insert', async () => {
    assert.equal((await POST(req(null, true))).status, 400);
    noInsert();
  });

  test('database insert failure → generic 500 without DB internals', async () => {
    g.__t.insertResult = { data: null, error: { message: 'duplicate key value violates constraint "secret_idx"' } };
    const res = await POST(req(valid()));
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(await res.json()), /secret_idx|duplicate/);
  });

  test('GET handler still exported and untouched in shape (smoke)', async () => {
    assert.equal(typeof GET, 'function');
  });
});
