import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const url = pathToFileURL(
  path.resolve(import.meta.dirname, '..', 'src', 'lib', 'safe-redirect.ts'),
).href;
const { safeRedirectPath } = (await import(url)) as typeof import('../src/lib/safe-redirect');

const ORIGIN = 'https://app.test';
const FALLBACK = '/home';

test('keeps a plain same-origin path', () => {
  assert.equal(safeRedirectPath('/home', '/fallback', ORIGIN), '/home');
});

test('keeps path, search and hash', () => {
  assert.equal(
    safeRedirectPath('/missions?tab=active#x', FALLBACK, ORIGIN),
    '/missions?tab=active#x',
  );
});

test('null, undefined and empty string fall back', () => {
  assert.equal(safeRedirectPath(null, FALLBACK, ORIGIN), FALLBACK);
  assert.equal(safeRedirectPath(undefined, FALLBACK, ORIGIN), FALLBACK);
  assert.equal(safeRedirectPath('', FALLBACK, ORIGIN), FALLBACK);
});

test('protocol-relative URL falls back', () => {
  assert.equal(safeRedirectPath('//evil.com', FALLBACK, ORIGIN), FALLBACK);
});

test('slash followed by backslash falls back', () => {
  assert.equal(safeRedirectPath('/\\evil.com', FALLBACK, ORIGIN), FALLBACK);
});

test('leading backslash falls back', () => {
  assert.equal(safeRedirectPath('\\evil.com', FALLBACK, ORIGIN), FALLBACK);
});

test('absolute external URL falls back', () => {
  assert.equal(safeRedirectPath('https://evil.com', FALLBACK, ORIGIN), FALLBACK);
});

test('javascript: URL falls back', () => {
  assert.equal(safeRedirectPath('javascript:alert(1)', FALLBACK, ORIGIN), FALLBACK);
});

test('path without leading slash falls back', () => {
  assert.equal(safeRedirectPath('home', FALLBACK, ORIGIN), FALLBACK);
});

test('control characters (tab, newline) fall back', () => {
  assert.equal(safeRedirectPath('/ho\tme', FALLBACK, ORIGIN), FALLBACK);
  assert.equal(safeRedirectPath('/home\nx', FALLBACK, ORIGIN), FALLBACK);
  assert.equal(safeRedirectPath('/\t/evil.com', FALLBACK, ORIGIN), FALLBACK);
});
