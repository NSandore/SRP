import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

import NavBar from '@/components/navigation/NavBar';
import DrawerMenu from '@/components/navigation/DrawerMenu';
import { Brand, getBrandColors, useBrandColors } from '@/constants/brand';
import { useAppTheme } from '@/providers/AppThemeProvider';

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme } = useAppTheme();
  const [prevTheme, setPrevTheme] = useState(theme);
  const transition = useSharedValue(1);
  const colors = useBrandColors();
  const prevColors = getBrandColors(prevTheme);

  useEffect(() => {
    if (theme === prevTheme) return;
    transition.value = 0;
    transition.value = withTiming(1, {
      duration: 260,
      easing: Easing.out(Easing.quad),
    }, (finished) => {
      if (finished) runOnJS(setPrevTheme)(theme);
    });
  }, [theme, prevTheme]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: transition.value,
  }));

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.background} pointerEvents="none">
        <View style={[styles.bgLayer, { backgroundColor: prevColors.page }]} />
        <Animated.View style={[styles.bgLayer, { backgroundColor: colors.page }, overlayStyle]} />
      </View>
      <NavBar onMenuPress={() => setDrawerOpen(true)} />
      <DrawerMenu visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
  },
});
