'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthShell, Field, Alert, SubmitButton, postJson } from '@/components/enterprise/ui';

function SignInForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState('');
  const [resent, setResent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(''); setUnverified(''); setResent(false);
    const email = String(f.get('email') ?? '');
    const { ok, data } = await postJson('/api/enterprise/sign-in', {
      email, password: f.get('password'), redirectTo: params.get('redirect') ?? undefined,
    });
    if (ok) { window.location.assign(data.redirect || '/workspace'); return; }
    setBusy(false);
    if (data.code === 'email_not_verified') setUnverified(email); else setError(data.detail || 'Sign in failed.');
  }

  async function resend() {
    await postJson('/api/enterprise/resend-verification', { email: unverified });
    setResent(true);
  }

  return (
    <AuthShell
      title="Enterprise sign in"
      subtitle="Sign in to your organization workspace."
      footer={<>New organization? <Link href="/enterprise/sign-up" className="text-accent">Create an account</Link> · Hunter? <Link href="/sign-in" className="text-accent">Sign in here</Link></>}
    >
      <form onSubmit={onSubmit} noValidate>
        {params.get('verified') && <Alert kind="info">Email verified. Sign in to continue.</Alert>}
        {params.get('reset') && <Alert kind="info">Password updated. Sign in with your new password.</Alert>}
        {error && <Alert>{error}</Alert>}
        {unverified && (
          <Alert>
            Verify your email address before signing in.{' '}
            {resent ? 'A new link is on its way if this registration is pending.' : <button type="button" onClick={resend} className="underline">Resend verification email</button>}
          </Alert>
        )}
        <Field label="Work email" name="email" type="email" required autoComplete="email" />
        <Field label="Password" name="password" type="password" required autoComplete="current-password" />
        <div className="text-right -mt-2 mb-5"><Link href="/enterprise/forgot-password" className="text-xs text-accent">Forgot password?</Link></div>
        <SubmitButton busy={busy}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}

export default function EnterpriseSignInPage() {
  return <Suspense><SignInForm /></Suspense>;
}
