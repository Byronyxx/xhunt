// Run: node --test --experimental-strip-types tests/*.test.ts
// Fake dependencies only: no network, no database, no timer longer than ~50 ms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Built at runtime so tsc does not try to resolve a '.ts' import path (TS5097).
const resolverUrl = pathToFileURL(
  path.resolve(import.meta.dirname, '..', 'src', 'lib', 'onboarding', 'resolver.ts'),
).href;
const mod = (await import(resolverUrl)) as typeof import('../src/lib/onboarding/resolver');
const { decideOnboarding, resolveOnboarding, redirectPathFor } = mod;

type DecisionInput = Parameters<typeof decideOnboarding>[0];
type Deps = Parameters<typeof resolveOnboarding>[0];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function input(over: Partial<DecisionInput> = {}): DecisionInput {
  return {
    auth: 'signed-in',
    userId: 'user-a',
    markerOwnerId: null,
    markerComplete: false,
    profileStatus: 'pending',
    ...over,
  };
}
const defaultGetUser: Deps['getUser'] = async () => ({ status: 'signed-in', user: { id: 'user-a' } });
const defaultFetchProfile: Deps['fetchProfile'] = async () => ({ status: 'complete' });
function makeDeps(over: Partial<Deps> = {}) {
  const writes: string[] = [];
  const calls = { getUser: 0, fetchProfile: 0 };
  const deps: Deps = {
    getUser: (signal) => {
      calls.getUser += 1;
      return (over.getUser ?? defaultGetUser)(signal);
    },
    fetchProfile: (id, signal) => {
      calls.fetchProfile += 1;
      return (over.fetchProfile ?? defaultFetchProfile)(id, signal);
    },
    readMarker: over.readMarker ?? (() => null),
    writeMarker: (id) => {
      writes.push(id);
    },
    timeoutMs: over.timeoutMs ?? 1000,
  };
  return { deps, writes, calls };
}

/* ───────────── decision ───────────── */

test('returns_render_for_authenticated_user_with_matching_complete_marker', () => {
  assert.equal(
    decideOnboarding(input({ markerOwnerId: 'user-a', markerComplete: true, profileStatus: 'pending' })),
    'render',
  );
});
test('does_not_trust_marker_owned_by_another_user', () => {
  const base = { markerOwnerId: 'user-b', markerComplete: true };
  assert.equal(decideOnboarding(input({ ...base, profileStatus: 'pending' })), 'checking');
  assert.equal(decideOnboarding(input({ ...base, profileStatus: 'incomplete' })), 'redirect-onboarding');
});
test('does_not_trust_legacy_marker_without_owner', () => {
  const base = { markerOwnerId: null, markerComplete: true };
  assert.equal(decideOnboarding(input({ ...base, profileStatus: 'pending' })), 'checking');
  assert.equal(decideOnboarding(input({ ...base, profileStatus: 'incomplete' })), 'redirect-onboarding');
});
test('returns_render_when_database_confirms_completion', () => {
  assert.equal(decideOnboarding(input({ profileStatus: 'complete' })), 'render');
});
test('returns_redirect_onboarding_when_database_confirms_incomplete', () => {
  assert.equal(decideOnboarding(input({ profileStatus: 'incomplete' })), 'redirect-onboarding');
});
test('returns_redirect_onboarding_when_profile_is_missing', () => {
  assert.equal(decideOnboarding(input({ profileStatus: 'missing' })), 'redirect-onboarding');
});
test('returns_retry_when_profile_lookup_fails', () => {
  assert.equal(decideOnboarding(input({ profileStatus: 'error' })), 'retry');
});
test('returns_retry_when_auth_lookup_fails', () => {
  assert.equal(decideOnboarding(input({ auth: 'error', userId: null })), 'retry');
});
test('returns_redirect_sign_in_only_when_user_is_confirmed_signed_out', () => {
  assert.equal(
    decideOnboarding(input({ auth: 'signed-out', userId: null, markerOwnerId: 'user-a', markerComplete: true })),
    'redirect-sign-in',
  );
  assert.notEqual(decideOnboarding(input({ auth: 'error', userId: null })), 'redirect-sign-in');
  assert.notEqual(decideOnboarding(input({ auth: 'pending', userId: null })), 'redirect-sign-in');
  assert.notEqual(decideOnboarding(input({ profileStatus: 'error' })), 'redirect-sign-in');
});
test('returns_checking_while_profile_lookup_is_pending', () => {
  assert.equal(decideOnboarding(input({ profileStatus: 'pending' })), 'checking');
});
test('redirect_path_mapping_is_shared', () => {
  assert.equal(redirectPathFor('redirect-onboarding'), '/get-started');
  assert.equal(redirectPathFor('redirect-sign-in'), '/sign-in');
  assert.equal(redirectPathFor('render'), null);
  assert.equal(redirectPathFor('checking'), null);
  assert.equal(redirectPathFor('retry'), null);
});

