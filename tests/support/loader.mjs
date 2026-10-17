// Test-only resolver: maps the "@/" alias to src/, and swaps next/server and the
// Supabase client factories for stubs driven by globalThis.__sb (see tests/support/stubs).
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stub = (n) => pathToFileURL(path.join(root, 'tests/support/stubs', n)).href;
const overrides = {
  'next/server': stub('next-server.ts'),
  '@/lib/supabase/server': stub('supabase-server.ts'),
  '@/lib/supabase/admin': stub('supabase-admin.ts'),
};

export async function resolve(specifier, context, next) {
  if (overrides[specifier]) return { url: overrides[specifier], shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const base = path.join(root, 'src', specifier.slice(2));
    for (const f of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
      if (existsSync(f)) return { url: pathToFileURL(f).href, shortCircuit: true };
    }
  }
  if (specifier.startsWith('.') && !path.extname(specifier) && context.parentURL) {
    const f = path.resolve(path.dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`);
    if (existsSync(f)) return { url: pathToFileURL(f).href, shortCircuit: true };
  }
  return next(specifier, context);
}
