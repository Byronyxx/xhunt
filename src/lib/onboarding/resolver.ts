// Pure decision logic plus a dependency-injected async resolver.
// No runtime imports: this file must stay loadable by Node's type stripping.
// The local marker is a UX hint only. It never grants access or a role (proxy + RLS stay the authority).
export type ProfileStatus = 'complete' | 'incomplete' | 'missing' | 'error' | 'pending';
export type AuthStatus = 'signed-in' | 'signed-out' | 'error' | 'pending';
export type OnboardingDecisionInput = {
  auth: AuthStatus;
  userId: string | null;
  markerOwnerId: string | null;
  markerComplete: boolean;
  profileStatus: ProfileStatus;
};
export type OnboardingDecision =
  | 'render'
  | 'redirect-sign-in'
  | 'redirect-onboarding'
  | 'checking'
  | 'retry';

export function decideOnboarding(input: OnboardingDecisionInput): OnboardingDecision {
  if (input.auth === 'signed-out') return 'redirect-sign-in';
  if (input.auth === 'error') return 'retry';
  if (input.auth === 'pending') return 'checking';
  // Signed in but no usable id: cannot verify anything, never redirect.
  if (!input.userId) return 'retry';
  // Only a marker owned by this exact user and marked complete is trusted.
  // Unowned (legacy) and wrong-owner markers fall through to the database.
  const markerTrusted =
    input.markerComplete && input.markerOwnerId !== null && input.markerOwnerId === input.userId;
  if (markerTrusted) return 'render';
  switch (input.profileStatus) {
    case 'complete':
      return 'render';
    case 'incomplete':
    case 'missing':
      return 'redirect-onboarding';
    case 'error':
      return 'retry';
    default:
      return 'checking';
  }
}

// Shared by /home, /missions and /profile so the mapping lives in one place.
export function redirectPathFor(decision: OnboardingDecision): '/get-started' | '/sign-in' | null {
  if (decision === 'redirect-onboarding') return '/get-started';
  if (decision === 'redirect-sign-in') return '/sign-in';
  return null;
}

export type GetUserResult =
  | { status: 'signed-in'; user: { id: string } }
  | { status: 'signed-out' }
  | { status: 'error' };
export type FetchProfileResult = { status: 'complete' | 'incomplete' | 'missing' | 'error' };
export type MarkerSnapshot = { ownerId: string | null; complete: boolean } | null;
export type ResolverDeps = {
  getUser: (signal: AbortSignal) => Promise<GetUserResult>;
  fetchProfile: (userId: string, signal: AbortSignal) => Promise<FetchProfileResult>;
  readMarker: () => MarkerSnapshot;
  writeMarker: (ownerId: string) => void;
  timeoutMs?: number;
};
export type ResolveOptions = {
  signal?: AbortSignal;
  isCurrent?: () => boolean;
};
export type ResolveResult = { decision: OnboardingDecision; userId: string | null };

const DEFAULT_TIMEOUT_MS = 10000;
const ABORTED = Symbol('aborted');

export async function resolveOnboarding(
  deps: ResolverDeps,
  opts: ResolveOptions = {},
): Promise<ResolveResult> {
  const timeoutMs =
    typeof deps.timeoutMs === 'number' && deps.timeoutMs > 0 ? deps.timeoutMs : DEFAULT_TIMEOUT_MS;
  const retryResult: ResolveResult = { decision: 'retry', userId: null };
  const controller = new AbortController();
  const external = opts.signal;
  const forwardAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', forwardAbort, { once: true });
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const aborted = new Promise<typeof ABORTED>((resolve) => {
    if (controller.signal.aborted) resolve(ABORTED);
    else controller.signal.addEventListener('abort', () => resolve(ABORTED), { once: true });
  });

  function isLive(): boolean {
    if (timedOut || controller.signal.aborted) return false;
    if (opts.isCurrent) {
      try {
        if (!opts.isCurrent()) return false;
      } catch {
        return false;
      }
    }
    return true;
  }

  // Runs a dependency call: sync throws and rejections become `fallback`;
  // the race against abort means a dependency that ignores the signal cannot hang us.
  function guarded<T>(fn: () => Promise<T>, fallback: T): Promise<T | typeof ABORTED> {
    const call = (async () => fn())().catch(() => fallback);
    return Promise.race([call, aborted]);
  }

  try {
    const auth = await guarded<GetUserResult>(() => deps.getUser(controller.signal), {
      status: 'error',
    });
    if (auth === ABORTED || !isLive()) return retryResult;
    if (auth.status === 'signed-out') {
      return {
        decision: decideOnboarding({
          auth: 'signed-out',
          userId: null,
          markerOwnerId: null,
          markerComplete: false,
          profileStatus: 'pending',
        }),
        userId: null,
      };
    }
    const userId =
      auth.status === 'signed-in' && typeof auth.user?.id === 'string' ? auth.user.id : '';
    if (auth.status !== 'signed-in' || userId.length === 0) {
      return { decision: 'retry', userId: null };
    }
    let marker: MarkerSnapshot = null;
    try {
      marker = deps.readMarker();
    } catch {
      marker = null;
    }
    const base = {
      auth: 'signed-in' as const,
      userId,
      markerOwnerId: marker?.ownerId ?? null,
      markerComplete: marker?.complete ?? false,
    };
    // A trusted marker (owned by this user, complete) skips the profile query.
    const first = decideOnboarding({ ...base, profileStatus: 'pending' });
    if (first !== 'checking') return { decision: first, userId };
    const prof = await guarded<FetchProfileResult>(
      () => deps.fetchProfile(userId, controller.signal),
      { status: 'error' },
    );
    if (prof === ABORTED || !isLive()) return retryResult;
    const raw = prof?.status;
    const profileStatus: ProfileStatus =
      raw === 'complete' || raw === 'incomplete' || raw === 'missing' ? raw : 'error';
    const decision = decideOnboarding({ ...base, profileStatus });
    // Marker is written only when the database confirmed completion and this run is still live.
    if (decision === 'render' && profileStatus === 'complete') {
      if (!isLive()) return retryResult;
      try {
        deps.writeMarker(userId);
      } catch {
        // A failed local write must not block a database-confirmed user.
      }
    }
    return { decision, userId };
  } finally {
    clearTimeout(timer);
    if (external) external.removeEventListener('abort', forwardAbort);
  }
}
