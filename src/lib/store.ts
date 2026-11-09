import type { AppState, ImpactProfile, UserProfile } from './types';

const STORAGE_KEY = 'xhunt_v1';

// UserProfile (types.ts) is not edited; the owner tag is added locally.
export type StoredUser = UserProfile & { onboardingUserId?: string };
export type OnboardingMarker = { ownerId: string | null; complete: boolean };

export const initialState: AppState = {
  user: null,
  hunts: [],
  progress: {},
  completedHunts: [],
  streak: 0,
};

export function loadState(): AppState {
  if (typeof window === 'undefined') return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

function readStoredUser(): StoredUser | null {
  const user: unknown = loadState().user;
  if (typeof user !== 'object' || user === null || Array.isArray(user)) return null;
  return user as StoredUser;
}

// UX hint only. It never grants access or a role; proxy + RLS stay the authority.
export function readOnboardingMarker(): OnboardingMarker | null {
  const user = readStoredUser();
  if (!user) return null;
  const owner: unknown = user.onboardingUserId;
  return {
    ownerId: typeof owner === 'string' && owner.length > 0 ? owner : null,
    complete: user.onboardingComplete === true,
  };
}

export function writeOnboardingMarker(userId: string): void {
  if (typeof userId !== 'string' || userId.length === 0) return;
  const state = loadState();
  const existing = readStoredUser();
  const next: StoredUser = existing
    ? {
        ...existing,
        interests: Array.isArray(existing.interests) ? existing.interests : [],
        goals: Array.isArray(existing.goals) ? existing.goals : [],
        onboardingComplete: true,
        onboardingUserId: userId,
      }
    : { interests: [], goals: [], onboardingComplete: true, onboardingUserId: userId };
  saveState({ ...state, user: next });
}

const PROFILE_KEY = 'xhunt_impact_v1';

export function loadProfile(): ImpactProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ImpactProfile) : null;
  } catch { return null; }
}

export function saveProfile(p: ImpactProfile): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}

export function clearProfile(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PROFILE_KEY);
}
