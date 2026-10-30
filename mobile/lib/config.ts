const DEFAULT_NATIVE_API_BASE_URL = 'https://thestudentsphere.com';

const getDefaultApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.origin;
  }

  return DEFAULT_NATIVE_API_BASE_URL;
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? getDefaultApiBaseUrl();

export const API_PATH = '/api';

export const API_URL = `${API_BASE_URL}${API_PATH}`;
