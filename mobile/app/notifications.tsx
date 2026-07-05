import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { apiClient } from '@/lib/api/client';
import { buildAvatarSrc } from '@/lib/uploads';
import { useBrandStyles } from '@/hooks/use-brand-styles';

type NotificationItem = {
  notification_id: string;
  notification_type?: string;
  message?: string;
  is_read?: string | number;
  created_at?: string;
  actor_user_id?: string;
  avatar_path?: string | null;
  first_name?: string;
  last_name?: string;
  reference_id?: string;
};

const stripHtml = (html = '') =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const extractFirstHref = (html = '') => {
  const match = html.match(/<a[^>]+href=["']([^"']+)["']/i);
  return match ? match[1] : '';
};

const typeIcon = (type?: string): string => {
  switch (type) {
    case 'message': return 'message-text';
    case 'connection': return 'account-plus';
    case 'follow': return 'account-heart';
    case 'verification_request': return 'shield-account';
    case 'verification_result': return 'shield-check';
    default: return 'bell';
  }
};

const typeColor = (type?: string, primaryFrom?: string): string => {
  switch (type) {
    case 'message': return '#0ea5e9';
    case 'connection': return '#10b981';
    case 'follow': return '#f43f5e';
    case 'verification_request': return '#f59e0b';
    case 'verification_result': return '#8b5cf6';
    default: return primaryFrom ?? '#6366f1';
  }
};

