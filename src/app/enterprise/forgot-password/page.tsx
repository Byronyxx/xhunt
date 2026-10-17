'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthShell, Field, Alert, SubmitButton, postJson } from '@/components/enterprise/ui';

export default function EnterpriseForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError('');
    const { ok, data } = await postJson('/api/enterprise/forgot-password', { email: f.get('email') });
    setBusy(false);
    if (ok) setSent(true); else setError(data.detail || 'Something went wrong.');
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your work email and we'll send a reset link."
      footer={<Link href="/enterprise/sign-in" className="text-accent">Back to sign in</Link>}
    >
      {sent ? (
        <Alert kind="info">If an account exists for that email, a reset link is on its way. Open it in this same browser.</Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label="Work email" name="email" type="email" required autoComplete="email" />
          <SubmitButton busy={busy}>Send reset link</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
