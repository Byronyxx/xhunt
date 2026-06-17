'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiLogin } from '@/lib/auth/api';
import { useAuth } from '@/lib/auth/context';

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(10,18,38,0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, color: '#F0F4FF',
  fontSize: 14, outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#8B9CC0', letterSpacing: '0.08em',
  textTransform: 'uppercase', marginBottom: 6,
};

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await apiLogin({ email, password });
      setUser(user);
      const redirectUrl = params.get('redirect_url') ?? `/${user.surface}`;
      router.push(redirectUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--t-bg)', display: 'flex' }}>

      {/* ── Left panel — visual (desktop only) ── */}
      <div style={{
        display: 'none', position: 'relative',
        flex: '0 0 52%', overflow: 'hidden',
        background: 'linear-gradient(135deg, #020A14 0%, #041220 40%, #051A18 100%)',
      }} className="md:flex md:flex-col md:justify-between md:p-12">
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 80% 70% at 50% 60%, rgba(0,200,130,0.13) 0%, rgba(0,120,100,0.06) 45%, transparent 75%)',
        }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 40px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, aspectRatio: '4/3' }}>
            <Image src="/auth-glass.png" alt="" fill style={{ objectFit: 'contain', filter: 'drop-shadow(0 0 80px rgba(0,200,130,0.35))' }} priority onError={() => {}} />
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto', paddingTop: 60 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#22FFAA', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>AI-Powered Experiences</p>
          <h1 style={{ fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 900, color: '#F0F4FF', lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 16px' }}>
            Discover your<br />next mission.
          </h1>
          <p style={{ fontSize: 15, color: '#8B9CC0', lineHeight: 1.65, maxWidth: 340 }}>
            Personalised AI missions that guide you through real-world challenges, adventures, and meaningful impact.
          </p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px, 5vw, 64px) clamp(20px, 6vw, 72px)', position: 'relative' }}>
        <div className="md:hidden" style={{ position: 'absolute', top: '-20%', right: '-20%', width: '70vw', height: '70vw', background: 'radial-gradient(circle, rgba(0,200,130,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 40 }}>
            <Image src="/xhunt-logo.png" alt="X-hunt" width={80} height={80} style={{ objectFit: 'contain' }} priority onError={() => {}} />
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#F0F4FF', letterSpacing: '-0.02em', marginBottom: 4 }}>Welcome back</h2>
          <p style={{ fontSize: 14, color: '#8B9CC0', marginBottom: 32 }}>Sign in to your X-hunt account</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={LABEL_STYLE}>Email</label>
              <input
                type="email" value={email} required
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={INPUT_STYLE}
                autoComplete="email"
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} value={password} required
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...INPUT_STYLE, paddingRight: 44 }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8B9CC0', cursor: 'pointer', padding: 0 }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#FF5C7A', background: 'rgba(255,92,122,0.08)', border: '1px solid rgba(255,92,122,0.2)', borderRadius: 10, padding: '10px 14px', margin: 0 }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: loading ? 'rgba(34,255,170,0.5)' : '#22FFAA',
              color: '#050816', fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(34,255,170,0.3)',
              transition: 'background 0.15s',
            }}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ fontSize: 14, color: '#8B9CC0', textAlign: 'center', marginTop: 24 }}>
            Don't have an account?{' '}
            <Link href="/sign-up" style={{ color: '#22FFAA', fontWeight: 700, textDecoration: 'none' }}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
