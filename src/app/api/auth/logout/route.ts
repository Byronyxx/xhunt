import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const res = NextResponse.json({ ok: true });
  // Clean up any leftover cookies from the old custom-JWT auth system.
  res.cookies.delete('__xhunt_session');
  res.cookies.delete('__xhunt_at');
  res.cookies.delete('__xhunt_refresh');
  return res;
}
