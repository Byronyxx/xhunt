import { jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'change-this-to-a-long-random-secret-at-least-64-chars'
);

const COOKIE = '__xhunt_session';

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  surface: string;
}

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE)?.value
    ?? req.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] });
    if (payload['type'] !== 'access') return null;
    return {
      sub: payload.sub as string,
      email: payload['email'] as string,
      role: payload['role'] as string,
      surface: payload['surface'] as string,
    };
  } catch {
    return null;
  }
}

export async function requireSession(req: NextRequest): Promise<SessionPayload> {
  const session = await getSession(req);
  if (!session) throw new Error('Unauthorized');
  return session;
}
