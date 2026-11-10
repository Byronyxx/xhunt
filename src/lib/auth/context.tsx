'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { AuthUser, AuthState } from './types';
import { apiMeWithStatus, apiLogout } from './api';
import {
  BIND_RELOAD_FLAG,
  OWNER_KEY,
  bindLocalDataToUser,
  hasActiveLocalData,
  releaseLocalDataOnSignOut,
} from '@/lib/local-ownership';

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

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2147483647,
  background: 'var(--t-bg, #050816)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: 24,
  textAlign: 'center',
  color: 'inherit',
};

function ownerKeyExists(): boolean {
  try {
    return window.localStorage.getItem(OWNER_KEY) !== null;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [covered, setCovered] = useState(false); // false on the server
  const [blocked, setBlocked] = useState(false);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Before first paint on the client: hide the page if saved progress is present,
  // until we know whose it is.
  useLayoutEffect(() => {
    if (hasActiveLocalData()) setCovered(true);
  }, []);

  type MeResult = Awaited<ReturnType<typeof apiMeWithStatus>>;

  const settle = useCallback((result: MeResult) => {
    if (result.status === 'signed-in') {
      const me = result.user;
      const bound = bindLocalDataToUser(me.id);
      if (bound === 'failed') {
        setUser(me);
        setIsLoaded(true);
        setBlocked(true);
        setCovered(true);
        return;
      }
      if (bound === 'switched') {
        let flag: string | null = null;
        try {
          flag = window.sessionStorage.getItem(BIND_RELOAD_FLAG);
        } catch {
          /* ignore */
        }
        if (flag !== me.id) {
          try {
            window.sessionStorage.setItem(BIND_RELOAD_FLAG, me.id);
          } catch {
            /* ignore: after the reload bind() returns 'unchanged', so no loop */
          }
          window.location.reload(); // pages loaded the old data; keep the cover up
          return;
        }
      }
      try {
        window.sessionStorage.removeItem(BIND_RELOAD_FLAG);
      } catch {
        /* ignore */
      }
      setUser(me);
      setIsLoaded(true);
      setBlocked(false);
      setCovered(false);
      return;
    }
    // Only a definite 401 means the session is gone. A dropped or failed
    // request ('unknown') leaves the saved progress where it is.
    if (result.status === 'signed-out' && ownerKeyExists()) releaseLocalDataOnSignOut(null);
    setUser(null);
    setIsLoaded(true);
    setBlocked(false);
    setCovered(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiMeWithStatus();
      if (!cancelled) settle(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [settle]);

  const refresh = useCallback(async () => {
    settle(await apiMeWithStatus());
  }, [settle]);

  const signOut = useCallback(
    async ({ redirectUrl = '/' }: { redirectUrl?: string } = {}) => {
      await apiLogout(); // swallows errors
      releaseLocalDataOnSignOut(userRef.current?.id ?? null);
      try {
        window.sessionStorage.removeItem(BIND_RELOAD_FLAG);
      } catch {
        /* ignore */
      }
      setUser(null);
      window.location.href = redirectUrl;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoaded, setUser, signOut, refresh }),
    [user, isLoaded, signOut, refresh],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {blocked ? (
        <div data-testid="local-data-cover" aria-busy={false} role="alert" style={overlayStyle}>
          <p>We couldn&apos;t separate saved progress on this device.</p>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : covered ? (
        <div data-testid="local-data-cover" aria-busy="true" style={overlayStyle} />
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
