export const getApiBase = () => {
  const explicit = process.env.REACT_APP_API_BASE;
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  if (typeof window === 'undefined') {
    return '';
  }
  const { protocol, hostname } = window.location;
  const port = process.env.NODE_ENV === 'production' ? '3001' : '3000';
  return `${protocol}//${hostname}:${port}`;
};
