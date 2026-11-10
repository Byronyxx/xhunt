// Ties the browser's saved progress (localStorage) to the signed-in account.
// Client-only. Moves RAW strings; only xhunt_v1 is ever JSON.parsed, and only to
// read user.onboardingUserId. The theme key (xhunt-theme) is never touched.

export const STATE_KEY = 'xhunt_v1';
export const PROFILE_KEY = 'xhunt_impact_v1';
export const OWNER_KEY = 'xhunt_owner_v1';
export const ORPHAN_PREFIX = 'xhunt_orphan_v1:';
export const BIND_RELOAD_FLAG = 'xhunt_bind_reload'; // sessionStorage

const ACTIVE_KEYS = [STATE_KEY, PROFILE_KEY] as const;

export type BindResult = 'unchanged' | 'switched' | 'failed';
export type ReleaseResult = 'released' | 'nothing' | 'failed';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStore(): Store | null {
  try {
    const s = (globalThis as { localStorage?: Store }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

// Journal of every key this call touches, so a failure can restore all of them.
function createTx(store: Store) {
  const originals = new Map<string, string | null>();
  const touch = (key: string) => {
    if (!originals.has(key)) originals.set(key, store.getItem(key));
  };
  return {
    get(key: string): string | null {
      return store.getItem(key);
    },
    // write, read back, compare
    put(key: string, value: string): void {
      touch(key);
      store.setItem(key, value);
      if (store.getItem(key) !== value) {
        throw new Error(`read-back mismatch for ${key}`);
      }
    },
    del(key: string): void {
      touch(key);
      store.removeItem(key);
      if (store.getItem(key) !== null) {
        throw new Error(`could not remove ${key}`);
      }
    },
    rollback(): void {
      for (const [key, original] of originals) {
        try {
          if (original === null) store.removeItem(key);
          else store.setItem(key, original);
        } catch {
          // best effort; nothing more we can do
        }
      }
    },
  };
}

type Tx = ReturnType<typeof createTx>;

const stashKey = (key: string, id: string) => `${key}:u:${id}`;

function freeKey(tx: Tx, base: string): string {
  const stamp = Date.now();
  let candidate = `${base}:${stamp}`;
  let n = 0;
  while (tx.get(candidate) !== null) {
    n += 1;
    candidate = `${base}:${stamp}-${n}`;
  }
  return candidate;
}

// Move the active keys into <key>:u:<id>. A stash that gets replaced moves to
// :prev first; if :prev is already occupied by something different, that older
// copy is archived under a unique :prev:<time> key. Nothing is ever deleted.
function stashActive(tx: Tx, id: string): void {
  for (const key of ACTIVE_KEYS) {
    const value = tx.get(key);
    if (value === null) continue;
    const sKey = stashKey(key, id);
    const existing = tx.get(sKey);
    if (existing !== value) {
      if (existing !== null) {
        const prevKey = `${sKey}:prev`;
        const prev = tx.get(prevKey);
        if (prev !== null && prev !== existing) {
          tx.put(freeKey(tx, prevKey), prev);
        }
        if (prev !== existing) tx.put(prevKey, existing);
      }
      tx.put(sKey, value);
    }
    tx.del(key);
  }
}

// Move <key>:u:<id> back to the (empty) active keys. Returns true if anything moved.
function restoreStash(tx: Tx, id: string): boolean {
  let moved = false;
  for (const key of ACTIVE_KEYS) {
    const sKey = stashKey(key, id);
    const value = tx.get(sKey);
    if (value === null) continue;
    tx.put(key, value);
    tx.del(sKey);
    moved = true;
  }
  return moved;
}

// Unattributable data: parked under a key no code path ever reads back.
function orphanActive(tx: Tx): void {
  const payload = JSON.stringify({
    state: tx.get(STATE_KEY),
    profile: tx.get(PROFILE_KEY),
  });
  let stamp = Date.now();
  while (tx.get(`${ORPHAN_PREFIX}${stamp}`) !== null) stamp += 1;
  tx.put(`${ORPHAN_PREFIX}${stamp}`, payload);
  for (const key of ACTIVE_KEYS) {
    if (tx.get(key) !== null) tx.del(key);
  }
}

// The only JSON.parse in this module.
function readOnboardingId(tx: Tx): string | null {
  const raw = tx.get(STATE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const user = (parsed as { user?: unknown }).user;
    if (typeof user !== 'object' || user === null) return null;
    const id = (user as { onboardingUserId?: unknown }).onboardingUserId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export function hasActiveLocalData(): boolean {
  const store = getStore();
  if (!store) return false;
  try {
    return ACTIVE_KEYS.some((k) => store.getItem(k) !== null);
  } catch {
    return false;
  }
}

export function bindLocalDataToUser(userId: string): BindResult {
  if (typeof userId !== 'string' || userId.length === 0) return 'failed';
  const store = getStore();
  if (!store) return 'unchanged'; // no storage, so nothing can leak
  const tx = createTx(store);
  try {
    const owner = tx.get(OWNER_KEY);
    if (owner === userId) return 'unchanged';

    // Owner is another account.
    if (owner) {
      stashActive(tx, owner);
      restoreStash(tx, userId);
      tx.put(OWNER_KEY, userId);
      return 'switched';
    }

    // No owner recorded.
    const hasData = ACTIVE_KEYS.some((k) => tx.get(k) !== null);
    if (!hasData) {
      const restored = restoreStash(tx, userId);
      tx.put(OWNER_KEY, userId);
      return restored ? 'switched' : 'unchanged';
    }

    const claimedBy = readOnboardingId(tx);
    if (claimedBy === userId) {
      tx.put(OWNER_KEY, userId); // legacy data that is already theirs
      return 'unchanged';
    }
    if (claimedBy) stashActive(tx, claimedBy);
    else orphanActive(tx);
    restoreStash(tx, userId);
    tx.put(OWNER_KEY, userId);
    return 'switched';
  } catch {
    tx.rollback();
    return 'failed';
  }
}

export function releaseLocalDataOnSignOut(
  currentUserId: string | null,
): ReleaseResult {
  const store = getStore();
  if (!store) return 'nothing';
  const tx = createTx(store);
  try {
    const owner = tx.get(OWNER_KEY);
    const id = owner || currentUserId;
    if (!id) return 'nothing';
    stashActive(tx, id);
    for (const key of ACTIVE_KEYS) {
      if (tx.get(key) !== null) tx.del(key);
    }
    if (tx.get(OWNER_KEY) !== null) tx.del(OWNER_KEY);
    return 'released';
  } catch {
    tx.rollback();
    return 'failed';
  }
}
