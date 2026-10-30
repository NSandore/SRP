import axios from 'axios';

import { API_URL } from '@/lib/config';
import { loadStoredSessionId } from '@/lib/storage';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const sessionId = await loadStoredSessionId();
    if (sessionId) {
      config.headers.set('X-Session-Id', sessionId);
    }
  } catch {
    // ignore storage errors
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);
