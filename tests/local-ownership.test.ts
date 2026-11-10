import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const failSet = new Set<string>(); // setItem throws QuotaExceededError for these keys
const dropSet = new Set<string>(); // setItem silently does nothing (read-back mismatch)

function makeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem(k: string): string | null {
      return map.get(k) ?? null;
    },
    setItem(k: string, v: string): void {
      if (failSet.has(k)) {
        const e = new Error('The quota has been exceeded.');
        e.name = 'QuotaExceededError';
        throw e;
      }
      if (dropSet.has(k)) return;
      map.set(k, String(v));
    },
    removeItem(k: string): void {
      map.delete(k);
    },
    clear(): void {
      map.clear();
    },
    key(i: number): string | null {
      return [...map.keys()][i] ?? null;
    },
    get length(): number {
      return map.size;
    },
  };
}

const local = makeStorage();
const session = makeStorage();

function define(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}
define('localStorage', local);
define('sessionStorage', session);
define('window', globalThis);

interface Mod {
  hasActiveLocalData(): boolean;
  bindLocalDataToUser(id: string): 'unchanged' | 'switched' | 'failed';
  releaseLocalDataOnSignOut(id: string | null): 'released' | 'nothing' | 'failed';
  BIND_RELOAD_FLAG: string;
}

const href = pathToFileURL(
  path.resolve(import.meta.dirname, '..', 'src', 'lib', 'local-ownership.ts'),
).href;
const mod = (await import(href)) as Mod;

const S = 'xhunt_v1';
const P = 'xhunt_impact_v1';
const O = 'xhunt_owner_v1';
const THEME = 'xhunt-theme';
const A_STATE = '{"user":{"onboardingUserId":"A"},  "xp": 10}\n';
const A_PROFILE = '  {"impact":"a"}';

