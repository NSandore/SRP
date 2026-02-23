import { useMemo } from 'react';

import { useAppTheme } from '@/providers/AppThemeProvider';

export const Brand = {
  colors: {
    light: {
      primaryFrom: '#2563EB',
      primaryTo: '#60A5FA',
      page: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      subtext: '#64748B',
      border: '#E2E8F0',
      hover: '#EEF2FF',
      navText: '#FFFFFF',
      danger: '#EF4444',
    },
    dark: {
      primaryFrom: '#3B82F6',
      primaryTo: '#60A5FA',
      page: '#0F172A',
      card: '#1E293B',
      text: '#E2E8F0',
      subtext: '#94A3B8',
      border: '#334155',
      hover: '#1F2937',
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
