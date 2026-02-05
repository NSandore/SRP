import defaultAvatar from '../assets/DefaultAvatar.png';

const normalizeBase = (value) => (value ? value.replace(/\/$/, '') : '');

const inferAssetBase = () => {
  if (process.env.REACT_APP_ASSET_BASE) {
    return normalizeBase(process.env.REACT_APP_ASSET_BASE);
  }
  if (typeof window === 'undefined') return '';
  const { protocol, hostname, port } = window.location;
  if (port === '3000') {
    return `${protocol}//${hostname}:3001`;
  }
  return window.location.origin;
};

export const DEFAULT_AVATAR = defaultAvatar;

export const buildAvatarSrc = (path) => {
  if (!path) return DEFAULT_AVATAR;
  const raw = String(path);
  if (raw.includes('DefaultAvatar.png')) return DEFAULT_AVATAR;
  if (raw.startsWith('http')) return raw;
  const normalized = raw.startsWith('/') ? raw : `/uploads/avatars/${raw}`;
  const base = inferAssetBase();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!base || base === origin) return normalized;
  return `${base}${normalized}`;
};
