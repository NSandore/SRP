const parseColor = (value) => {
  if (!value || typeof value !== 'string') return null;
  let hex = value.trim();
  const rgbMatch = hex.match(/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})/i);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, Number(rgbMatch[1])));
    const g = Math.min(255, Math.max(0, Number(rgbMatch[2])));
    const b = Math.min(255, Math.max(0, Number(rgbMatch[3])));
    return { r, g, b };
  }
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex.split('').map((ch) => ch + ch).join('');
  }
  if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
};

const toHex = ({ r, g, b }) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

export const getAdjustedColor = (value, factor = 0.9) => {
  const rgb = parseColor(value);
  if (!rgb) return null;
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const dr = clamp(Math.round(rgb.r * factor));
  const dg = clamp(Math.round(rgb.g * factor));
  const db = clamp(Math.round(rgb.b * factor));
  return toHex({ r: dr, g: dg, b: db });
};

export const getReadableTextColor = (value) => {
  const rgb = parseColor(value);
  if (!rgb) return null;
  const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
  const contrastWithWhite = (1.05) / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000';
};
