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

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  };

  return (
    <AppShell>
      <View style={styles.screen}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.pageTitle}>
            Notifications
          </ThemedText>
        </View>

        <View style={styles.card}>
          <LinearGradient
            colors={[hexToRgba('#0277b5', 0.12), hexToRgba('#38bdf8', 0.08)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardHeader}
          >
            <View>
              <ThemedText style={styles.cardTitle}>Notifications</ThemedText>
              <ThemedText style={styles.cardSubtitle}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </ThemedText>
            </View>
            {notifications.length > 0 ? (
              <Pressable style={styles.markReadButton} onPress={markAllRead}>
                <ThemedText style={styles.markReadText}>Mark all read</ThemedText>
              </Pressable>
            ) : null}
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.cardBody}>
            {isFetching ? <ActivityIndicator /> : null}
            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

            {!isFetching && notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>You&apos;re all caught up.</ThemedText>
                <ThemedText style={styles.emptyText}>
                  We&apos;ll let you know when something new arrives.
                </ThemedText>
              </View>
            ) : null}

            {notifications.map((notif) => {
              const unread = String(notif.is_read) === '0';
              const fullName = `${notif.first_name || 'User'} ${notif.last_name || ''}`.trim();
              return (
                <Pressable
                  key={notif.notification_id}
                  style={[styles.notificationItem, unread && styles.notificationItemUnread]}
                  onPress={() => handleNavigate(notif)}
                >
                  <View style={styles.notificationBody}>
                    <Image
                      source={{ uri: buildAvatarSrc(notif.avatar_path) }}
                      style={styles.notificationAvatar}
                    />
                    <View style={styles.notificationCopy}>
                      <ThemedText style={styles.notificationText}>
                        {stripHtml(notif.message || `${fullName} sent an update.`)}
                      </ThemedText>
                      <ThemedText style={styles.notificationTime}>
                        {formatTimestamp(notif.created_at)}
                      </ThemedText>
                    </View>
                    <Pressable
                      style={styles.dismissButton}
                      onPress={() => deleteNotification(notif.notification_id)}
                    >
                      <MaterialCommunityIcons name="close" size={14} color={colors.subtext} />
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
  header: {
    gap: 6,
  },
  pageTitle: {
    fontWeight: '700',
  },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 28,
    elevation: 6,
  },
  cardHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: colors.subtext,
  },
  markReadButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: hexToRgba(colors.text, 0.08),
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  cardBody: {
    padding: 12,
    gap: 10,
  },
  emptyState: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: hexToRgba(colors.text, 0.04),
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  emptyText: {
    fontSize: 11,
    color: colors.subtext,
    textAlign: 'center',
  },
  notificationItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 2,
  },
  notificationItemUnread: {
    borderColor: hexToRgba(colors.primaryFrom, 0.35),
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
  },
  notificationBody: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  notificationAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  notificationText: {
    fontSize: 12,
    color: colors.text,
  },
  notificationTime: {
    fontSize: 10,
    color: colors.subtext,
  },
  dismissButton: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.text, 0.06),
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
  },
});