function seed(entries: Record<string, string>) {
  for (const [k, v] of Object.entries(entries)) local.map.set(k, v);
}
function snapshot(): string {
  return JSON.stringify(
    [...local.map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}
function orphanKeys(): string[] {
  return [...local.map.keys()].filter((k) => k.startsWith('xhunt_orphan_v1:'));
}

beforeEach(() => {
  local.clear();
  session.clear();
  failSet.clear();
  dropSet.clear();
});

describe('hasActiveLocalData', () => {
  it('looks only at the two active keys', () => {
    assert.equal(mod.hasActiveLocalData(), false);
    seed({ [O]: 'A', [THEME]: 'dark', [`${S}:u:A`]: 'x', 'xhunt_orphan_v1:1': '{}' });
    assert.equal(mod.hasActiveLocalData(), false);
    seed({ [P]: '{}' });
    assert.equal(mod.hasActiveLocalData(), true);
  });
});

describe('bindLocalDataToUser', () => {
  it('empty userId fails and touches nothing', () => {
    seed({ [S]: A_STATE, [O]: 'A' });
    const before = snapshot();
    assert.equal(mod.bindLocalDataToUser(''), 'failed');
    assert.equal(snapshot(), before);
  });

  it('repeat sign-in by the owner is unchanged and keeps data', () => {
    assert.equal(mod.bindLocalDataToUser('A'), 'unchanged'); // fresh device
    assert.equal(local.getItem(O), 'A');
    seed({ [S]: A_STATE, [P]: A_PROFILE });
    const before = snapshot();
    assert.equal(mod.bindLocalDataToUser('A'), 'unchanged');
    assert.equal(mod.bindLocalDataToUser('A'), 'unchanged');
    assert.equal(snapshot(), before);
  });

  it('A then C: C sees nothing of A; A is stashed', () => {
    seed({ [S]: A_STATE, [P]: A_PROFILE, [O]: 'A' });
    assert.equal(mod.bindLocalDataToUser('C'), 'switched');
    assert.equal(local.getItem(S), null);
    assert.equal(local.getItem(P), null);
    assert.equal(local.getItem(O), 'C');
    assert.equal(local.getItem(`${S}:u:A`), A_STATE);
    assert.equal(local.getItem(`${P}:u:A`), A_PROFILE);
  });

  it("C signs out, A signs in: A's exact strings come back", () => {
    seed({ [S]: A_STATE, [P]: A_PROFILE, [O]: 'A' });
    mod.bindLocalDataToUser('C');
    local.setItem(S, 'C-state');
    local.setItem(P, 'C-profile');
    assert.equal(mod.releaseLocalDataOnSignOut('C'), 'released');
    assert.equal(mod.hasActiveLocalData(), false);
    assert.equal(local.getItem(O), null);
    assert.equal(mod.bindLocalDataToUser('A'), 'switched');
    assert.equal(local.getItem(S), A_STATE);
    assert.equal(local.getItem(P), A_PROFILE);
    assert.equal(local.getItem(`${S}:u:A`), null);
    assert.equal(local.getItem(`${P}:u:A`), null);
    assert.equal(local.getItem(`${S}:u:C`), 'C-state'); // C's stash survives
  });

  it('repeated switching never leaks another account into the active keys', () => {
    const users = ['A', 'C', 'B', 'A', 'C', 'B', 'A'];
    users.forEach((u, i) => {
      assert.notEqual(mod.bindLocalDataToUser(u), 'failed');
      for (const k of [S, P]) {
        const v = local.getItem(k);
        assert.ok(v === null || v.startsWith(`${u}:`), `${k} leaked into ${u}: ${v}`);
      }
      assert.equal(local.getItem(O), u);
      local.setItem(S, `${u}:state:${i}`);
      local.setItem(P, `${u}:profile:${i}`);
    });
    assert.equal(local.getItem(`${S}:u:C`), 'C:state:4');
    assert.equal(local.getItem(`${S}:u:B`), 'B:state:5');
    assert.equal(local.getItem(S), 'A:state:6');
    assert.ok([...local.map.keys()].every((k) => !k.includes(':prev')));
  });

  it(':prev holds the replaced stash and an older :prev is archived, not overwritten', () => {
    seed({
      [S]: 'Y',
      [O]: 'A',
      [`${S}:u:A`]: 'X',
      [`${S}:u:A:prev`]: 'P',
    });
    assert.equal(mod.bindLocalDataToUser('C'), 'switched');
    assert.equal(local.getItem(`${S}:u:A`), 'Y');
    assert.equal(local.getItem(`${S}:u:A:prev`), 'X');
    assert.ok([...local.map.values()].includes('P'), 'old :prev must survive somewhere');
  });

  it('an existing stash without :prev moves to :prev', () => {
    seed({ [S]: 'Y', [O]: 'A', [`${S}:u:A`]: 'X' });
    mod.bindLocalDataToUser('C');
    assert.equal(local.getItem(`${S}:u:A`), 'Y');
    assert.equal(local.getItem(`${S}:u:A:prev`), 'X');
  });

  it('legacy data claimed by the same account is kept and unchanged', () => {
    seed({ [S]: A_STATE, [P]: A_PROFILE });
    assert.equal(mod.bindLocalDataToUser('A'), 'unchanged');
    assert.equal(local.getItem(O), 'A');
    assert.equal(local.getItem(S), A_STATE);
    assert.equal(local.getItem(P), A_PROFILE);
  });

  it('legacy data claimed by another id is stashed under that id; own stash restored', () => {
    const b = '{"user":{"onboardingUserId":"B"}}';
    seed({ [S]: b, [P]: 'bp', [`${S}:u:A`]: 'a-old-state' });
    assert.equal(mod.bindLocalDataToUser('A'), 'switched');
    assert.equal(local.getItem(`${S}:u:B`), b);
    assert.equal(local.getItem(`${P}:u:B`), 'bp');
    assert.equal(local.getItem(S), 'a-old-state');
    assert.equal(local.getItem(P), null);
    assert.equal(local.getItem(O), 'A');
  });

  for (const [label, state] of [
    ['missing id', '{"user":{"name":"n"}}'],
    ['no user object', '{"xp":1}'],
    ['non-string id', '{"user":{"onboardingUserId":42}}'],
    ['bad JSON', '{not json'],
  ] as const) {
    it(`orphans legacy data with ${label}; never shown to anyone`, () => {
      seed({ [S]: state, [P]: '  raw-profile' });
      assert.equal(mod.bindLocalDataToUser('A'), 'switched');
      assert.equal(local.getItem(S), null);
      assert.equal(local.getItem(P), null);
      const keys = orphanKeys();
      assert.equal(keys.length, 1);
      assert.match(keys[0], /^xhunt_orphan_v1:\d+$/);
      assert.deepEqual(JSON.parse(local.getItem(keys[0]) as string), {
        state,
        profile: '  raw-profile',
      });
      assert.equal(mod.bindLocalDataToUser('B'), 'switched');
      assert.equal(local.getItem(S), null);
      assert.equal(orphanKeys().length, 1);
    });
  }

  it('orphans legacy data when only the profile key exists', () => {
    seed({ [P]: 'only-profile' });
    assert.equal(mod.bindLocalDataToUser('A'), 'switched');
    assert.equal(local.getItem(P), null);
    const keys = orphanKeys();
    assert.deepEqual(JSON.parse(local.getItem(keys[0]) as string), {
      state: null,
      profile: 'only-profile',
    });
  });

  it('no owner and no data: restores the stash if there is one, else unchanged', () => {
    seed({ [`${S}:u:A`]: 'saved' });
    assert.equal(mod.bindLocalDataToUser('A'), 'switched');
    assert.equal(local.getItem(S), 'saved');
    assert.equal(local.getItem(`${S}:u:A`), null);
    local.clear();
    assert.equal(mod.bindLocalDataToUser('A'), 'unchanged');
    assert.equal(local.getItem(O), 'A');
  });

  it('quota failure on the second stash write leaves everything unchanged', () => {
    seed({ [S]: A_STATE, [P]: A_PROFILE, [O]: 'A', [THEME]: 'dark' });
    const before = snapshot();
    failSet.add(`${P}:u:A`);
    assert.equal(mod.bindLocalDataToUser('C'), 'failed');
    assert.equal(snapshot(), before);
    assert.equal(local.getItem(`${S}:u:A`), null); // no partial stash
  });

  it('quota failure on the owner write rolls back stashes too', () => {
    seed({ [S]: A_STATE, [P]: A_PROFILE, [O]: 'A' });
    const before = snapshot();
    failSet.add(O);
    assert.equal(mod.bindLocalDataToUser('C'), 'failed');
    assert.equal(snapshot(), before);
  });

  it('a write that does not read back is a failure and is rolled back', () => {
    seed({ [S]: A_STATE, [O]: 'A' });
    const before = snapshot();
    dropSet.add(`${S}:u:A`);
    assert.equal(mod.bindLocalDataToUser('C'), 'failed');
    assert.equal(snapshot(), before);
  });

  it('failed orphaning leaves legacy data and owner untouched', () => {
    seed({ [S]: '{bad', [P]: 'p' });
    const before = snapshot();
    failSet.add(O);
    assert.equal(mod.bindLocalDataToUser('A'), 'failed');
    assert.equal(snapshot(), before);
  });
});

describe('releaseLocalDataOnSignOut', () => {
  it('prefers the recorded owner over the passed id', () => {
    seed({ [S]: A_STATE, [P]: A_PROFILE, [O]: 'A' });
    assert.equal(mod.releaseLocalDataOnSignOut('C'), 'released');
    assert.equal(local.getItem(`${S}:u:A`), A_STATE);
    assert.equal(local.getItem(`${P}:u:A`), A_PROFILE);
    assert.equal(local.getItem(`${S}:u:C`), null);
    assert.equal(local.getItem(S), null);
    assert.equal(local.getItem(P), null);
    assert.equal(local.getItem(O), null);
  });

  it('falls back to the passed id when no owner is recorded', () => {
    seed({ [S]: 's', [P]: 'p' });
    assert.equal(mod.releaseLocalDataOnSignOut('C'), 'released');
    assert.equal(local.getItem(`${S}:u:C`), 's');
    assert.equal(local.getItem(`${P}:u:C`), 'p');
    assert.equal(mod.hasActiveLocalData(), false);
  });

  it('does nothing when there is neither owner nor id', () => {
    seed({ [S]: 's' });
    const before = snapshot();
    assert.equal(mod.releaseLocalDataOnSignOut(null), 'nothing');
    assert.equal(snapshot(), before);
  });

  it('on failure removes nothing', () => {
    seed({ [S]: A_STATE, [P]: A_PROFILE, [O]: 'A' });
    const before = snapshot();
    failSet.add(`${P}:u:A`);
    assert.equal(mod.releaseLocalDataOnSignOut('A'), 'failed');
    assert.equal(snapshot(), before);
  });

  it('re-releasing identical data does not create :prev', () => {
    seed({ [S]: 's', [O]: 'A', [`${S}:u:A`]: 's' });
    assert.equal(mod.releaseLocalDataOnSignOut('A'), 'released');
    assert.equal(local.getItem(`${S}:u:A`), 's');
    assert.equal(local.getItem(`${S}:u:A:prev`), null);
  });
});

describe('invariants', () => {
  it('stashes and the theme key survive every operation; sessionStorage is never written', () => {
    seed({ [THEME]: 'dark', [S]: A_STATE, [P]: A_PROFILE, [O]: 'A' });
    mod.bindLocalDataToUser('C');
    mod.releaseLocalDataOnSignOut('C');
    mod.bindLocalDataToUser('B');
    mod.releaseLocalDataOnSignOut(null);
    mod.bindLocalDataToUser('A');
    assert.equal(local.getItem(THEME), 'dark');
    mod.releaseLocalDataOnSignOut('A');
    assert.equal(local.getItem(THEME), 'dark');
    assert.equal(local.getItem(`${S}:u:A`), A_STATE);
    assert.equal(local.getItem(`${P}:u:A`), A_PROFILE);
    assert.equal(session.map.size, 0);
    assert.equal(mod.BIND_RELOAD_FLAG, 'xhunt_bind_reload');
  });
});
