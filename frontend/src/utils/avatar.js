export const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="%23e2e8f0"/><path d="M32 34c6.6 0 12-5.4 12-12S38.6 10 32 10s-12 5.4-12 12 5.4 12 12 12zm0 6c-9.4 0-22 4.7-22 14v4h44v-4c0-9.3-12.6-14-22-14z" fill="%2394a3b8"/></svg>';

export const buildAvatarSrc = (path) => {
  if (!path) return DEFAULT_AVATAR;
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/uploads/avatars/${path}`;
};
