export const IMAGE_LAYOUTS = Object.freeze({
  BANNER: 'banner',
  RIGHT: 'right',
  FULL: 'full',
});

export const normalizeImageLayout = (value, fallback = IMAGE_LAYOUTS.BANNER) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'left') return IMAGE_LAYOUTS.RIGHT;
  return Object.values(IMAGE_LAYOUTS).includes(normalized) ? normalized : fallback;
};
