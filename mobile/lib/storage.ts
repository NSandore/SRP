import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { SessionUser } from '@/lib/api/types';

const USER_KEY = 'srp_session_user_v1';
const SESSION_ID_KEY = 'srp_session_id_v1';
const THEME_KEY = 'srp_theme_preference_v1';
const SETTINGS_KEY = 'srp_account_settings_v1';
const DEFAULT_FEED_KEY = 'srp_default_feed_v1';

const isWeb = Platform.OS === 'web';

async function readWeb(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeWeb(key: string, value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage failures on web
  }
}

async function isSecureStoreAvailable() {
  if (isWeb) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function loadStoredUser(): Promise<SessionUser | null> {
  const useSecureStore = await isSecureStoreAvailable();
  const raw = useSecureStore ? await SecureStore.getItemAsync(USER_KEY) : await readWeb(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function saveStoredUser(user: SessionUser) {
  const payload = JSON.stringify(user);
  const useSecureStore = await isSecureStoreAvailable();
  if (useSecureStore) {
    await SecureStore.setItemAsync(USER_KEY, payload);
  } else {
    await writeWeb(USER_KEY, payload);
  }
}

export async function clearStoredUser() {
  const useSecureStore = await isSecureStoreAvailable();
  if (useSecureStore) {
    await SecureStore.deleteItemAsync(USER_KEY);
  } else {
    await writeWeb(USER_KEY, null);
  }
}

export async function loadStoredSessionId(): Promise<string | null> {
  const useSecureStore = await isSecureStoreAvailable();
  const raw = useSecureStore ? await SecureStore.getItemAsync(SESSION_ID_KEY) : await readWeb(SESSION_ID_KEY);
  return raw || null;
}

export async function saveStoredSessionId(sessionId: string) {
  const useSecureStore = await isSecureStoreAvailable();
  if (useSecureStore) {
    await SecureStore.setItemAsync(SESSION_ID_KEY, sessionId);
  } else {
    await writeWeb(SESSION_ID_KEY, sessionId);
  }
}

export async function clearStoredSessionId() {
  const useSecureStore = await isSecureStoreAvailable();
  if (useSecureStore) {
    await SecureStore.deleteItemAsync(SESSION_ID_KEY);
  } else {
    await writeWeb(SESSION_ID_KEY, null);
  }
}

export async function loadStoredTheme(): Promise<'light' | 'dark' | null> {
  const useSecureStore = await isSecureStoreAvailable();
  const raw = useSecureStore ? await SecureStore.getItemAsync(THEME_KEY) : await readWeb(THEME_KEY);
  if (raw === 'light' || raw === 'dark') return raw;
  return null;
}

export async function saveStoredTheme(theme: 'light' | 'dark') {
  const useSecureStore = await isSecureStoreAvailable();
  if (useSecureStore) {
    await SecureStore.setItemAsync(THEME_KEY, theme);
  } else {
    await writeWeb(THEME_KEY, theme);
  }
}

export async function loadStoredAccountSettings(): Promise<Record<string, unknown> | null> {
  const useSecureStore = await isSecureStoreAvailable();
  const raw = useSecureStore ? await SecureStore.getItemAsync(SETTINGS_KEY) : await readWeb(SETTINGS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function saveStoredAccountSettings(settings: Record<string, unknown>) {
  const payload = JSON.stringify(settings);
  const useSecureStore = await isSecureStoreAvailable();
  if (useSecureStore) {
    await SecureStore.setItemAsync(SETTINGS_KEY, payload);
  } else {
    await writeWeb(SETTINGS_KEY, payload);
  }
}

export async function loadStoredDefaultFeed(): Promise<string | null> {
  const useSecureStore = await isSecureStoreAvailable();
  const raw = useSecureStore ? await SecureStore.getItemAsync(DEFAULT_FEED_KEY) : await readWeb(DEFAULT_FEED_KEY);
  return raw || null;
}

export async function saveStoredDefaultFeed(value: string) {
  const useSecureStore = await isSecureStoreAvailable();
  if (useSecureStore) {
    await SecureStore.setItemAsync(DEFAULT_FEED_KEY, value);
  } else {
    await writeWeb(DEFAULT_FEED_KEY, value);
  }
}
