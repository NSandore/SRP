import { getApiBase } from './apiBase';

export const buildUploadSrc = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/uploads/')) {
    const base = getApiBase() || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}/api/serve_upload.php?path=${encodeURIComponent(path)}`;
  }
  return path;
};

export default buildUploadSrc;
