// Run: node --test --experimental-strip-types tests/groq-lazy.test.ts
// No real key and no network: the key-present test uses a placeholder key and
// a stubbed fetch, so nothing ever reaches Google.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Build the module URL at runtime so tsc does not try to resolve a '.ts'
// import path (TS5097), since tsconfig includes **/*.ts.
const groqUrl = pathToFileURL(
  path.resolve(import.meta.dirname, '..', 'src', 'lib', 'groq.ts'),
).href;

type GroqModule = {
  default: {
    chat: { completions: { create: (params: unknown) => Promise<unknown> } };
  };
  modelForTier: (tier: string) => string;
  isGeminiConfigured: () => boolean;
  MissingGeminiKeyError: new () => Error;
};

const load = async () => (await import(groqUrl)) as GroqModule;
const request = {
  model: 'gemini-3.5-flash-lite',
  messages: [{ role: 'user', content: 'hi' }],
};

const savedKey = process.env.GEMINI_API_KEY;
const savedFetch = globalThis.fetch;
delete process.env.GEMINI_API_KEY;

test('importing the module without GEMINI_API_KEY does not throw', async () => {
  const mod = await load();
  assert.ok(mod.default);
  assert.equal(mod.isGeminiConfigured(), false);
  assert.equal(mod.modelForTier('pro'), 'gemini-3.5-flash');
  assert.equal(mod.modelForTier('trial'), 'gemini-3.5-flash-lite');
  assert.equal(mod.modelForTier('unknown'), 'gemini-3.5-flash-lite');
});

test('an AI call without a key fails with a clear MissingGeminiKeyError', async () => {
  const mod = await load();
  await assert.rejects(
    async () => mod.default.chat.completions.create(request),
    (err: unknown) =>
      err instanceof mod.MissingGeminiKeyError && /GEMINI_API_KEY is not set/.test((err as Error).message),
  );
});

test('a blank or whitespace-only key counts as missing', async () => {
  const mod = await load();
  for (const blank of ['', '   ']) {
    process.env.GEMINI_API_KEY = blank;
    assert.equal(mod.isGeminiConfigured(), false);
    await assert.rejects(
      async () => mod.default.chat.completions.create(request),
      /GEMINI_API_KEY is not set/,
    );
  }
  delete process.env.GEMINI_API_KEY;
});

test('with a key, the client is built on first call and targets the Gemini endpoint', async () => {
  const mod = await load();
  process.env.GEMINI_API_KEY = 'placeholder-test-key';
  assert.equal(mod.isGeminiConfigured(), true);

  const seen: { url: string; auth: string | null }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    seen.push({ url, auth: headers.get('authorization') });
    return new Response(
      JSON.stringify({
        id: 'x', object: 'chat.completion', created: 0, model: request.model,
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  const res = (await mod.default.chat.completions.create(request)) as {
    choices: { message: { content: string } }[];
  };
  assert.equal(res.choices[0].message.content, 'ok');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.equal(seen[0].auth, 'Bearer placeholder-test-key');
});

test.after(() => {
  globalThis.fetch = savedFetch;
  if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedKey;
});
