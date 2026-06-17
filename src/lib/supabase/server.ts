import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  // Pass our custom JWT as Authorization so Supabase RLS can use auth.uid()
  const token = cookieStore.get('__xhunt_session')?.value;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — read-only; middleware handles refresh
          }
        },
      },
    }
  );
}
