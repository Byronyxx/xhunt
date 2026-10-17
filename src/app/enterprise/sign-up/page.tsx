'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthShell, Field, Alert, SubmitButton, postJson } from '@/components/enterprise/ui';

export default function EnterpriseSignUpPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [orgError, setOrgError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password') ?? '');
    if (password !== String(f.get('confirm') ?? '')) { setError('Passwords do not match.'); return; }
    setBusy(true); setError(''); setOrgError('');
    const { ok, data } = await postJson('/api/enterprise/register', {
      orgName: f.get('orgName'),
      email: f.get('email'),
      password,
      acceptTerms: f.get('terms') === 'on',
    });
    setBusy(false);
    if (ok) { setDone(String(f.get('email'))); return; }
    if (data.field === 'orgName') setOrgError(data.detail); else setError(data.detail || 'Registration failed.');
  }

  if (done) {
    return (
      <AuthShell title="Check your email" subtitle={`If ${done} can be registered, we've sent a verification link. Verify your email, then sign in to set up your organization.`}>
        <Link href="/enterprise/sign-in" className="block text-center text-sm text-accent">Go to Enterprise sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your organization account"
      subtitle="You'll become the Organization Owner. We'll email a link to verify your address."
      footer={<>Already registered? <Link href="/enterprise/sign-in" className="text-accent">Sign in</Link> · Looking for the Hunter app? <Link href="/sign-up" className="text-accent">Join as a Hunter</Link></>}
    >
      <form onSubmit={onSubmit} noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Organization name" name="orgName" required minLength={2} maxLength={120} autoComplete="organization" error={orgError} />
        <Field label="Work email" name="email" type="email" required autoComplete="email" />
        <Field label="Password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
        <Field label="Confirm password" name="confirm" type="password" required autoComplete="new-password" />
        <label className="flex items-start gap-2 text-sm text-txt-dim mb-5">
          <input type="checkbox" name="terms" required className="mt-1" />
          <span>I agree to the <Link href="/terms" className="text-accent">Terms</Link> and <Link href="/privacy" className="text-accent">Privacy Policy</Link>.</span>
        </label>
        <SubmitButton busy={busy}>Create organization account</SubmitButton>
      </form>
    </AuthShell>
  );
}
