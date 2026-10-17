import test from 'node:test';
import assert from 'node:assert/strict';
import { install, req } from '../support/fakes';
import { POST } from '@/app/api/enterprise/sign-in/route';

const URL_ = 'http://localhost:3000/api/enterprise/sign-in';
const creds = { email: 'owner@acme.com', password: 'longenough1' };
const orgProfile = { id: 'u1', email: 'owner@acme.com', display_name: 'O', role: 'tenant_admin', tenant_id: 't1' };

test('org member signs in and gets a safe redirect', async () => {
  const calls = install({ profile: orgProfile });
  const res = await POST(req(URL_, { ...creds, redirectTo: '//evil.com' }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).redirect, '/workspace');
  assert.equal(calls.rpc.length, 0);
});
test('unverified email is refused with email_not_verified', async () => {
  install({ signIn: { data: {}, error: { code: 'email_not_confirmed', message: 'Email not confirmed', status: 400 } } });
  const res = await POST(req(URL_, creds));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'email_not_verified');
});
test('wrong password is a generic 401', async () => {
  install({ signIn: { data: {}, error: { message: 'Invalid login credentials', status: 400 } } });
  assert.equal((await POST(req(URL_, creds))).status, 401);
});
test('verified registrant is activated on first sign-in and enters the workspace', async () => {
  const calls = install({
    profile: [{ ...orgProfile, role: 'participant', tenant_id: null }, orgProfile],
    rpc: { data: 't1', error: null },
  });
  const res = await POST(req(URL_, creds));
  assert.deepEqual(calls.rpc[0], ['activate_enterprise_org', { p_user_id: 'u1' }]);
  assert.equal(res.status, 200);
  assert.equal(calls.signOut, 0);
});
test('Hunter (no org) is signed out and refused', async () => {
  const calls = install({
    profile: { ...orgProfile, role: 'participant', tenant_id: null },
    rpc: { data: null, error: { code: 'XH002', message: 'ineligible' } },
  });
  const res = await POST(req(URL_, creds));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'not_organization_account');
  assert.equal(calls.signOut, 1);
});
test('activation outage signs out with 503, grants nothing', async () => {
  const calls = install({
    profile: { ...orgProfile, role: 'participant', tenant_id: null },
    rpc: { data: null, error: { code: '42883', message: 'function does not exist' } },
  });
  const res = await POST(req(URL_, creds));
  assert.equal(res.status, 503);
  assert.equal(calls.signOut, 1);
});
test('participant with a tenant but no org role is refused', async () => {
  const calls = install({ profile: { ...orgProfile, role: 'participant' } });
  assert.equal((await POST(req(URL_, creds))).status, 403);
  assert.equal(calls.signOut, 1);
});
