'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

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

  return (
    <AuthContext.Provider value={{ user, isLoaded, setUser, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
