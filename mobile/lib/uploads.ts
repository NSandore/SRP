import { API_BASE_URL } from '@/lib/config';

export const buildUploadSrc = (path?: string | null) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/uploads/')) {
    return `${API_BASE_URL}/api/serve_upload.php?path=${encodeURIComponent(normalized)}`;
  }
  return normalized;
};

export const buildAvatarSrc = (path?: string | null) => {
  if (!path) {
    return buildUploadSrc('/uploads/avatars/DefaultAvatar.png');
  }
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/uploads/')) {
    return buildUploadSrc(path);
  }
  if (path.startsWith('uploads/')) {
    return buildUploadSrc(`/${path}`);
  }
  if (path.startsWith('/')) {
    return buildUploadSrc(path);
  }
  return buildUploadSrc(`/uploads/avatars/${path}`);
};

export const normalizeHtml = (html: string) => {
  if (!html) return '';
  const withUploads = html
    .replace(/src=\"(\/uploads\/[^\"]+)\"/g, (_, p1) => `src=\"${buildUploadSrc(p1)}\"`)
    .replace(/src='(\/uploads\/[^']+)'/g, (_, p1) => `src='${buildUploadSrc(p1)}'`)
    .replace(/href=\"(\/uploads\/[^\"]+)\"/g, (_, p1) => `href=\"${buildUploadSrc(p1)}\"`)
    .replace(/href='(\/uploads\/[^']+)'/g, (_, p1) => `href='${buildUploadSrc(p1)}'`);
  return withUploads.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
};
