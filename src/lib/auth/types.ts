export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  surface: 'home' | 'workspace' | 'admin';
  onboardingComplete: boolean;
  tenantId: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  isLoaded: boolean;
}
