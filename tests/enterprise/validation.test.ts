import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema, safeRedirectPath, orgNameKey, normalizeOrgName, isOrgRole } from '@/lib/enterprise/validation';

const ok = { orgName: 'Acme Corp', email: 'Owner@Acme.com', password: 'longenough1', acceptTerms: true };

test('register schema accepts valid input and lowercases email', () => {
  const r = registerSchema.safeParse(ok);
  assert.ok(r.success);
  assert.equal(r.data.email, 'owner@acme.com');
});
test('register schema rejects missing terms, short password, short name', () => {
  assert.ok(!registerSchema.safeParse({ ...ok, acceptTerms: false }).success);
  assert.ok(!registerSchema.safeParse({ ...ok, password: 'short' }).success);
  assert.ok(!registerSchema.safeParse({ ...ok, orgName: 'A' }).success);
});
test('org name key collapses case, spacing and punctuation', () => {
  assert.equal(orgNameKey(normalizeOrgName('  ACME   Corp. ')), orgNameKey('acme corp'));
});
test('safeRedirectPath only allows workspace/enterprise paths', () => {
  assert.equal(safeRedirectPath('/workspace/missions'), '/workspace/missions');
  for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', '/admin', '/workspace\n', undefined]) {
    assert.equal(safeRedirectPath(bad as string | undefined), '/workspace');
  }
});
test('isOrgRole excludes the Hunter role', () => {
  assert.ok(isOrgRole('tenant_admin'));
  assert.ok(!isOrgRole('participant'));
  assert.ok(!isOrgRole(null));
});
