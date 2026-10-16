import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Combines three responsibilities in one pass, since Next.js only allows a
// single proxy/middleware file:
//  1. Refresh the Supabase Auth session on every request (previously
//     src/middleware.ts) — without this, expiring access tokens only get
//     refreshed the next time a page happened to read cookies server-side.
//  2. Route protection — redirect signed-out users away from protected
//     pages, and signed-in users away from the auth pages (previously this
//     file, but reading a dead custom-JWT `__xhunt_session` cookie left
//     over from the retired FastAPI backend; now reads the real Supabase
//     session instead).
//  3. Inactivity timeout — force-signs-out any authenticated request whose
//     account has gone idle past its role's threshold. This is the actual
//     security boundary for idle timeout: it runs on every request this
//     file matches (pages and API routes alike), unlike
//     getSession()/requireSession() in src/lib/auth/server.ts, which only
//     guards the specific API routes that call it. That's a deliberate
//     choice to keep idle-timeout logic in one place rather than split
//     across two files with different reach.

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

// Idle-timeout thresholds. 'participant' is the only hunter-side role (see
// migration 001's role CHECK constraint); everything else — mission_creator,
// analyst, tenant_admin, platform_admin — is tenant-side and gets the
// longer window. This is deliberately NOT the same split as ADMIN_ROLES
// above: ADMIN_ROLES exists only to gate the /admin route, and excludes
// mission_creator/analyst even though both are tenant-side accounts.
const HUNTER_IDLE_TIMEOUT_MINUTES = Number(process.env.HUNTER_IDLE_TIMEOUT_MINUTES ?? 30);
const ORG_IDLE_TIMEOUT_MINUTES = Number(process.env.ORG_IDLE_TIMEOUT_MINUTES ?? 45);

// At most one last_active_at write per user per this many seconds,
// regardless of how many requests they make in that window.
const ACTIVITY_WRITE_THROTTLE_SECONDS = 60;

function isAuthPage(pathname: string) {
  return AUTH_PAGE_PATTERNS.some((p) => p.test(pathname));
}

function isProtected(pathname: string) {
  return PROTECTED_PATTERNS.some((p) => p.test(pathname));
}

function idleThresholdMinutes(role: string) {
  return role === 'participant' ? HUNTER_IDLE_TIMEOUT_MINUTES : ORG_IDLE_TIMEOUT_MINUTES;
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
  let { data: { user } } = await supabase.auth.getUser();

  // ── Inactivity timeout ──────────────────────────────────────────────
  // Runs for every authenticated request. Also doubles as the role lookup
  // the /admin check below needs, so that check no longer runs a second
  // query for the same row.
  let idleTimedOut = false;
  let role: string | null = null;

  if (user) {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role, last_active_at')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile) {
        role = profile.role;
        const lastActiveAt = profile.last_active_at ? new Date(profile.last_active_at).getTime() : 0;
        const idleMinutes = (Date.now() - lastActiveAt) / 60_000;
        const threshold = idleThresholdMinutes(profile.role);

        if (idleMinutes > threshold) {
          // Full signOut(), not just treating the request as unauthenticated —
          // this revokes the actual Supabase session (refresh token included),
          // so a stale-but-still-present cookie can't just "revive" itself.
          await supabase.auth.signOut();
          user = null;
          idleTimedOut = true;
        } else if (idleMinutes * 60 > ACTIVITY_WRITE_THROTTLE_SECONDS) {
          await supabase
            .from('user_profiles')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', user.id);
        }
      }
    } catch (err) {
      // Fail open on the idle-timeout check specifically — a DB error here
      // (an unapplied migration, a transient network blip, whatever) must
      // not take down every authenticated request through this file's
      // single choke point. The user stays signed in for this request;
      // `role` stays null, which makes the /admin check below fail CLOSED
      // (deny) rather than silently granting admin access on an error it
      // can't actually verify against.
      console.error('[proxy] idle-timeout check failed, skipping for this request:', err);
    }
  }

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
      if (idleTimedOut) {
        url.searchParams.set('reason', 'idle_timeout');
      }

      const redirect = NextResponse.redirect(url);
      if (idleTimedOut) {
        // Carry over the cookies signOut() just cleared — NextResponse.redirect()
        // starts a fresh response, and without this the Set-Cookie headers from
        // signOut() would be dropped, leaving a stale cookie in the browser even
        // though the session was already revoked server-side.
        response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      }
      return redirect;
    }

    // Admin routes additionally require an admin role. `role` came from the
    // RLS-scoped query above (self-read only), not a service-role client, so
    // it can't be used to read anyone else's profile.
    if (pathname.startsWith('/admin')) {
      if (!role || !ADMIN_ROLES.has(role)) {
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
