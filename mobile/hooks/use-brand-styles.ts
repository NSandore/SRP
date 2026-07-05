import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { BrandColors } from '@/constants/brand';
import { useBrandColors } from '@/constants/brand';

export function useBrandStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: BrandColors) => T
) {
  const colors = useBrandColors();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
