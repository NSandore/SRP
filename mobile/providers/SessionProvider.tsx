import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { SessionUser } from '@/lib/api/types';
import { loginWithPassword, logout, verifyTwoFactor } from '@/lib/api/session';
import {
  clearStoredSessionId,
  clearStoredUser,
  loadStoredSessionId,
  loadStoredUser,
  saveStoredSessionId,
  saveStoredUser,
} from '@/lib/storage';

export type LoginResult = {
  success: boolean;
  requiresTwoFactor?: boolean;
  message?: string;
  error?: string;
};

type SessionContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactor: (code: string, rememberDevice: boolean) => Promise<LoginResult>;
  setSession: (nextUser: SessionUser, sessionId?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    loadStoredUser()
      .then((stored) => {
        if (!isMounted) return;
        setUser(stored);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await loginWithPassword(email, password);
    if (response.requires_two_factor) {
      if (response.session_id) {
        await saveStoredSessionId(response.session_id);
      }
      return {
        success: false,
        requiresTwoFactor: true,
        message: response.message || 'Verification code required.',
      };
    }
    if (response.success && response.user) {
      setUser(response.user);
      await saveStoredUser(response.user);
      if (response.session_id) {
        await saveStoredSessionId(response.session_id);
      }
      return { success: true };
    }
    return { success: false, error: response.error || 'Login failed.' };
  }, []);

  const verifyTwoFactorCode = useCallback(async (code: string, rememberDevice: boolean) => {
    const response = await verifyTwoFactor(code, rememberDevice);
    if (response.success && response.user) {
      setUser(response.user);
      await saveStoredUser(response.user);
      if (response.session_id) {
        await saveStoredSessionId(response.session_id);
      }
      return { success: true };
    }
    return { success: false, error: response.error || 'Verification failed.' };
  }, []);

  const setSession = useCallback(async (nextUser: SessionUser, sessionId?: string) => {
    setUser(nextUser);
    await saveStoredUser(nextUser);
    if (sessionId) {
      await saveStoredSessionId(sessionId);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Clear local session state even if the backend logout request fails.
    }
    setUser(null);
    await clearStoredUser();
    await clearStoredSessionId();
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      signIn,
      verifyTwoFactor: verifyTwoFactorCode,
      setSession,
      signOut,
    }),
    [user, isLoading, signIn, verifyTwoFactorCode, setSession, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
