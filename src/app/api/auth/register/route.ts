import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/resend';

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

export async function POST(req: NextRequest) {
  const body = await req.json();

  const upstream = await fetch(`${BACKEND}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const maxAge = data.token.expires_in;
  const res = NextResponse.json(data, { status: 201 });
  res.cookies.set('__xhunt_session', data.token.access_token, { ...SESSION_OPTS, maxAge });
  res.cookies.set('__xhunt_at', data.token.access_token, { ...AT_OPTS, maxAge });

  // Fire welcome email non-blocking; registration still succeeds if email fails
  sendEmail({
    to: body.email as string,
    template: 'welcome',
    data: { name: (body.display_name ?? body.email) as string },
  }).catch((err: unknown) => console.error('[register] welcome email failed:', err));

  return res;
}
