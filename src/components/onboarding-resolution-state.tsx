import type { CSSProperties } from 'react';

type Props = {
  state: 'checking' | 'retry';
  onRetry?: () => void;
};

const SHELL: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--t-bg, #050816)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

export default function OnboardingResolutionState({ state, onRetry }: Props) {
  if (state === 'retry') {
    return (
      <div style={SHELL}>
        <div role="alert" style={{ textAlign: 'center', maxWidth: 320 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--text, #F0F4FF)' }}>
            {"We couldn't verify your account."}
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted, #8B9CC0)' }}>
            Please check your connection and try again.
          </p>
          <button
            type="button"
            onClick={onRetry}
            style={{
              height: 42,
              padding: '0 24px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--accent, #22FFAA)',
              color: '#050816',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={SHELL}>
      <style>{`@keyframes xh-onboarding-spin { to { transform: rotate(360deg); } }`}</style>
      <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            width: 20,
            height: 20,
            border: '2px solid var(--text-muted, #4A5578)',
            borderTopColor: 'var(--accent, #22FFAA)',
            borderRadius: '50%',
            animation: 'xh-onboarding-spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: 14, color: 'var(--text-muted, #8B9CC0)' }}>Checking your account...</span>
      </div>
    </div>
  );
}
