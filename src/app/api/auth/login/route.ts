import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:8000';

const SESSION_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const AT_OPTS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function setCookiesFromBackend(res: NextResponse, token: string, expiresIn: number) {
  const maxAge = expiresIn;
  res.cookies.set('__xhunt_session', token, { ...SESSION_OPTS, maxAge });
  res.cookies.set('__xhunt_at', token, { ...AT_OPTS, maxAge });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const upstream = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const res = NextResponse.json(data);
  setCookiesFromBackend(res, data.token.access_token, data.token.expires_in);
  return res;
}
