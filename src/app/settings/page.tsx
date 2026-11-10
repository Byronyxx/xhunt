'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import ThemeToggle from '@/components/ThemeToggle';
import { t } from '@/theme/colors';

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
  padding: 16,
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.25)',
};

const headingStyle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 14,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--t-dim, #94A3B8)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 0',
  fontSize: 15,
};

const linkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 44,
  color: 'var(--t-text, #F1F5F9)',
  textDecoration: 'none',
  fontSize: 15,
};

export default function SettingsPage() {
  const { user, isLoaded, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--t-bg, #050816)',
    color: 'var(--t-text, #F1F5F9)',
    padding: '16px 16px 120px',
  };
  const innerStyle: React.CSSProperties = { maxWidth: 560, margin: '0 auto' };

  if (!isLoaded) {
    return (
      <main style={pageStyle}>
        <div style={innerStyle}>
          <p style={{ color: 'var(--t-dim, #94A3B8)' }}>Loading...</p>
        </div>
      </main>
    );
  }

  const fullName = user?.displayName?.trim() || 'Not set';

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: '/' });
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={innerStyle}>
        <Link
          href="/profile"
          style={{ ...linkStyle, color: 'var(--t-dim, #94A3B8)', display: 'inline-flex' }}
        >
          ← Back to profile
        </Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700 }}>Settings</h1>

        <section style={sectionStyle} aria-labelledby="settings-account">
          <h2 id="settings-account" style={headingStyle}>Account</h2>
          <div style={rowStyle}>
            <span style={{ color: 'var(--t-dim, #94A3B8)' }}>Name</span>
            <span data-testid="settings-name">{fullName}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--t-dim, #94A3B8)' }}>Email</span>
            <span data-testid="settings-email" style={{ wordBreak: 'break-all', textAlign: 'right' }}>
              {user?.email ?? 'Not available'}
            </span>
          </div>
        </section>

        <section style={sectionStyle} aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" style={headingStyle}>Appearance</h2>
          <ThemeToggle />
        </section>

        <section style={sectionStyle} aria-labelledby="settings-legal">
          <h2 id="settings-legal" style={headingStyle}>Legal</h2>
          <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>
          <Link href="/terms" style={linkStyle}>Terms of Service</Link>
        </section>

        <button
          type="button"
          data-testid="settings-sign-out"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            marginTop: 24,
            width: '100%',
            minHeight: 44,
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(248,113,113,0.5)',
            background: 'transparent',
            color: t.error,
            fontSize: 16,
            fontWeight: 600,
            cursor: signingOut ? 'not-allowed' : 'pointer',
            opacity: signingOut ? 0.6 : 1,
          }}
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </main>
  );
}
