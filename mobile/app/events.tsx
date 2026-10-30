import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
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

type ActiveView = 'list' | 'grid' | 'calendar';

const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function EventsScreen() {
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const userId = user?.user_id ? String(user.user_id) : '';
  const isSuperAdminUser = isSuperAdmin(user?.role_id);
  const styles = useBrandStyles(createStyles);
  const colors = useBrandColors();

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

  const [activeView, setActiveView] = useState<ActiveView>('calendar');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    sortedEvents.forEach((item) => {
      const d = item.date || item.createdAt;
      if (!d) return;
      const key = new Date(d).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [sortedEvents]);

  const calendarRows = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [calendarDate]);

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

  const renderEventCard = (item: EventItem) => {
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
              <ThemedText style={[styles.ctaText, hasRsvped && styles.ctaTextSelected]}>
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
  };

  const renderGridCard = (item: EventItem) => {
    const rsvpList = rsvps[item.id] || [];
    const hasRsvped = Boolean(userId && rsvpList.includes(userId));
    const isEvent = item.type !== 'announcement' && item.type !== 'poll';
    const dateValue = item.date || item.createdAt;
    const isVirtual = Boolean(item.zoomJoinUrl || item.zoomMeetingId);
    return (
      <Pressable
        key={item.id}
        style={[styles.gridCard, hasRsvped && styles.gridCardRsvped]}
        onPress={() => isEvent && toggleRsvp(item.id)}
      >
        {isVirtual ? (
          <View style={styles.gridVirtualBadge}>
            <MaterialCommunityIcons name="video-outline" size={10} color={colors.primaryFrom} />
          </View>
        ) : null}
        <ThemedText style={styles.gridTitle} numberOfLines={2}>{item.title}</ThemedText>
        {dateValue ? (
          <ThemedText style={styles.gridMeta} numberOfLines={1}>
            {new Date(dateValue).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </ThemedText>
        ) : null}
        {isEvent ? (
          <View style={[styles.gridRsvpIndicator, hasRsvped && styles.gridRsvpIndicatorActive]}>
            <ThemedText style={[styles.gridRsvpLabel, hasRsvped && styles.gridRsvpLabelActive]}>
              {hasRsvped ? 'Going' : 'RSVP'}
            </ThemedText>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const virtualEvents = useMemo(() => sortedEvents.filter((e) => e.zoomJoinUrl || e.zoomMeetingId), [sortedEvents]);
  const inPersonEvents = useMemo(() => sortedEvents.filter((e) => !e.zoomJoinUrl && !e.zoomMeetingId), [sortedEvents]);

  const chunkBy4 = (arr: EventItem[]) => {
    const rows: EventItem[][] = [];
    for (let i = 0; i < arr.length; i += 4) rows.push(arr.slice(i, i + 4));
    return rows;
  };

  const renderGridRows = (events: EventItem[]) => (
    <View style={styles.gridRows}>
      {chunkBy4(events).map((row, ri) => (
        <View key={ri} style={styles.gridRow}>
          {row.map((item) => (
            <View key={item.id} style={styles.gridCardWrap}>
              {renderGridCard(item)}
            </View>
          ))}
          {row.length < 4 && Array.from({ length: 4 - row.length }).map((_, i) => (
            <View key={`pad-${i}`} style={styles.gridCardWrap} />
          ))}
        </View>
      ))}
    </View>
  );

  const renderGridSection = (label: string, icon: string, events: EventItem[]) => (
    <View style={styles.gridSection}>
      <View style={styles.gridSectionHeader}>
        <MaterialCommunityIcons name={icon as any} size={13} color={colors.subtext} />
        <ThemedText style={styles.gridSectionLabel}>{label}</ThemedText>
        <ThemedText style={styles.gridSectionCount}>{events.length}</ThemedText>
      </View>
      {events.length ? (
        renderGridRows(events)
      ) : (
        <View style={styles.gridSectionEmpty}>
          <ThemedText style={styles.emptyText}>No {label.toLowerCase()} events</ThemedText>
        </View>
      )}
    </View>
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthLabel = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const selectedEvents = selectedCalendarDay ? (eventsByDay.get(selectedCalendarDay) || []) : [];

    return (
      <View style={styles.calendarWrap}>
        <View style={styles.calendarNav}>
          <Pressable
            onPress={() => setCalendarDate(new Date(year, month - 1, 1))}
            style={styles.calNavBtn}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
          </Pressable>
          <ThemedText style={styles.calMonthLabel}>{monthLabel}</ThemedText>
          <Pressable
            onPress={() => setCalendarDate(new Date(year, month + 1, 1))}
            style={styles.calNavBtn}
          >
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.calDowRow}>
          {DOW_LABELS.map((d) => (
            <ThemedText key={d} style={styles.calDowLabel}>{d}</ThemedText>
          ))}
        </View>

        {calendarRows.map((row, ri) => (
          <View key={ri} style={styles.calRow}>
            {row.map((day, ci) => {
              if (!day) return <View key={ci} style={styles.calCell} />;
              const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDay.get(dayStr) || [];
              const isToday = dayStr === todayStr;
              const isSelected = dayStr === selectedCalendarDay;
              return (
                <Pressable
                  key={ci}
                  style={[
                    styles.calCell,
                    isToday && styles.calCellToday,
                    isSelected && styles.calCellSelected,
                  ]}
                  onPress={() => setSelectedCalendarDay(isSelected ? null : dayStr)}
                >
                  <ThemedText
                    style={[
                      styles.calDayNum,
                      isToday && styles.calDayNumToday,
                      isSelected && styles.calDayNumSelected,
                    ]}
                  >
                    {day}
                  </ThemedText>
                  {dayEvents.length > 0 ? (
                    <View style={styles.calDots}>
                      {dayEvents.slice(0, 3).map((e, i) => (
                        <View
                          key={i}
                          style={[
                            styles.calDot,
                            e.type === 'announcement'
                              ? styles.calDotAnnouncement
                              : e.type === 'poll'
                              ? styles.calDotPoll
                              : styles.calDotEvent,
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}

        {selectedCalendarDay ? (
          <View style={styles.calDayEvents}>
            <ThemedText style={styles.calDayEventsTitle}>
              {new Date(selectedCalendarDay + 'T00:00:00').toLocaleDateString('default', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </ThemedText>
            {selectedEvents.length === 0 ? (
              <ThemedText style={styles.emptyText}>No events on this day.</ThemedText>
            ) : (
              selectedEvents.map((item) => renderEventCard(item))
            )}
          </View>
        ) : null}
      </View>
    );
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
            <View style={styles.viewToggle}>
              {(['list', 'grid', 'calendar'] as const).map((v) => (
                <Pressable
                  key={v}
                  style={[styles.viewToggleBtn, activeView === v && styles.viewToggleBtnActive]}
                  onPress={() => {
                    setActiveView(v);
                    setSelectedCalendarDay(null);
                  }}
                >
                  <MaterialCommunityIcons
                    name={v === 'list' ? 'view-list' : v === 'grid' ? 'view-grid' : 'calendar-month'}
                    size={16}
                    color={activeView === v ? colors.primaryFrom : 'rgba(255,255,255,0.65)'}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.cardBody}>
            {activeView === 'calendar' ? (
              renderCalendar()
            ) : activeView === 'list' ? (
              sortedEvents.length ? (
                sortedEvents.map((item) => renderEventCard(item))
              ) : (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}>
                    <MaterialCommunityIcons name="calendar-remove-outline" size={32} color={colors.primaryFrom} />
                  </View>
                  <ThemedText style={styles.emptyTitle}>No upcoming events</ThemedText>
                  <ThemedText style={styles.emptySubtext}>
                    {loadingFollowed || loadingItems
                      ? 'Loading your upcoming events…'
                      : 'Events and announcements from your communities will show up here.'}
                  </ThemedText>
                  <View style={styles.skeletonList}>
                    {[0.85, 0.65, 0.75].map((w, i) => (
                      <View key={i} style={styles.skeletonListItem}>
                        <View style={[styles.skeletonLine, { width: `${w * 100}%` as any }]} />
                        <View style={[styles.skeletonLine, styles.skeletonLineSm, { width: '45%' }]} />
                      </View>
                    ))}
                  </View>
                </View>
              )
            ) : (
              sortedEvents.length ? (
                <View style={styles.gridSections}>
                  {renderGridSection('Virtual', 'video-outline', virtualEvents)}
                  {renderGridSection('In-Person', 'map-marker-outline', inPersonEvents)}
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}>
                    <MaterialCommunityIcons name="calendar-remove-outline" size={32} color={colors.primaryFrom} />
                  </View>
                  <ThemedText style={styles.emptyTitle}>No upcoming events</ThemedText>
                  <ThemedText style={styles.emptySubtext}>
                    {loadingFollowed || loadingItems
                      ? 'Loading your upcoming events…'
                      : 'Events and announcements from your communities will show up here.'}
                  </ThemedText>
                  <View style={styles.gridSections}>
                    {(['Virtual', 'In-Person'] as const).map((label) => (
                      <View key={label} style={styles.gridSection}>
                        <View style={styles.gridSectionHeader}>
                          <MaterialCommunityIcons
                            name={label === 'Virtual' ? 'video-outline' : 'map-marker-outline'}
                            size={13} color={colors.subtext}
                          />
                          <ThemedText style={styles.gridSectionLabel}>{label}</ThemedText>
                        </View>
                        <View style={styles.gridRows}>
                          <View style={styles.gridRow}>
                            {[0, 1, 2, 3].map((i) => (
                              <View key={i} style={[styles.gridCardWrap, styles.skeletonCard]}>
                                <View style={styles.gridCard}>
                                  <View style={[styles.skeletonLine, { width: '60%' }]} />
                                  <View style={[styles.skeletonLine, { width: '80%' }]} />
                                  <View style={[styles.skeletonLine, styles.skeletonLineSm, { width: '40%' }]} />
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 2,
  },
  viewToggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardBody: {
    padding: 12,
    gap: 12,
  },
  emptyText: {
    fontSize: 12,
    color: colors.subtext,
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 8,
  },
  skeletonList: {
    width: '100%',
    gap: 8,
  },
  skeletonListItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    opacity: 0.4,
  },
  skeletonCard: {
    opacity: 0.35,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.subtext,
  },
  skeletonLineSm: {
    height: 8,
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
  // Grid view
  gridSections: {
    gap: 16,
  },
  gridSection: {
    gap: 8,
  },
  gridSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gridSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  gridSectionCount: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.subtext,
    opacity: 0.6,
  },
  gridSectionEmpty: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  gridRows: {
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gridCardWrap: {
    flex: 1,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gridCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: hexToRgba(colors.text, 0.03),
    padding: 8,
    gap: 4,
  },
  gridCardRsvped: {
    borderColor: hexToRgba(colors.primaryFrom, 0.35),
    backgroundColor: hexToRgba(colors.primaryFrom, 0.06),
  },
  gridVirtualBadge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.primaryFrom, 0.1),
    marginBottom: 2,
  },
  gridTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 14,
  },
  gridMeta: {
    fontSize: 9,
    color: colors.subtext,
  },
  gridRsvpIndicator: {
    marginTop: 2,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    backgroundColor: hexToRgba(colors.text, 0.06),
  },
  gridRsvpIndicatorActive: {
    backgroundColor: hexToRgba(colors.primaryFrom, 0.15),
  },
  gridRsvpLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.subtext,
  },
  gridRsvpLabelActive: {
    color: colors.primaryFrom,
  },
  // Calendar view
  calendarWrap: {
    gap: 2,
  },
  calendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.text, 0.06),
  },
  calMonthLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  calDowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calDowLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: colors.subtext,
  },
  calRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 4,
  },
  calCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primaryFrom,
  },
  calCellSelected: {
    backgroundColor: colors.primaryFrom,
  },
  calDayNum: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  calDayNumToday: {
    color: colors.primaryFrom,
    fontWeight: '700',
  },
  calDayNumSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  calDots: {
    flexDirection: 'row',
    gap: 2,
    alignSelf: 'center',
  },
  calDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  calDotEvent: {
    backgroundColor: colors.primaryFrom,
  },
  calDotAnnouncement: {
    backgroundColor: '#f59e0b',
  },
  calDotPoll: {
    backgroundColor: '#69A8F7',
  },
  calDayEvents: {
    marginTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  calDayEventsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
});
