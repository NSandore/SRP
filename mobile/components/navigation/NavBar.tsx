import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { useAppTheme } from '@/providers/AppThemeProvider';
import { buildAvatarSrc } from '@/lib/uploads';
import { useBrandStyles } from '@/hooks/use-brand-styles';

export type NavBarProps = {
  onMenuPress: () => void;
};

export default function NavBar({ onMenuPress }: NavBarProps) {
  const router = useRouter();
  const { user, signOut } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const { theme, toggleTheme } = useAppTheme();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isSearchOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      if (isSearchOpen) {
        inputRef.current?.focus();
      }
    });
  }, [isSearchOpen, progress]);

  useEffect(() => {
    if (!user && isAccountMenuOpen) {
      setIsAccountMenuOpen(false);
    }
  }, [user, isAccountMenuOpen]);


  const searchWidth = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 220],
      }),
    [progress]
  );

  const brandOpacity = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
    [progress]
  );


  const handleSearch = () => {
    if (!query.trim()) return;
    router.push({ pathname: '/search', params: { q: query.trim() } });
    setIsSearchOpen(false);
  };

  const closeAccountMenu = () => setIsAccountMenuOpen(false);

  const handleAccountSettings = () => {
    closeAccountMenu();
    router.push('/settings');
  };

  const handleLogout = async () => {
    closeAccountMenu();
    await signOut();
    router.replace('/feed');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <View>
      <LinearGradient
        colors={[colors.primaryFrom, colors.primaryTo]}
        style={[styles.navBar, { paddingTop: Brand.spacing.md + insets.top, minHeight: 64 + insets.top }]}
      >
        <Pressable onPress={onMenuPress} style={styles.iconButton} accessibilityLabel="Open menu">
          <MaterialCommunityIcons name="menu" size={22} color={colors.navText} />
        </Pressable>

        <Pressable
          style={styles.brand}
          onPress={() => router.push('/feed')}
          accessibilityLabel="Go to home"
        >
          <Animated.View style={{ opacity: brandOpacity }}>
            <ThemedText style={styles.brandText}>StudentSphere</ThemedText>
          </Animated.View>
        </Pressable>

        <View style={styles.actions}>
          <Animated.View style={[styles.searchInline, { width: searchWidth, opacity: progress }]}>
            <View style={styles.searchInlineInner}>
              <MaterialCommunityIcons name="magnify" size={16} color={colors.subtext} />
              <TextInput
                ref={inputRef}
                placeholder="Search"
                placeholderTextColor={colors.subtext}
                style={styles.searchInlineInput}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              <Pressable onPress={() => setIsSearchOpen(false)} style={styles.searchInlineClose}>
                <MaterialCommunityIcons name="close" size={16} color={colors.subtext} />
              </Pressable>
            </View>
          </Animated.View>
          <Pressable
            onPress={() => setIsSearchOpen((prev) => !prev)}
            style={styles.iconButton}
            accessibilityLabel="Search"
          >
            <MaterialCommunityIcons name="magnify" size={20} color={colors.navText} />
          </Pressable>
          <Pressable
            onPress={() => {
              if (!user) {
                openLockedFeature('Messaging');
                return;
              }
              router.push('/messages');
            }}
            style={styles.iconButton}
            accessibilityLabel="Messages"
          >
            <MaterialCommunityIcons name="email-outline" size={20} color={colors.navText} />
          </Pressable>
          <Pressable
            onPress={() => {
              if (!user) {
                openLockedFeature('Notifications');
                return;
              }
              router.push('/notifications');
            }}
            style={styles.iconButton}
            accessibilityLabel="Notifications"
          >
            <MaterialCommunityIcons name="bell-outline" size={20} color={colors.navText} />
          </Pressable>
          {user ? (
            <Pressable
              onPress={() => setIsAccountMenuOpen(true)}
              style={styles.avatarButton}
              accessibilityLabel="Account menu"
            >
              <Image source={{ uri: buildAvatarSrc(user.avatar_path) }} style={styles.avatarImage} />
            </Pressable>
          ) : (
            <Pressable onPress={handleLogin} style={styles.loginButton} accessibilityLabel="Login">
              <ThemedText style={styles.loginButtonText}>Login</ThemedText>
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* search input now expands inside the nav bar */}

      <Modal
        visible={isAccountMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAccountMenu}
      >
        <Pressable style={styles.menuBackdrop} onPress={closeAccountMenu} />
        <View style={styles.menuContainer} pointerEvents="box-none">
          <View style={[styles.menu, theme === 'dark' && styles.menuDark]}>
            <Pressable style={styles.menuItem} onPress={handleAccountSettings}>
              <ThemedText style={styles.menuItemText}>Account Settings</ThemedText>
            </Pressable>
            <Pressable style={[styles.menuItem, styles.themeToggle]} onPress={toggleTheme}>
              <MaterialCommunityIcons
                name="weather-sunny"
                size={16}
                color={theme === 'dark' ? '#9ca3af' : '#f59e0b'}
              />
              <Switch
                value={theme === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: hexToRgba(colors.text, 0.15), true: '#3d3d3d' }}
                thumbColor={theme === 'dark' ? '#e2e8f0' : '#ffffff'}
              />
              <MaterialCommunityIcons
                name="weather-night"
                size={16}
                color={theme === 'dark' ? '#f8fafc' : '#9ca3af'}
              />
              <ThemedText style={styles.srOnly}>
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </ThemedText>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleLogout}>
              <ThemedText style={styles.menuItemText}>Log Out</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  navBar: {
    paddingHorizontal: Brand.spacing.lg,
    paddingVertical: Brand.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  brand: {
    flex: 1,
    alignItems: 'center',
  },
  brandText: {
    color: colors.navText,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  loginButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loginButtonText: {
    color: colors.primaryFrom,
    fontSize: 13,
    fontWeight: '600',
  },
  searchInline: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: colors.card,
    marginRight: 4,
  },
  searchInlineInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInlineInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    padding: 0,
    margin: 0,
  },
  searchInlineClose: {
    padding: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
  },
  menuContainer: {
    position: 'absolute',
    top: 64,
    right: 16,
    left: 16,
    alignItems: 'flex-end',
  },
  menu: {
    width: 190,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: 'hidden',
  },
  menuDark: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
