import { useMemo } from 'react';

import { useAppTheme } from '@/providers/AppThemeProvider';

export const Brand = {
  colors: {
    light: {
      primaryFrom: '#2F80ED',
      primaryTo: '#9BC5F6',
      page: '#F8FBFF',
      card: '#FFFFFF',
      text: '#11244D',
      subtext: '#667895',
      border: '#DCE7F5',
      hover: '#EDF5FF',
      navText: '#FFFFFF',
      danger: '#EF4444',
    },
    dark: {
      primaryFrom: '#4B91EC',
      primaryTo: '#8EC0FF',
      page: '#08152B',
      card: '#10213D',
      text: '#EAF2FF',
      subtext: '#A8B9D3',
      border: '#2A4163',
      hover: '#162B4B',
      navText: '#FFFFFF',
      danger: '#F87171',
    },
  },
  radius: {
    card: 16,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
};

export type BrandColors = typeof Brand.colors.light;

export function getBrandColors(theme: 'light' | 'dark') {
  return theme === 'dark' ? Brand.colors.dark : Brand.colors.light;
}

export function useBrandColors() {
  const { theme } = useAppTheme();
  return useMemo(() => getBrandColors(theme), [theme]);
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
