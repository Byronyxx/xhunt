'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AuthShell, Field, Alert, SubmitButton } from '@/components/enterprise/ui';

export default function EnterpriseResetPasswordPage() {
  const [state, setState] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState(null, '', window.location.pathname);
        if (exchangeError) { if (!cancelled) setState('invalid'); return; }
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setState(data.session ? 'ready' : 'invalid');
    })();
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password') ?? '');
    if (password.length < 8 || password.length > 72) { setError('Password must be 8–72 characters.'); return; }
    if (password !== String(f.get('confirm') ?? '')) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setBusy(false); setError(updateError.message); return; }
    await supabase.auth.signOut();
    window.location.assign('/enterprise/sign-in?reset=1');
  }

  return (
    <AuthShell title="Choose a new password" footer={<Link href="/enterprise/sign-in" className="text-accent">Back to sign in</Link>}>
      {state === 'checking' && <p className="text-sm text-txt-dim">Checking your reset link…</p>}
      {state === 'invalid' && (
        <Alert>This reset link is invalid or has expired. <Link href="/enterprise/forgot-password" className="underline">Request a new one</Link>.</Alert>
      )}
      {state === 'ready' && (
        <form onSubmit={onSubmit} noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label="New password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
          <Field label="Confirm new password" name="confirm" type="password" required autoComplete="new-password" />
          <SubmitButton busy={busy}>Update password</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
