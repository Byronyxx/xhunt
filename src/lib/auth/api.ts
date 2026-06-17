import type { AuthUser } from './types';

const BACKEND = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:8000';

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

export async function apiLogin(payload: LoginPayload): Promise<AuthUser> {
  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail ?? 'Login failed');
  }
  const data: AuthResponse = await res.json();
  return mapUser(data.user);
}

export async function apiRegister(payload: RegisterPayload): Promise<AuthUser> {
  const res = await fetch(`${BACKEND}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail ?? 'Registration failed');
  }
  const data: AuthResponse = await res.json();
  return mapUser(data.user);
}

export async function apiMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BACKEND}/auth/me`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return mapUser(data);
  } catch {
    return null;
  }
}

export async function apiLogout(): Promise<void> {
  await fetch(`${BACKEND}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});
}

export async function apiUpdateProfile(updates: {
  display_name?: string;
  avatar_url?: string;
  default_surface?: string;
}): Promise<AuthUser> {
  const res = await fetch(`${BACKEND}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  const data = await res.json();
  return mapUser(data);
}
