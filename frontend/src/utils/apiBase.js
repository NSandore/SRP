const API_BASE = (process.env.REACT_APP_API_BASE || window.location.origin || '').replace(/\/$/, '');

export const getApiBase = () => API_BASE;

export const buildApiUrl = (path = '') => `${API_BASE}${path}`;

export default API_BASE;
