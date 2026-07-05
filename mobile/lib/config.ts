const DEFAULT_NATIVE_API_BASE_URL = 'http://10.0.0.251:3001';

const getDefaultApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return DEFAULT_NATIVE_API_BASE_URL;
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? getDefaultApiBaseUrl();

export const API_PATH = '/api';

export const API_URL = `${API_BASE_URL}${API_PATH}`;
