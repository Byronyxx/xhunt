import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The legacy /api/workspace/create route needs the real session helper, so its
// guards are pinned structurally rather than by execution.
const src = readFileSync(new URL('../../src/app/api/workspace/create/route.ts', import.meta.url), 'utf8');

test('workspace/create requires verified email, no existing tenant, participant role', () => {
  assert.match(src, /email_confirmed_at/);
  assert.match(src, /existing\?\.tenant_id/);
  assert.match(src, /existing\.role !== 'participant'/);
});
