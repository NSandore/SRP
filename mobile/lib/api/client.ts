import axios from 'axios/dist/esm/axios.js';

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
      config.headers = {
        ...(config.headers || {}),
        'X-Session-Id': sessionId,
      };
      config.params = {
        ...(config.params || {}),
        session_id: sessionId,
      };
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
