import test from 'node:test';
import assert from 'node:assert/strict';
import { install, req } from '../support/fakes';
import { POST as forgot } from '@/app/api/enterprise/forgot-password/route';
import { POST as resend } from '@/app/api/enterprise/resend-verification/route';

test('forgot-password always answers ok and targets the enterprise reset page', async () => {
  const calls = install();
  const res = await forgot(req('http://localhost:3000/x', { email: 'a@b.co' }));
  assert.equal(res.status, 200);
  assert.equal(calls.reset[0][1].redirectTo, 'http://localhost:3000/enterprise/reset-password');
});
test('forgot-password rejects malformed email', async () => {
  install();
  assert.equal((await forgot(req('http://localhost:3000/x', { email: 'nope' }))).status, 422);
});
test('resend only sends for pending enterprise registrations, same response otherwise', async () => {
  let calls = install();
  assert.equal((await resend(req('http://localhost:3000/x', { email: 'a@b.co' }))).status, 200);
  assert.equal(calls.resend.length, 0);
  calls = install({ registrationByEmail: { user_id: 'u1' } });
  assert.equal((await resend(req('http://localhost:3000/x', { email: 'a@b.co' }))).status, 200);
  assert.equal(calls.resend.length, 1);
});
