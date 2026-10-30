import { useAppTheme } from '@/providers/AppThemeProvider';

export function useColorScheme() {
  const { theme } = useAppTheme();
  return theme;
}
