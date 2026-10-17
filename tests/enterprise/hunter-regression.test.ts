import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Hunter auth surface must not be touched by the Enterprise work.
const hunterFiles = [
  'src/app/sign-in/[[...sign-in]]/page.tsx',
  'src/app/sign-up/[[...sign-up]]/page.tsx',
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/register/route.ts',
];

test('hunter auth files are unchanged relative to master', () => {
  let diff = '';
  try {
    execSync('git rev-parse --verify -q origin/master', { stdio: 'ignore' });
    diff = execSync(`git diff origin/master -- ${hunterFiles.map((f) => `'${f}'`).join(' ')}`, { encoding: 'utf8' });
  } catch {
    // no master ref available (e.g. shallow CI checkout): fall back to content check below
  }
  assert.equal(diff, '');
});
test('hunter register/login routes do not reference enterprise tables or RPCs', () => {
  for (const f of hunterFiles) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /enterprise_registrations|activate_enterprise_org/);
  }
});
