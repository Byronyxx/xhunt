import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:8000';

export async function POST() {
  await fetch(`${BACKEND}/auth/logout`, { method: 'POST' }).catch(() => {});

  const res = NextResponse.json({ ok: true });
  res.cookies.delete('__xhunt_session');
  res.cookies.delete('__xhunt_at');
  res.cookies.delete('__xhunt_refresh');
  return res;
}
