import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { loadStoredTheme, saveStoredTheme } from '@/lib/storage';

export type AppTheme = 'light' | 'dark';

type AppThemeContextValue = {
  theme: AppTheme;
  isLoading: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadStoredTheme()
      .then((stored) => {
        if (!mounted) return;
        if (stored) {
          setThemeState(stored);
        }
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    saveStoredTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      saveStoredTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, isLoading, setTheme, toggleTheme }),
    [theme, isLoading, setTheme, toggleTheme]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    return {
      theme: 'light' as AppTheme,
      isLoading: false,
      setTheme: () => undefined,
      toggleTheme: () => undefined,
    };
  }
  return ctx;
}
