import type { AuthUser } from './types';

interface LoginPayload { email: string; password: string }
interface RegisterPayload { email: string; password: string; display_name?: string }

interface AuthResponse {
  token: { access_token: string; expires_in: number };
  user: {
    id: string; email: string; display_name: string | null;
    avatar_url: string | null; role: string; default_surface: string;
    onboarding_complete: boolean; tenant_id: string | null;
  };
}

function mapUser(u: AuthResponse['user']): AuthUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    role: u.role,
    surface: (u.default_surface as AuthUser['surface']) ?? 'home',
    onboardingComplete: u.onboarding_complete,
    tenantId: u.tenant_id,
  };
}

// All calls go through Next.js API routes (/api/auth/*) so cookies
// are set on the same origin — no cross-domain cookie issues.

export async function apiLogin(payload: LoginPayload): Promise<AuthUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail ?? 'Login failed');
  }
  const data: AuthResponse = await res.json();
  return mapUser(data.user);
}

export async function apiRegister(payload: RegisterPayload): Promise<AuthUser | { pendingConfirmation: true; email: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail ?? 'Registration failed');
  }
  const data = await res.json();
  if ('pendingConfirmation' in data) {
    return { pendingConfirmation: true as const, email: data.email as string };
  }
  return mapUser((data as AuthResponse).user);
}

export async function apiMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return mapUser(data);
  } catch {
    return null;
  }
}

/**
 * Like apiMe, but tells a definite "signed out" (HTTP 401) apart from
 * "unknown" (network error, aborted request, 5xx, 404), so callers never
 * treat a dropped request as a sign-out.
 */
export async function apiMeWithStatus(): Promise<
  { status: 'signed-in'; user: AuthUser } | { status: 'signed-out' } | { status: 'unknown' }
> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (res.status === 401) return { status: 'signed-out' };
    if (!res.ok) return { status: 'unknown' };
    const data = await res.json();
    return { status: 'signed-in', user: mapUser(data) };
  } catch {
    return { status: 'unknown' };
  }
}

export async function apiLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

export async function apiUpdateProfile(updates: {
  display_name?: string;
  avatar_url?: string;
  default_surface?: string;
}): Promise<AuthUser> {
  const res = await fetch('/api/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  const data = await res.json();
  return mapUser(data);
}
