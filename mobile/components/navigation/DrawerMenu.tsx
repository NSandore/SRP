import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/hooks/use-session';
import { isAdmin, isSuperAdmin } from '@/constants/roles';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { useBrandStyles } from '@/hooks/use-brand-styles';

const DRAWER_WIDTH = 300;

const baseItems = [
  { key: 'home', label: 'Home', route: '/feed', icon: 'home', color: '#2563EB' },
  { key: 'info', label: 'Info Board', route: '/info', icon: 'information-variant', color: '#0EA5E9' },
  { key: 'funding', label: 'Funding', route: '/funding', icon: 'medal-outline', color: '#F59E0B', comingSoon: true },
  { key: 'communities', label: 'Communities', route: '/communities', icon: 'account-group', color: '#10B981' },
  { key: 'saved', label: 'Saved', route: '/saved', icon: 'bookmark-outline', color: '#6366F1' },
  { key: 'connections', label: 'Connections', route: '/connections', icon: 'account-check', color: '#EC4899' },
  { key: 'profile', label: 'My Profile', route: '/profile', icon: 'account-circle', color: '#64748B' },
];

const mobileExtras = [
  { key: 'events_feed', label: 'Events', route: '/events', icon: 'calendar', color: '#14B8A6' },
  { key: 'polls_feed', label: 'Polls', route: '/polls', icon: 'poll', color: '#F97316' },
];

const adminItems = [
  { key: 'events_admin', label: 'Event Management', route: '/events-management', icon: 'calendar-star', color: '#2563EB' },
  { key: 'verifications', label: 'Verification Review', route: '/verifications', icon: 'shield-check', color: '#F43F5E' },
];

const lockedKeys = new Set(['saved', 'connections', 'profile', 'polls_feed']);

export type DrawerMenuProps = {
  visible: boolean;
  onClose: () => void;
};

export default function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPath = pathname === '/' ? '/feed' : pathname;
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const items = useMemo(() => {
    const list = [...baseItems];
    const insertAt = list.findIndex((item) => item.key === 'communities');
    const idx = insertAt === -1 ? list.length : insertAt + 1;
    list.splice(idx, 0, ...mobileExtras);

    const roleId = user?.role_id;
    const adminCommunityIds = Array.isArray(user?.admin_community_ids) ? user?.admin_community_ids : [];
    const isCommunityAdmin = adminCommunityIds.length > 0;
    const isAmbassador = Number(user?.is_ambassador) === 1;
    const showAdmin = isSuperAdmin(roleId) || isAdmin(roleId) || isCommunityAdmin || isAmbassador;

    if (showAdmin) {
      list.push(...adminItems);
    }
    return list;
  }, [user]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Navigation</ThemedText>
          {user ? (
            <ThemedText style={styles.headerSubtitle}>{user.first_name} {user.last_name}</ThemedText>
          ) : (
            <Pressable onPress={() => { onClose(); router.push('/login'); }}>
              <ThemedText style={styles.headerLink}>Sign in</ThemedText>
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {items.map((item) => {
            const isLocked = !user && lockedKeys.has(item.key);
            const isActive = normalizedPath === item.route || normalizedPath.startsWith(`${item.route}/`);
            return (
              <Pressable
                key={item.key}
                style={[styles.link, isActive && styles.linkActive, isLocked && styles.linkLocked]}
                onPress={() => {
                  if (isLocked) {
                    onClose();
                    openLockedFeature(item.label);
                    return;
                  }
                  onClose();
                  router.push(item.route as any);
                }}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: hexToRgba(item.color, 0.15), borderColor: hexToRgba(item.color, 0.35) },
                    isActive && { backgroundColor: hexToRgba('#FFFFFF', 0.2), borderColor: 'transparent' },
                  ]}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={18} color={isActive ? '#fff' : item.color} />
                </View>
                <View style={styles.labelGroup}>
                  <ThemedText style={[styles.label, isActive && styles.labelActive]}>{item.label}</ThemedText>
                  {isLocked ? (
                    <View style={styles.badge}>
                      <MaterialCommunityIcons name="lock" size={12} color={colors.subtext} />
                      <ThemedText style={styles.badgeText}>Locked</ThemedText>
                    </View>
                  ) : null}
                  {item.comingSoon ? (
                    <View style={[styles.badge, styles.badgeSoon]}>
                      <ThemedText style={[styles.badgeText, styles.badgeSoonText]}>Coming Soon...</ThemedText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.card,
    paddingTop: 48,
    paddingHorizontal: Brand.spacing.lg,
    borderTopRightRadius: Brand.radius.card,
    borderBottomRightRadius: Brand.radius.card,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 2, height: 0 },
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    gap: 4,
    paddingBottom: Brand.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: Brand.spacing.lg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.subtext,
  },
  headerLink: {
    fontSize: 14,
    color: colors.primaryFrom,
    fontWeight: '600',
  },
  list: {
    gap: 10,
    paddingBottom: Brand.spacing.xxl,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  linkActive: {
    backgroundColor: colors.primaryFrom,
  },
  linkLocked: {
    opacity: 0.6,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  labelGroup: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  labelActive: {
    color: '#fff',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    color: colors.subtext,
  },
  badgeSoon: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeSoonText: {
    color: '#b45309',
  },
});
