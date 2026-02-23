import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import LockedFeatureOverlay from '@/components/LockedFeatureOverlay';

type LockedFeatureContextValue = {
  openLockedFeature: (feature?: string) => void;
  closeLockedFeature: () => void;
};

const LockedFeatureContext = createContext<LockedFeatureContextValue | null>(null);

export function LockedFeatureProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [feature, setFeature] = useState('this feature');

  const openLockedFeature = useCallback((label?: string) => {
    setFeature(label?.trim() ? label : 'this feature');
    setVisible(true);
  }, []);

  const closeLockedFeature = useCallback(() => setVisible(false), []);

  const handleLogin = useCallback(() => {
    setVisible(false);
    router.push('/login');
  }, [router]);

  const handleSignUp = useCallback(() => {
    setVisible(false);
    router.push('/setup/createaccount');
  }, [router]);

  const value = useMemo(
    () => ({ openLockedFeature, closeLockedFeature }),
    [openLockedFeature, closeLockedFeature]
  );

  return (
    <LockedFeatureContext.Provider value={value}>
      {children}
      <LockedFeatureOverlay
        visible={visible}
        feature={feature}
        onClose={closeLockedFeature}
        onLogin={handleLogin}
        onSignUp={handleSignUp}
      />
    </LockedFeatureContext.Provider>
  );
}

export function useLockedFeature() {
  const ctx = useContext(LockedFeatureContext);
  if (!ctx) {
    throw new Error('useLockedFeature must be used within LockedFeatureProvider');
  }
  return ctx;
}
