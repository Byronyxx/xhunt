import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'change-this-to-a-long-random-secret-at-least-64-chars'
);

const COOKIE = '__xhunt_session';

const PUBLIC_PATTERNS = [
  /^\/$/, /^\/about/, /^\/blog/, /^\/careers/, /^\/contact/,
  /^\/consumer/, /^\/cookies/, /^\/developers/, /^\/enterprise/,
  /^\/get-started/, /^\/marketplace/, /^\/mission-control/,
  /^\/pricing/, /^\/privacy/, /^\/security/, /^\/terms/, /^\/use-cases/,
  /^\/sign-in/, /^\/sign-up/,
  /^\/api\/contact/, /^\/api\/cron/, /^\/api\/stripe\/webhook/,
  // Consumer app pages are public for preview — re-add auth when ready
  /^\/home/, /^\/explore/, /^\/missions/, /^\/messages/, /^\/profile/,
];

const AUTH_PAGE_PATTERNS = [/^\/sign-in/, /^\/sign-up/];
const PROTECTED_PATTERNS = [/^\/workspace/, /^\/admin/];

function isPublic(pathname: string) {
  return PUBLIC_PATTERNS.some((p) => p.test(pathname));
}

function isAuthPage(pathname: string) {
  return AUTH_PAGE_PATTERNS.some((p) => p.test(pathname));
}

function isProtected(pathname: string) {
  return PROTECTED_PATTERNS.some((p) => p.test(pathname));
}

async function getSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value
    ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] });
    if (payload['type'] !== 'access') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const session = await getSession(req);

  // Redirect logged-in users away from auth pages to their surface
  if (session && isAuthPage(pathname)) {
    const surface = (session['surface'] as string) ?? 'home';
    return NextResponse.redirect(new URL(`/${surface}`, req.url));
  }

  // Protect workspace + admin routes
  if (isProtected(pathname)) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/sign-in';
      url.searchParams.set('redirect_url', pathname);
      return NextResponse.redirect(url);
    }
    // Enforce role access for admin
    if (pathname.startsWith('/admin') && session['role'] !== 'platform_admin') {
      return NextResponse.redirect(new URL('/home', req.url));
    }
  }

  // Pass user id downstream for API routes
  const res = NextResponse.next();
  if (session) {
    res.headers.set('x-user-id', session['sub'] as string);
    res.headers.set('x-user-role', session['role'] as string);
  }
  return res;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
