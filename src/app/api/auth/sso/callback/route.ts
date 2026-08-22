import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/sso/callback
 *
 * ACS (Assertion Consumer Service) endpoint for SAML 2.0 and OIDC SSO flows.
 * After the IdP authenticates the user it redirects here with a code/SAMLResponse.
 * We exchange it via Supabase Auth, then redirect to the workspace.
 *
 * For SAML:  IdP posts to this URL with SAMLResponse in the body (handled by Supabase)
 * For OIDC:  IdP redirects here with ?code=… (standard PKCE code exchange)
 *
 * The actual cryptographic verification is delegated to Supabase Auth — this route
 * only needs to exchange the code and establish the session cookie.
 *
 * ⚠ FLAGGED, NOT FIXED: this route still authenticates via Supabase's own Auth
 * service (exchangeCodeForSession / signInWithSSO), which is a completely
 * separate identity system from the custom FastAPI + JWT auth the rest of the
 * app now uses (see migrations 020–029). It does not set the __xhunt_session /
 * __xhunt_at cookies the rest of the app reads, so a successful SSO login here
 * would NOT actually log the user into xhunt as currently wired. This needs a
 * product decision — either wire SSO through the backend's own auth service,
 * or intentionally retire this route — rather than a mechanical fix.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');
  const next  = searchParams.get('next') ?? '/workspace';

  if (error) {
    const desc = searchParams.get('error_description') ?? error;
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(desc)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`,
      );
    }

    // Log the SSO event for audit trail
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('sso_audit_log').insert({
          user_id:    user.id,
          event_type: 'sso_login',
          metadata:   { provider: user.app_metadata?.provider ?? 'unknown', next },
        });
      }
    } catch {
      // Non-critical — don't block login if audit insert fails
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  // No code and no error — unexpected state, return to login
  return NextResponse.redirect(`${origin}/auth/login`);
}

/**
 * POST /api/auth/sso/callback
 * Handles SAML 2.0 POST binding — IdP sends SAMLResponse as form data.
 */
export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const formData = await req.formData();
  const samlResponse = formData.get('SAMLResponse');
  const relayState   = formData.get('RelayState')?.toString() ?? '/workspace';

  if (!samlResponse) {
    return NextResponse.redirect(`${origin}/auth/login?error=Missing+SAMLResponse`);
  }

  // Supabase handles SAML validation internally; we initiate via the SAML sign-in URL.
  // This endpoint exists so orgs can configure our URL as their ACS endpoint.
  // Forward as a redirect to Supabase's SAML handler.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithSSO({
    domain: '',  // resolved from SAMLResponse issuer by Supabase
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error?.message ?? 'SAML error')}`);
  }

  return NextResponse.redirect(data.url);
}
