import test from 'node:test';
import assert from 'node:assert/strict';
import { install, req } from '../support/fakes';
import { POST } from '@/app/api/enterprise/register/route';

const body = { orgName: 'Acme Corp', email: 'owner@acme.com', password: 'longenough1', acceptTerms: true };
const URL_ = 'http://localhost:3000/api/enterprise/register';

test('registers: records intent, never creates a tenant or profile role', async () => {
  const calls = install();
  const res = await POST(req(URL_, body));
  assert.equal(res.status, 201);
  assert.equal(calls.signUp[0].options.emailRedirectTo, 'http://localhost:3000/enterprise/verify-email');
  assert.deepEqual(calls.inserts.map((i) => i.table), ['enterprise_registrations']);
  assert.equal(calls.rpc.length, 0);
});
test('rejects invalid body with 422 and no side effects', async () => {
  const calls = install();
  const res = await POST(req(URL_, { ...body, acceptTerms: false }));
  assert.equal(res.status, 422);
  assert.equal(calls.signUp.length, 0);
});
test('duplicate org name is refused before creating an auth user', async () => {
  const calls = install({ registrationByName: { user_id: 'other' } });
  const res = await POST(req(URL_, body));
  assert.equal(res.status, 409);
  assert.equal(calls.signUp.length, 0);
});
test('already-registered email gets the same generic response and records nothing', async () => {
  const calls = install({ signUp: { data: { user: { id: 'u9', identities: [] }, session: null }, error: null } });
  const res = await POST(req(URL_, body));
  assert.equal(res.status, 201);
  assert.equal(calls.inserts.length, 0);
});
test('a returned session is signed out', async () => {
  const calls = install({ signUp: { data: { user: { id: 'u1', identities: [{}] }, session: {} }, error: null } });
  await POST(req(URL_, body));
  assert.equal(calls.signOut, 1);
});
test('missing migration (lookup error) yields 503 before signUp', async () => {
  const calls = install({ lookupError: { message: 'relation does not exist' } });
  const res = await POST(req(URL_, body));
  assert.equal(res.status, 503);
  assert.equal(calls.signUp.length, 0);
});
test('name race on insert returns 409', async () => {
  install({ insertError: { code: '23505', message: 'duplicate key enterprise_registrations_name_key_idx' } });
  const res = await POST(req(URL_, body));
  assert.equal(res.status, 409);
});
test('malformed JSON is 400', async () => {
  install();
  assert.equal((await POST(req(URL_, null, '{nope'))).status, 400);
});
