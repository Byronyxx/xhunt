import { createBrowserClient } from '@supabase/ssr';

function getAccessToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('__xhunt_at='))
    ?.substring('__xhunt_at='.length);
}

export function createClient() {
  const token = getAccessToken();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : undefined,
  );
}
