'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AuthShell, Field, Alert, SubmitButton, postJson } from '@/components/enterprise/ui';

// Landing page for the Supabase confirmation link. Verification only confirms the
// email address: the session created by the link is discarded and the owner signs
// in explicitly, which is when the organization is activated (server-side).

type State = 'checking' | 'verified' | 'problem';

export default function EnterpriseVerifyEmailPage() {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const code = query.get('code');
      const linkError = query.get('error') || hash.get('error');
      window.history.replaceState(null, '', window.location.pathname);

      if (linkError) { if (!cancelled) setState('problem'); return; }
      if (!code) { if (!cancelled) setState('problem'); return; }

      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) { if (!cancelled) setState('problem'); return; }
      await supabase.auth.signOut();
      if (!cancelled) setState('verified');
    })();
    return () => { cancelled = true; };
  }, []);

  async function onResend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    await postJson('/api/enterprise/resend-verification', { email: f.get('email') });
    setBusy(false); setResent(true);
  }

  return (
    <AuthShell title={state === 'verified' ? 'Email verified' : 'Verify your email'}>
      {state === 'checking' && <p className="text-sm text-txt-dim">Verifying your email…</p>}
      {state === 'verified' && (
        <>
          <p className="text-sm text-txt-dim mb-5">Your email is confirmed. Sign in to set up your organization.</p>
          <Link href="/enterprise/sign-in?verified=1" className="block w-full h-11 leading-[44px] text-center rounded-xl bg-ai text-txt font-bold">Continue to sign in</Link>
        </>
      )}
      {state === 'problem' && (
        <>
          <Alert>
            We couldn&apos;t confirm your email from this link. It may have expired, or been opened in a different browser than the one you registered in.
            If you already verified, <Link href="/enterprise/sign-in" className="underline">sign in</Link>.
          </Alert>
          {resent ? (
            <Alert kind="info">If this registration is pending, a new verification email is on its way.</Alert>
          ) : (
            <form onSubmit={onResend} noValidate>
              <Field label="Work email" name="email" type="email" required autoComplete="email" />
              <SubmitButton busy={busy}>Resend verification email</SubmitButton>
            </form>
          )}
        </>
      )}
    </AuthShell>
  );
}
