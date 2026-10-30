const normalizeBase = (value) => (value || '').replace(/\/$/, '');
const envBase = normalizeBase(process.env.REACT_APP_API_BASE);
const originBase = typeof window !== 'undefined' ? normalizeBase(window.location.origin) : '';
const API_BASE = process.env.NODE_ENV === 'development'
  ? originBase
  : (envBase || originBase);

export const getApiBase = () => API_BASE;

export const buildApiUrl = (path = '') => `${API_BASE}${path}`;

export default API_BASE;
