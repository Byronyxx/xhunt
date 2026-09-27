'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { AuthUser, AuthState } from './types';
import { apiMe, apiLogout } from './api';

interface AuthContextValue extends AuthState {
  setUser: (user: AuthUser | null) => void;
  signOut: (opts?: { redirectUrl?: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoaded: false,
  setUser: () => {},
  signOut: async () => {},
  refresh: async () => {},
});

// Idle-timeout thresholds — proactive/UX layer only. The actual security
// boundary is server-side, in src/proxy.ts, which enforces the same
// hunter-vs-tenant-side split independently of this (and can't be bypassed
// by disabling JS, unlike this hook). These numbers should match proxy.ts's
// HUNTER_IDLE_TIMEOUT_MINUTES / ORG_IDLE_TIMEOUT_MINUTES — there's no way
// to share one source of truth between a server-only and a NEXT_PUBLIC_ env
// var, so keep them in sync by hand if either changes.
const HUNTER_IDLE_TIMEOUT_MINUTES = Number(process.env.NEXT_PUBLIC_HUNTER_IDLE_TIMEOUT_MINUTES ?? 30);
const ORG_IDLE_TIMEOUT_MINUTES = Number(process.env.NEXT_PUBLIC_ORG_IDLE_TIMEOUT_MINUTES ?? 45);

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const CHECK_INTERVAL_MS = 30_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // Initialized to null and set inside the effect below (not here) —
  // calling Date.now() in the render-phase ref initializer is an impure
  // call and trips React's purity rule.
  const lastActivityRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const me = await apiMe();
    setUser(me);
  }, []);

  useEffect(() => {
    apiMe().then((me) => {
      setUser(me);
      setIsLoaded(true);
    });
  }, []);

  const signOut = useCallback(async ({ redirectUrl = '/' }: { redirectUrl?: string } = {}) => {
    await apiLogout();
    setUser(null);
    window.location.href = redirectUrl;
  }, []);

  // Proactive client-side idle logout. Pure UX: gives the user a clear
  // "you were signed out due to inactivity" moment instead of silently
  // hitting a 401 on their next click. src/proxy.ts is what actually
  // enforces the timeout server-side; this hook can't substitute for that.
  useEffect(() => {
    if (!user) return;

    // Fresh baseline every time this effect (re-)runs — e.g. on sign-in,
    // or if `user` changes. Safe to call Date.now() here: effects run
    // after render, not during it, so this isn't the impure-during-render
    // case the initializer above had to avoid.
    lastActivityRef.current = Date.now();

    const bumpActivity = () => {
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, bumpActivity, { passive: true })
    );

    const thresholdMinutes =
      user.role === 'participant' ? HUNTER_IDLE_TIMEOUT_MINUTES : ORG_IDLE_TIMEOUT_MINUTES;
    const thresholdMs = thresholdMinutes * 60_000;

    // Checked on an interval (plus visibilitychange) rather than relying on
    // a single long-lived setTimeout: browsers throttle or pause timers in
    // backgrounded tabs, so a lone 30/45-minute setTimeout can fire late —
    // or not at all — after the tab's been backgrounded. Comparing elapsed
    // wall-clock time on each tick sidesteps that.
    const check = () => {
      if (lastActivityRef.current !== null && Date.now() - lastActivityRef.current > thresholdMs) {
        signOut({ redirectUrl: '/sign-in?reason=idle_timeout' });
      }
    };

    const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, bumpActivity));
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', check);
    };
  }, [user, signOut]);

  return (
    <AuthContext.Provider value={{ user, isLoaded, setUser, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
