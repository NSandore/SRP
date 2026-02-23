import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { isSuperAdmin } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { apiClient } from '@/lib/api/client';

const STORAGE_KEY = 'managedEvents';
const RSVP_KEY = 'managedEventRsvps';

const isWeb = Platform.OS === 'web';

const datePrefix = (type: string) => {
  if (type === 'poll') return 'Closes';
  if (type === 'announcement') return 'Publishes';
  return 'Occurs';
};

const isSecureStoreAvailable = async () => {
  if (isWeb) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

const readStorage = async (key: string) => {
  try {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    const useSecureStore = await isSecureStoreAvailable();
    if (!useSecureStore) return null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const writeStorage = async (key: string, value: string | null) => {
  try {
    if (isWeb) {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
      return;
    }
    const useSecureStore = await isSecureStoreAvailable();
    if (!useSecureStore) return;
    if (value === null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    // ignore storage failures
  }
};

type EventItem = {
  id: string;
  title: string;
  description?: string;
  type: 'event' | 'announcement' | 'poll' | string;
  date?: string;
  createdAt?: string;
  scope?: 'global' | 'community' | string;
  communityId?: string;
  communityName?: string;
  pollOptions?: string[];
  showResults?: boolean;
  zoomMeetingId?: string;
  zoomJoinUrl?: string;
  zoomStartUrl?: string;
  zoomHostEmail?: string;
  zoomDuration?: number;
};

export default function EventsScreen() {
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const userId = user?.user_id ? String(user.user_id) : '';
  const isSuperAdminUser = isSuperAdmin(user?.role_id);
  const styles = useBrandStyles(createStyles);

  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(user?.admin_community_ids)) return [];
    return user.admin_community_ids.map((id) => String(id));
  }, [user?.admin_community_ids]);

  const [items, setItems] = useState<EventItem[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [rsvps, setRsvps] = useState<Record<string, string[]>>({});
  const [rsvpMessages, setRsvpMessages] = useState<Record<string, string>>({});

  const readLocalItems = async () => {
    setLoadingItems(true);
    const raw = await readStorage(STORAGE_KEY);
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        setItems([]);
        return;
      }
      const normalized: EventItem[] = parsed
        .filter((i: any) => i && (i.id || i.event_id) && i.title)
        .map((i: any) => ({
          id: String(i.id ?? i.event_id),
          title: String(i.title ?? ''),
          description: i.description || '',
          type: i.type || i.event_type || 'event',
          date: i.date || i.start_at || i.startAt || i.starts_at || '',
          createdAt: i.createdAt || i.created_at || '',
          scope: i.scope || (i.communityId || i.community_id ? 'community' : 'global'),
          communityId: i.communityId ? String(i.communityId) : i.community_id ? String(i.community_id) : '',
          communityName: i.communityName || i.community_name || '',
          pollOptions: Array.isArray(i.pollOptions) ? i.pollOptions : [],
          showResults: Boolean(i.showResults),
          zoomMeetingId: i.zoomMeetingId ? String(i.zoomMeetingId) : i.meeting_id ? String(i.meeting_id) : '',
          zoomJoinUrl: i.zoomJoinUrl || i.meeting_link || '',
          zoomStartUrl: i.zoomStartUrl || i.meeting_start_link || '',
          zoomHostEmail: i.zoomHostEmail || i.host_email || '',
          zoomDuration: i.zoomDuration
            ? Number(i.zoomDuration)
            : i.duration_minutes
            ? Number(i.duration_minutes)
            : undefined,
        }));
      setItems(normalized);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const readStoredRsvps = async () => {
    const raw = await readStorage(RSVP_KEY);
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') {
        setRsvps(parsed as Record<string, string[]>);
      } else {
        setRsvps({});
      }
    } catch {
      setRsvps({});
    }
  };

  useEffect(() => {
    readLocalItems();
    readStoredRsvps();
    if (!isWeb) return;
    const handleStorage = (e: any) => {
      if (e.key === STORAGE_KEY) {
        readLocalItems();
      }
      if (e.key === RSVP_KEY) {
        readStoredRsvps();
      }
    };
    const handleCustomUpdate = (e: any) => {
      if (e?.detail?.key === STORAGE_KEY || !e?.detail) {
        readLocalItems();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('managedEventsUpdated', handleCustomUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('managedEventsUpdated', handleCustomUpdate);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.user_id) {
      setFollowed([]);
      return;
    }
    let mounted = true;
    setLoadingFollowed(true);
    apiClient
      .get('/followed_communities.php', { params: { user_id: user.user_id } })
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const ids = list.map((c: any) => String(c.community_id ?? c.id ?? '')).filter(Boolean);
        setFollowed(ids);
      })
      .catch(() => {
        if (!mounted) return;
        setFollowed([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingFollowed(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.user_id]);

  useEffect(() => {
    writeStorage(RSVP_KEY, JSON.stringify(rsvps));
  }, [rsvps]);

  const followsCommunity = (communityId?: string) => {
    if (!communityId) return false;
    if (adminCommunityIds.includes(String(communityId))) return true;
    return followed.includes(String(communityId));
  };

  const isVisible = (item: EventItem) => {
    if (item.scope === 'global') return true;
    if (!item.communityId) return false;
    if (isSuperAdminUser) return true;
    if (adminCommunityIds.includes(String(item.communityId))) return true;
    return followsCommunity(item.communityId);
  };

  const visibleItems = useMemo(
    () => items.filter((i) => isVisible(i)),
    [items, adminCommunityIds, followed, isSuperAdminUser]
  );

  const sortedEvents = useMemo(() => {
    const isUpcomingEvent = (item: EventItem) => {
      if (item.type === 'announcement') return true;
      const date = item.date || item.createdAt;
      if (!date) return true;
      const start = Date.parse(date);
      if (Number.isNaN(start)) return true;
      const durationMinutes = item.zoomDuration ? Number(item.zoomDuration) : 60;
      const end = start + Math.max(durationMinutes, 0) * 60 * 1000;
      return end > now;
    };
    const rank = (item: EventItem) => {
      const date = item.date || item.createdAt;
      if (date) {
        const t = Date.parse(date);
        if (!Number.isNaN(t)) return t;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    return visibleItems
      .filter((i) => i.type !== 'poll')
      .filter((i) => isUpcomingEvent(i))
      .sort((a, b) => rank(a) - rank(b));
  }, [visibleItems, now]);

  const scopeLabel = (item: EventItem) =>
    item.scope === 'global'
      ? 'Global'
      : item.communityName || (item.communityId ? `Community ${item.communityId}` : 'Community item');

  const renderItemMeta = (item: EventItem) => {
    const dateValue = item.date || item.createdAt;
    const dateText = dateValue ? `${datePrefix(item.type)} ${new Date(dateValue).toLocaleString()}` : '';
    const baseType = item.type === 'announcement' ? 'Announcement' : 'Event';
    return `${baseType} · ${scopeLabel(item)}${dateText ? ` · ${dateText}` : ''}`;
  };

  const toggleRsvp = async (eventId: string) => {
    if (!userId) {
      openLockedFeature('RSVPs');
      setRsvpMessages((prev) => ({ ...prev, [eventId]: 'Log in or sign up to RSVP.' }));
      return;
    }
    const currentList = rsvps[eventId] || [];
    const hasRsvped = currentList.includes(userId);
    try {
      await apiClient.post('/rsvp_event.php', {
        event_id: eventId,
        action: hasRsvped ? 'cancel' : 'register',
      });
    } catch {
      setRsvpMessages((prev) => ({ ...prev, [eventId]: 'Unable to update RSVP right now.' }));
      return;
    }
    setRsvps((prev) => {
      const next = { ...prev };
      next[eventId] = hasRsvped ? currentList.filter((id) => id !== userId) : [...currentList, userId];
      return next;
    });
    setRsvpMessages((prev) => ({
      ...prev,
      [eventId]: hasRsvped ? 'RSVP removed.' : 'RSVP confirmed!',
    }));
  };

  const handleOpenUrl = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.pageTitle}>Upcoming Events</ThemedText>
          <ThemedText style={styles.pageSubtitle}>
            {loadingFollowed ? 'Loading upcoming events...' : 'Events and announcements from your communities.'}
          </ThemedText>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Upcoming Events</ThemedText>
          </View>
          <View style={styles.cardBody}>
            {!sortedEvents.length ? (
              <ThemedText style={styles.emptyText}>
                {loadingFollowed || loadingItems
                  ? 'Loading your upcoming events...'
                  : 'No upcoming events yet.'}
              </ThemedText>
            ) : (
              sortedEvents.map((item) => {
                const rsvpList = rsvps[item.id] || [];
                const rsvpCount = rsvpList.length;
                const hasRsvped = Boolean(userId && rsvpList.includes(userId));
                const rsvpMessage = rsvpMessages[item.id];
                const isEvent = item.type !== 'announcement' && item.type !== 'poll';
                const description =
                  item.description && item.description.length > 180
                    ? `${item.description.slice(0, 180)}…`
                    : item.description || '';
                return (
                  <View key={item.id} style={styles.listItem}>
                    <ThemedText style={styles.itemTitle}>{item.title}</ThemedText>
                    <ThemedText style={styles.itemMeta}>{renderItemMeta(item)}</ThemedText>
                    {description ? (
                      <ThemedText style={[styles.itemMeta, styles.itemDescription]}>
                        {description}
                      </ThemedText>
                    ) : null}
                    {isEvent ? (
                      <View style={styles.itemActions}>
                        <Pressable
                          style={[styles.ctaButton, hasRsvped && styles.ctaButtonSelected]}
                          onPress={() => toggleRsvp(item.id)}
                        >
                          <ThemedText
                            style={[styles.ctaText, hasRsvped && styles.ctaTextSelected]}
                          >
                            {hasRsvped ? 'Going' : 'RSVP'}
                          </ThemedText>
                        </Pressable>
                        {item.zoomJoinUrl ? (
                          <Pressable
                            style={[styles.ctaButton, styles.ctaButtonSecondary]}
                            onPress={() => handleOpenUrl(item.zoomJoinUrl)}
                          >
                            <ThemedText style={[styles.ctaText, styles.ctaTextSecondary]}>
                              Join Zoom
                            </ThemedText>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                    {isEvent && rsvpCount > 0 ? (
                      <ThemedText style={styles.itemMeta}>{rsvpCount} going</ThemedText>
                    ) : null}
                    {isEvent && rsvpMessage ? (
                      <ThemedText style={styles.itemMeta}>{rsvpMessage}</ThemedText>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  container: {
    paddingHorizontal: Brand.spacing.lg,
    paddingTop: Brand.spacing.lg,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    gap: 6,
  },
  pageTitle: {
    fontWeight: '700',
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.subtext,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: colors.primaryFrom,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cardBody: {
    padding: 12,
    gap: 12,
  },
  emptyText: {
    fontSize: 12,
    color: colors.subtext,
  },
  listItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
    backgroundColor: hexToRgba('#0f172a', 0.02),
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  itemMeta: {
    fontSize: 11,
    color: colors.subtext,
  },
  itemDescription: {
    color: colors.text,
  },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  ctaButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primaryFrom,
  },
  ctaButtonSelected: {
    backgroundColor: hexToRgba(colors.primaryFrom, 0.15),
    borderWidth: 1,
    borderColor: colors.primaryFrom,
  },
  ctaButtonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  ctaTextSelected: {
    color: colors.primaryFrom,
  },
  ctaTextSecondary: {
    color: colors.text,
  },
});