/* ───────────── resolver ───────────── */

test('resolves_onboarded_user_without_marker_and_writes_owner_marker', async () => {
  const { deps, writes } = makeDeps();
  const result = await resolveOnboarding(deps);
  assert.deepEqual(result, { decision: 'render', userId: 'user-a' });
  assert.deepEqual(writes, ['user-a']);
});
test('resolves_trusted_marker_without_profile_query', async () => {
  const { deps, writes, calls } = makeDeps({ readMarker: () => ({ ownerId: 'user-a', complete: true }) });
  const result = await resolveOnboarding(deps);
  assert.deepEqual(result, { decision: 'render', userId: 'user-a' });
  assert.equal(calls.fetchProfile, 0);
  assert.deepEqual(writes, []);
});
test('resolves_new_user_to_onboarding', async () => {
  for (const status of ['incomplete', 'missing'] as const) {
    const { deps, writes } = makeDeps({ fetchProfile: async () => ({ status }) });
    const result = await resolveOnboarding(deps);
    assert.deepEqual(result, { decision: 'redirect-onboarding', userId: 'user-a' });
    assert.deepEqual(writes, []);
  }
});
test('does_not_write_marker_when_profile_lookup_fails', async () => {
  const { deps, writes } = makeDeps({ fetchProfile: async () => ({ status: 'error' }) });
  const result = await resolveOnboarding(deps);
  assert.equal(result.decision, 'retry');
  assert.deepEqual(writes, []);
});
test('returns_retry_after_profile_timeout', async () => {
  const { deps, writes } = makeDeps({ fetchProfile: () => new Promise(() => {}), timeoutMs: 25 });
  const result = await resolveOnboarding(deps);
  assert.equal(result.decision, 'retry');
  assert.deepEqual(writes, []);
});
test('returns_retry_after_auth_timeout', async () => {
  const { deps, writes, calls } = makeDeps({ getUser: () => new Promise(() => {}), timeoutMs: 25 });
  const result = await resolveOnboarding(deps);
  assert.equal(result.decision, 'retry');
  assert.equal(calls.fetchProfile, 0);
  assert.deepEqual(writes, []);
});
test('passes_abort_signal_to_profile_lookup', async () => {
  const seen: AbortSignal[] = [];
  const d = deferred<{ status: 'complete' }>();
  const { deps, writes } = makeDeps({
    fetchProfile: (_id, signal) => {
      seen.push(signal);
      return d.promise;
    },
  });
  const outside = new AbortController();
  const p = resolveOnboarding(deps, { signal: outside.signal });
  await sleep(5);
  assert.equal(seen.length, 1);
  assert.ok(seen[0] instanceof AbortSignal);
  assert.equal(seen[0].aborted, false);
  outside.abort();
  const result = await p;
  assert.equal(seen[0].aborted, true);
  assert.equal(result.decision, 'retry');
  d.resolve({ status: 'complete' });
  await sleep(5);
  assert.deepEqual(writes, []);
});
test('retry_starts_a_fresh_resolution', async () => {
  let attempt = 0;
  const { deps, writes, calls } = makeDeps({
    getUser: async () => {
      attempt += 1;
      return attempt === 1 ? { status: 'error' } : { status: 'signed-in', user: { id: 'user-a' } };
    },
  });
  const first = await resolveOnboarding(deps);
  assert.equal(first.decision, 'retry');
  assert.deepEqual(writes, []);
  const second = await resolveOnboarding(deps);
  assert.deepEqual(second, { decision: 'render', userId: 'user-a' });
  assert.equal(calls.getUser, 2);
  assert.deepEqual(writes, ['user-a']);
});
test('ignores_late_result_from_timed_out_request', async () => {
  const d = deferred<{ status: 'complete' }>();
  const { deps, writes } = makeDeps({ fetchProfile: () => d.promise, timeoutMs: 20 });
  const result = await resolveOnboarding(deps);
  assert.equal(result.decision, 'retry');
  d.resolve({ status: 'complete' });
  await sleep(10);
  assert.deepEqual(writes, []);
});
test('ignores_result_from_superseded_request', async () => {
  const d = deferred<{ status: 'complete' }>();
  let current = true;
  const { deps, writes } = makeDeps({ fetchProfile: () => d.promise });
  const p = resolveOnboarding(deps, { isCurrent: () => current });
  await sleep(5);
  current = false;
  d.resolve({ status: 'complete' });
  const result = await p;
  assert.equal(result.decision, 'retry');
  assert.deepEqual(writes, []);
});
test('does_not_write_account_a_marker_after_account_b_becomes_current', async () => {
  let who = 'user-a';
  const gate = deferred<{ status: 'complete' }>();
  let hold = true;
  const { deps, writes } = makeDeps({
    getUser: async () => ({ status: 'signed-in', user: { id: who } }),
    fetchProfile: (id) => (hold && id === 'user-a' ? gate.promise : Promise.resolve({ status: 'complete' })),
  });
  const runA = resolveOnboarding(deps, { isCurrent: () => who === 'user-a' });
  await sleep(5);
  who = 'user-b'; // account B becomes current while A's lookup is in flight
  hold = false;
  const runB = await resolveOnboarding(deps, { isCurrent: () => who === 'user-b' });
  gate.resolve({ status: 'complete' }); // A's late answer arrives
  const resultA = await runA;
  assert.equal(resultA.decision, 'retry');
  assert.deepEqual(runB, { decision: 'render', userId: 'user-b' });
  assert.deepEqual(writes, ['user-b']); // nothing was written for A
});
test('does_not_trust_account_a_marker_for_account_b', async () => {
  const { deps, writes, calls } = makeDeps({
    getUser: async () => ({ status: 'signed-in', user: { id: 'user-b' } }),
    readMarker: () => ({ ownerId: 'user-a', complete: true }),
    fetchProfile: async () => ({ status: 'incomplete' }),
  });
  const result = await resolveOnboarding(deps);
  assert.deepEqual(result, { decision: 'redirect-onboarding', userId: 'user-b' });
  assert.equal(calls.fetchProfile, 1);
  assert.deepEqual(writes, []);
});
test('does_not_allow_legacy_marker_to_skip_database_verification', async () => {
  const { deps, writes, calls } = makeDeps({
    readMarker: () => ({ ownerId: null, complete: true }),
    fetchProfile: async () => ({ status: 'incomplete' }),
  });
  const result = await resolveOnboarding(deps);
  assert.equal(result.decision, 'redirect-onboarding');
  assert.equal(calls.fetchProfile, 1);
  assert.deepEqual(writes, []);
});
test('writes_marker_only_after_database_confirms_completion', async () => {
  for (const status of ['incomplete', 'missing', 'error'] as const) {
    const { deps, writes } = makeDeps({ fetchProfile: async () => ({ status }) });
    await resolveOnboarding(deps);
    assert.deepEqual(writes, [], `no write for ${status}`);
  }
  const { deps, writes } = makeDeps({ fetchProfile: async () => ({ status: 'complete' }) });
  await resolveOnboarding(deps);
  assert.deepEqual(writes, ['user-a']);
});
test('does_not_write_marker_when_user_id_is_missing', async () => {
  const { deps, writes, calls } = makeDeps({
    getUser: async () => ({ status: 'signed-in', user: { id: '' } }),
  });
  const result = await resolveOnboarding(deps);
  assert.equal(result.decision, 'retry');
  assert.equal(calls.fetchProfile, 0);
  assert.deepEqual(writes, []);
});
test('dependency_throw_becomes_retry_not_rejection', async () => {
  const syncThrow = makeDeps({
    getUser: () => {
      throw new Error('boom');
    },
  });
  assert.equal((await resolveOnboarding(syncThrow.deps)).decision, 'retry');
  assert.deepEqual(syncThrow.writes, []);
  const rejecting = makeDeps({ fetchProfile: () => Promise.reject(new Error('boom')) });
  assert.equal((await resolveOnboarding(rejecting.deps)).decision, 'retry');
  assert.deepEqual(rejecting.writes, []);
});
