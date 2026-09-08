import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Combines two responsibilities in one pass, since Next.js only allows a
// single proxy/middleware file:
//  1. Refresh the Supabase Auth session on every request (previously
//     src/middleware.ts) — without this, expiring access tokens only get
//     refreshed the next time a page happened to read cookies server-side.
//  2. Route protection — redirect signed-out users away from protected
//     pages, and signed-in users away from the auth pages (previously this
//     file, but reading a dead custom-JWT `__xhunt_session` cookie left
//     over from the retired FastAPI backend; now reads the real Supabase
//     session instead).

const PUBLIC_PATTERNS = [
  /^\/$/, /^\/about/, /^\/blog/, /^\/careers/, /^\/contact/,
  /^\/consumer/, /^\/cookies/, /^\/developers/, /^\/enterprise/,
  /^\/get-started/, /^\/marketplace/, /^\/mission-control/,
  /^\/pricing/, /^\/privacy/, /^\/security/, /^\/terms/, /^\/use-cases/,
  /^\/sign-in/, /^\/sign-up/,
  /^\/api\/auth/, /^\/api\/contact/, /^\/api\/cron/, /^\/api\/stripe\/webhook/,
];

const AUTH_PAGE_PATTERNS = [/^\/sign-in/, /^\/sign-up/];
const PROTECTED_PATTERNS = [
  /^\/workspace/, /^\/admin/,
  /^\/home/, /^\/explore/, /^\/missions/, /^\/messages/, /^\/profile/,
  /^\/hunt/, /^\/active/, /^\/complete/, /^\/live/, /^\/people/, /^\/rewards/,
];

const ADMIN_ROLES = new Set(['platform_admin', 'tenant_admin']);

function isAuthPage(pathname: string) {
  return AUTH_PAGE_PATTERNS.some((p) => p.test(pathname));
}

function isProtected(pathname: string) {
  return PROTECTED_PATTERNS.some((p) => p.test(pathname));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This call both refreshes the session (if expiring) and tells us who's
  // signed in — no separate refresh step needed.
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect signed-in users away from the auth pages.
  if (user && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL('/home', req.url));
  }

  // Protect workspace + admin + other authenticated-only routes.
  if (isProtected(pathname)) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = '/sign-in';
      url.searchParams.set('redirect_url', pathname);
      return NextResponse.redirect(url);
    }

    // Admin routes additionally require an admin role. This query runs as
    // the signed-in user (RLS-scoped to their own row), not a service-role
    // client, so it can't be used to read anyone else's profile.
    if (pathname.startsWith('/admin')) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !ADMIN_ROLES.has(profile.role)) {
        return NextResponse.redirect(new URL('/home', req.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
