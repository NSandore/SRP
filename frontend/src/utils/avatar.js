export const DEFAULT_AVATAR = '/uploads/avatars/DefaultAvatar.png';

export const buildAvatarSrc = (path) => {
  if (!path) return DEFAULT_AVATAR;
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/uploads/avatars/${path}`;
};