const relativeTime = (timestamp?: string): string => {
  if (!timestamp) return '';
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export default function NotificationsScreen() {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const { openLockedFeature } = useLockedFeature();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => String(n.is_read) === '0').length,
    [notifications]
  );

  const fetchNotifications = async () => {
    if (!user?.user_id) return;
    setIsFetching(true);
    setError(null);
    try {
      const resp = await apiClient.get('/fetch_notifications.php', {
        params: { user_id: user.user_id },
      });
      if ((resp.data as any)?.success) {
        setNotifications((resp.data as any)?.notifications || []);
      } else {
        setError((resp.data as any)?.error || 'Unable to load notifications.');
      }
    } catch {
      setError('Unable to load notifications.');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user?.user_id) {
      openLockedFeature('Notifications');
      return;
    }
    fetchNotifications();
  }, [user?.user_id, isLoading, openLockedFeature]);

  const markAllRead = async () => {
    if (!user?.user_id) return;
    try {
      await apiClient.post('/mark_notifications_read.php', { user_id: user.user_id });
      setNotifications([]);
    } catch {
      setError('Unable to mark notifications as read.');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await apiClient.post('/delete_notification.php', { notification_id: notificationId });
      setNotifications((prev) => prev.filter((n) => n.notification_id !== notificationId));
    } catch {
      setError('Unable to dismiss notification.');
    }
  };

  const notificationTarget = (notif: NotificationItem) => {
    const linkedHref = extractFirstHref(notif.message || '');
    if (linkedHref) return linkedHref;

    const actorId = notif.actor_user_id;
    switch (notif.notification_type) {
      case 'message':
        return actorId ? `/messages?user=${actorId}` : '/messages';
      case 'connection':
        return actorId ? `/user/${actorId}` : '/messages';
      case 'follow':
        return actorId ? `/user/${actorId}` : '';
      case 'verification_request':
        return notif.reference_id
          ? `/admin/verifications?request_id=${notif.reference_id}`
          : '/admin/verifications';
      case 'verification_result':
        return '/profile';
      default:
        return '';
    }
  };

  const handleNavigate = async (notif: NotificationItem) => {
    const target = notificationTarget(notif);
    if (!target) return;
    if (/^https?:\/\//i.test(target)) {
      await Linking.openURL(target);
      return;
    }
    router.push(target);
  };

  return (
    <AppShell>
      <View style={styles.screen}>
        {/* Page header */}
        <View style={styles.pageHeader}>
          <View>
            <ThemedText type="title" style={styles.pageTitle}>Notifications</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
            </ThemedText>
          </View>
          <View style={styles.bellWrap}>
            <MaterialCommunityIcons name="bell" size={22} color={colors.primaryFrom} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          {/* Card header */}
          <LinearGradient
            colors={[hexToRgba(colors.primaryFrom, 0.14), hexToRgba(colors.primaryFrom, 0.04)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardHeader}
          >
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardIconCircle}>
                <MaterialCommunityIcons name="bell-outline" size={16} color={colors.primaryFrom} />
              </View>
              <View>
                <ThemedText style={styles.cardTitle}>Activity</ThemedText>
                <ThemedText style={styles.cardSubtitle}>
                  {unreadCount > 0 ? `${unreadCount} new` : 'Nothing new'}
                </ThemedText>
              </View>
            </View>
            {notifications.length > 0 ? (
              <Pressable style={styles.markReadButton} onPress={markAllRead}>
                <MaterialCommunityIcons name="check-all" size={13} color={colors.primaryFrom} />
                <ThemedText style={styles.markReadText}>Mark all read</ThemedText>
              </Pressable>
            ) : null}
          </LinearGradient>

          {/* Body */}
          <ScrollView contentContainerStyle={styles.cardBody}>
            {isFetching ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.primaryFrom} />
                <ThemedText style={styles.loadingText}>Loading notifications…</ThemedText>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorWrap}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.danger} />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : null}

            {!isFetching && notifications.length === 0 && !error ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MaterialCommunityIcons name="bell-check-outline" size={32} color={colors.primaryFrom} />
                </View>
                <ThemedText style={styles.emptyTitle}>You&apos;re all caught up</ThemedText>
                <ThemedText style={styles.emptyText}>
                  We&apos;ll let you know when something new arrives.
                </ThemedText>
              </View>
            ) : null}

            {notifications.map((notif) => {
              const unread = String(notif.is_read) === '0';
              const fullName = `${notif.first_name || 'User'} ${notif.last_name || ''}`.trim();
              const accent = typeColor(notif.notification_type, colors.primaryFrom);
              const icon = typeIcon(notif.notification_type);
              return (
                <Pressable
                  key={notif.notification_id}
                  style={[styles.notifItem, unread && styles.notifItemUnread]}
                  onPress={() => handleNavigate(notif)}
                >
                  {unread ? <View style={[styles.unreadBar, { backgroundColor: accent }]} /> : null}

                  <View style={styles.notifInner}>
                    {/* Avatar + type icon badge */}
                    <View style={styles.avatarWrap}>
                      <Image
                        source={{ uri: buildAvatarSrc(notif.avatar_path) }}
                        style={styles.avatar}
                      />
                      <View style={[styles.typeIconBadge, { backgroundColor: accent }]}>
                        <MaterialCommunityIcons name={icon as any} size={9} color="#fff" />
                      </View>
                    </View>

                    {/* Copy */}
                    <View style={styles.notifCopy}>
                      <ThemedText style={styles.notifText} numberOfLines={3}>
                        {stripHtml(notif.message || `${fullName} sent an update.`)}
                      </ThemedText>
                      <View style={styles.notifMeta}>
                        <MaterialCommunityIcons name="clock-outline" size={10} color={colors.subtext} />
                        <ThemedText style={styles.notifTime}>
                          {relativeTime(notif.created_at)}
                        </ThemedText>
                        {unread ? (
                          <View style={[styles.unreadDot, { backgroundColor: accent }]} />
                        ) : null}
                      </View>
                    </View>

                    {/* Dismiss */}
                    <Pressable
                      style={styles.dismissBtn}
                      onPress={() => deleteNotification(notif.notification_id)}
                      hitSlop={8}
                    >
                      <MaterialCommunityIcons name="close" size={13} color={colors.subtext} />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </AppShell>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    padding: Brand.spacing.lg,
    backgroundColor: colors.page,
    gap: 16,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontWeight: '700',
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 2,
  },
  bellWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.primaryFrom, 0.1),
    borderWidth: 1,
    borderColor: hexToRgba(colors.primaryFrom, 0.2),
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  card: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 6,
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: colors.subtext,
    marginTop: 1,
  },
  markReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.1),
    borderWidth: 1,
    borderColor: hexToRgba(colors.primaryFrom, 0.2),
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  cardBody: {
    padding: 12,
    gap: 8,
  },
  loadingWrap: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.subtext,
  },
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: hexToRgba('#ef4444', 0.08),
    borderWidth: 1,
    borderColor: hexToRgba('#ef4444', 0.2),
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    flex: 1,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    fontSize: 12,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 18,
  },
  notifItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 1,
  },
  notifItemUnread: {
    borderColor: hexToRgba(colors.primaryFrom, 0.25),
    backgroundColor: hexToRgba(colors.primaryFrom, 0.04),
  },
  unreadBar: {
    height: 3,
    borderRadius: 999,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: -2,
    opacity: 0.7,
  },
  notifInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
  },
  avatarWrap: {
    position: 'relative',
    width: 42,
    height: 42,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeIconBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  notifCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  notifText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 17,
  },
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notifTime: {
    fontSize: 10,
    color: colors.subtext,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
  dismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: hexToRgba(colors.text, 0.06),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
