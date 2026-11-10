import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const KEY = 'NEXT_PUBLIC_PRICING_ENABLED';
const base = pathToFileURL(path.resolve(import.meta.dirname, '..', 'src', 'lib', 'pricing.ts')).href;
let n = 0;

type PricingModule = {
  PRICING_ENABLED: boolean;
  pricingDisabledResponse: () => Response;
};

// Fresh module instance per call: the ?v= query defeats the module cache.
async function load(value: string | undefined): Promise<PricingModule> {
  const prev = process.env[KEY];
  if (value === undefined) delete process.env[KEY];
  else process.env[KEY] = value;
  try {
    return (await import(`${base}?v=${++n}`)) as PricingModule;
  } finally {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  }
}

const cases: Array<[string | undefined, boolean]> = [
  [undefined, false],
  ['false', false],
  ['TRUE', false],
  ['1', false],
  ['', false],
  ['true', true],
];

for (const [value, expected] of cases) {
  test(`PRICING_ENABLED is ${expected} when env is ${JSON.stringify(value)}`, async () => {
    const mod = await load(value);
    assert.equal(mod.PRICING_ENABLED, expected);
  });
}

test('pricingDisabledResponse returns 403 with the expected JSON body', async () => {
  const { pricingDisabledResponse } = await load(undefined);
  const res = pricingDisabledResponse();
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), {
    error: 'pricing_disabled',
    message: 'Plans are not available yet.',
  });
});
