import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { SessionProvider } from '@/providers/SessionProvider';
import { LockedFeatureProvider } from '@/providers/LockedFeatureProvider';
import { AppThemeProvider, useAppTheme } from '@/providers/AppThemeProvider';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { theme } = useAppTheme();

  return (
    <NavigationThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <LockedFeatureProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ presentation: 'modal', title: 'Sign in' }} />
          <Stack.Screen name="signup" options={{ presentation: 'modal', title: 'Create account' }} />
          <Stack.Screen name="setup/createaccount" options={{ presentation: 'modal', title: 'Create account' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </LockedFeatureProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <AppThemeProvider>
        <RootNavigator />
      </AppThemeProvider>
    </SessionProvider>
  );
}
