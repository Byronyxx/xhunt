'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { readOnboardingMarker, writeOnboardingMarker } from '@/lib/store';
import { resolveOnboarding } from '@/lib/onboarding/resolver';
import type {
  FetchProfileResult,
  GetUserResult,
  OnboardingDecision,
  ResolverDeps,
} from '@/lib/onboarding/resolver';

// auth-js getUser() takes no AbortSignal; the resolver races it against abort/timeout.
async function getUser(): Promise<GetUserResult> {
  try {
    const { data, error } = await createClient().auth.getUser();
    if (error) {
      if (isAuthSessionMissingError(error)) return { status: 'signed-out' };
      const status = (error as { status?: unknown }).status;
      if (status === 401 || status === 403) return { status: 'signed-out' };
      return { status: 'error' };
    }
    const id = data.user?.id;
    if (typeof id === 'string' && id.length > 0) return { status: 'signed-in', user: { id } };
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

async function fetchProfile(userId: string, signal: AbortSignal): Promise<FetchProfileResult> {
  try {
    const { data, error } = await createClient()
      .from('user_profiles')
      .select('onboarding_complete')
      .eq('id', userId)
      .abortSignal(signal)
      .maybeSingle();
    if (error) return error.code === 'PGRST116' ? { status: 'missing' } : { status: 'error' };
    if (!data) return { status: 'missing' };
    const row = data as { onboarding_complete?: unknown };
    return row.onboarding_complete === true ? { status: 'complete' } : { status: 'incomplete' };
  } catch {
    return { status: 'error' };
  }
}

const realDeps: ResolverDeps = {
  getUser,
  fetchProfile,
  readMarker: readOnboardingMarker,
  writeMarker: writeOnboardingMarker,
};

type Resolved = { decision: OnboardingDecision; userId: string | null };

export type OnboardingResolution = {
  decision: OnboardingDecision;
  userId: string | null;
  retry: () => void;
};

export function useOnboardingResolution(): OnboardingResolution {
  const [result, setResult] = useState<Resolved>({ decision: 'checking', userId: null });
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback((showChecking: boolean) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    generationRef.current += 1;
    const generation = generationRef.current;
    if (showChecking) setResult({ decision: 'checking', userId: null });
    const isCurrent = () => generationRef.current === generation && !controller.signal.aborted;
    void resolveOnboarding(realDeps, { signal: controller.signal, isCurrent }).then((r) => {
      if (isCurrent()) setResult(r);
    });
  }, []);

  useEffect(() => {
    run(false);
    // undefined = no auth event seen yet; the first event only records the id.
    let knownId: string | null | undefined;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      const nextId = session?.user?.id ?? null;
      if (knownId === undefined) {
        knownId = nextId;
        return;
      }
      if (nextId === knownId) return; // e.g. TOKEN_REFRESHED for the same user
      knownId = nextId;
      if (pending !== null) clearTimeout(pending);
      // Deferred: never call Supabase from inside the auth callback.
      pending = setTimeout(() => {
        pending = null;
        run(true);
      }, 0);
    });
    return () => {
      data.subscription.unsubscribe();
      if (pending !== null) clearTimeout(pending);
      generationRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [run]);

  const retry = useCallback(() => run(true), [run]);
  return { decision: result.decision, userId: result.userId, retry };
}
