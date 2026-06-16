import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  // Marketing & informational pages
  '/',
  '/about(.*)',
  '/blog(.*)',
  '/careers(.*)',
  '/contact(.*)',
  '/consumer(.*)',
  '/cookies(.*)',
  '/developers(.*)',
  '/enterprise(.*)',
  '/get-started(.*)',
  '/marketplace(.*)',
  '/mission-control(.*)',
  '/missions(.*)',
  '/pricing(.*)',
  '/privacy(.*)',
  '/security(.*)',
  '/terms(.*)',
  '/use-cases(.*)',
  // Auth — Clerk native sign-in/sign-up only; /auth/* pages are removed
  '/sign-in(.*)',
  '/sign-up(.*)',
  // Public APIs
  '/api/clerk/(.*)',
  '/api/contact(.*)',
  '/api/cron/(.*)',
  '/api/stripe/webhook(.*)',
]);

// Redirect already-authenticated users away from Clerk auth pages
const isAuthRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isAuthRoute(req)) {
    try {
      const { userId, sessionClaims } = await auth();
      if (userId) {
        // Route to correct surface based on publicMetadata.default_surface
        const meta = sessionClaims?.publicMetadata as Record<string, string> | undefined;
        const surface = meta?.default_surface ?? 'home';
        return Response.redirect(new URL(`/${surface}`, req.url));
      }
    } catch {
      // Clerk not configured — let through
    }
    return;
  }

  // PREVIEW MODE: auth bypassed for all routes — re-enable auth.protect() before production launch
  // if (!isPublicRoute(req)) { await auth.protect(); }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
