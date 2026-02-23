import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
const POLL_RESPONSES_KEY = 'managedPollResponses';
const POLL_RESULTS_KEY = 'managedPollTallies';

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

type PollItem = {
  id: string;
  title: string;
  description?: string;
  type: 'poll' | 'announcement' | 'event' | string;
  date?: string;
  createdAt?: string;
  scope?: 'global' | 'community' | string;
  communityId?: string;
  communityName?: string;
  pollOptions?: string[];
  showResults?: boolean;
};

export default function PollsScreen() {
  const { user, isLoading } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const userId = user?.user_id ? String(user.user_id) : '';
  const isSuperAdminUser = isSuperAdmin(user?.role_id);
  const styles = useBrandStyles(createStyles);

  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(user?.admin_community_ids)) return [];
    return user.admin_community_ids.map((id) => String(id));
  }, [user?.admin_community_ids]);

  const [items, setItems] = useState<PollItem[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [pollResponses, setPollResponses] = useState<Record<string, string>>({});
  const [pollTallies, setPollTallies] = useState<Record<string, Record<string, number>>>({});
  const [pollMessages, setPollMessages] = useState<Record<string, string>>({});

  const readLocalItems = async () => {
    setLoadingItems(true);
    const raw = await readStorage(STORAGE_KEY);
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        setItems([]);
        return;
      }
      const normalized: PollItem[] = parsed
        .filter((i: any) => i && (i.id || i.event_id) && i.title)
        .map((i: any) => ({
          id: String(i.id ?? i.event_id),
          title: String(i.title ?? ''),
          description: i.description || '',
          type: i.type || i.event_type || 'poll',
          date: i.date || i.start_at || i.startAt || i.starts_at || '',
          createdAt: i.createdAt || i.created_at || '',
          scope: i.scope || (i.communityId || i.community_id ? 'community' : 'global'),
          communityId: i.communityId ? String(i.communityId) : i.community_id ? String(i.community_id) : '',
          communityName: i.communityName || i.community_name || '',
          pollOptions: Array.isArray(i.pollOptions) ? i.pollOptions : [],
          showResults: Boolean(i.showResults),
        }));
      setItems(normalized);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const readStoredResponses = async () => {
    const raw = await readStorage(POLL_RESPONSES_KEY);
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') {
        setPollResponses(parsed as Record<string, string>);
      } else {
        setPollResponses({});
      }
    } catch {
      setPollResponses({});
    }
  };

  const readStoredTallies = async () => {
    const raw = await readStorage(POLL_RESULTS_KEY);
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') {
        setPollTallies(parsed as Record<string, Record<string, number>>);
      } else {
        setPollTallies({});
      }
    } catch {
      setPollTallies({});
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user?.user_id) {
      openLockedFeature('Polls');
    }
  }, [user?.user_id, isLoading, openLockedFeature]);

  useEffect(() => {
    readLocalItems();
    readStoredResponses();
    readStoredTallies();
    if (!isWeb) return;
    const handleStorage = (e: any) => {
      if (e.key === STORAGE_KEY) readLocalItems();
      if (e.key === POLL_RESPONSES_KEY) readStoredResponses();
      if (e.key === POLL_RESULTS_KEY) readStoredTallies();
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
    writeStorage(POLL_RESPONSES_KEY, JSON.stringify(pollResponses));
  }, [pollResponses]);

  useEffect(() => {
    writeStorage(POLL_RESULTS_KEY, JSON.stringify(pollTallies));
  }, [pollTallies]);

  const followsCommunity = (communityId?: string) => {
    if (!communityId) return false;
    if (adminCommunityIds.includes(String(communityId))) return true;
    return followed.includes(String(communityId));
  };

  const isVisible = (item: PollItem) => {
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

  const polls = useMemo(() => {
    const rank = (item: PollItem) => {
      const date = item.date || item.createdAt;
      if (date) {
        const t = Date.parse(date);
        if (!Number.isNaN(t)) return t;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    return visibleItems.filter((i) => i.type === 'poll').sort((a, b) => rank(a) - rank(b));
  }, [visibleItems]);

  const scopeLabel = (item: PollItem) =>
    item.scope === 'global'
      ? 'Global'
      : item.communityName || (item.communityId ? `Community ${item.communityId}` : 'Community item');

  const renderPollMeta = (item: PollItem) => {
    const dateValue = item.date || item.createdAt;
    const dateText = dateValue ? `${datePrefix(item.type)} ${new Date(dateValue).toLocaleString()}` : '';
    return `Poll · ${scopeLabel(item)}${dateText ? ` · ${dateText}` : ''}`;
  };

  const handleVote = (poll: PollItem, option: string) => {
    if (!poll) return;
    if (!userId) {
      openLockedFeature('Polls');
      setPollMessages((prev) => ({ ...prev, [poll.id]: 'Log in or sign up to vote in polls.' }));
      return;
    }

    const prevChoice = pollResponses[poll.id];
    if (prevChoice === option) {
      setPollMessages((prev) => ({ ...prev, [poll.id]: 'You already selected this option.' }));
      return;
    }

    setPollResponses((prev) => ({ ...prev, [poll.id]: option }));
    setPollTallies((prev) => {
      const next = { ...prev };
      const pollTotals = { ...(next[poll.id] || {}) };
      if (prevChoice && pollTotals[prevChoice]) {
        pollTotals[prevChoice] = Math.max(0, pollTotals[prevChoice] - 1);
      }
      pollTotals[option] = (pollTotals[option] || 0) + 1;
      next[poll.id] = pollTotals;
      return next;
    });
    setPollMessages((prev) => ({
      ...prev,
      [poll.id]: prevChoice ? 'Vote updated.' : 'Thanks for voting!',
    }));
  };

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.pageTitle}>Polls</ThemedText>
          <ThemedText style={styles.pageSubtitle}>
            {loadingFollowed ? 'Loading polls...' : 'Vote on polls from your communities.'}
          </ThemedText>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Polls</ThemedText>
          </View>
          <View style={styles.cardBody}>
            {!polls.length ? (
              <ThemedText style={styles.emptyText}>
                {loadingFollowed || loadingItems ? 'Loading polls...' : 'No polls from your communities yet.'}
              </ThemedText>
            ) : (
              polls.map((poll) => {
                const chosen = pollResponses[poll.id];
                const message = pollMessages[poll.id];
                return (
                  <View key={poll.id} style={styles.listItem}>
                    <ThemedText style={styles.itemTitle}>{poll.title}</ThemedText>
                    <ThemedText style={styles.itemMeta}>{renderPollMeta(poll)}</ThemedText>
                    {poll.pollOptions && poll.pollOptions.length > 0 ? (
                      <View style={styles.pollOptions}>
                        {poll.pollOptions.map((opt, idx) => {
                          const isSelected = chosen === opt;
                          return (
                            <Pressable
                              key={`${poll.id}-${idx}`}
                              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                              onPress={() => handleVote(poll, opt)}
                              disabled={!userId}
                            >
                              <ThemedText
                                style={[styles.optionText, isSelected && styles.optionTextSelected]}
                              >
                                {opt}
                              </ThemedText>
                              {isSelected ? <ThemedText style={styles.optionCheck}>✓</ThemedText> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <ThemedText style={styles.itemMeta}>This poll has no options configured.</ThemedText>
                    )}
                    {message ? <ThemedText style={styles.itemMeta}>{message}</ThemedText> : null}
                    {chosen && poll.showResults ? (
                      <View style={styles.results}>
                        {(poll.pollOptions || []).map((opt, idx) => {
                          const pollTotal = pollTallies[poll.id] || {};
                          const votes = pollTotal[opt] || 0;
                          const totalVotes = Object.values(pollTotal).reduce(
                            (sum, n) => sum + (typeof n === 'number' ? n : 0),
                            0
                          );
                          const percent = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                          return (
                            <View key={`${poll.id}-result-${idx}`} style={styles.resultRow}>
                              <ThemedText style={styles.resultLabel}>{opt}</ThemedText>
                              <View style={styles.resultBar}>
                                <View style={[styles.resultFill, { width: `${percent}%` }]} />
                              </View>
                              <ThemedText style={styles.resultMeta}>
                                {votes} vote{votes === 1 ? '' : 's'} • {percent}%
                              </ThemedText>
                            </View>
                          );
                        })}
                        {!Object.values(pollTallies[poll.id] || {}).length ? (
                          <ThemedText style={styles.itemMeta}>No votes recorded yet.</ThemedText>
                        ) : null}
                      </View>
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
    backgroundColor: '#F59E0B',
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
    gap: 8,
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
  pollOptions: {
    gap: 8,
  },
  optionButton: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: colors.hover,
    borderColor: colors.primaryFrom,
  },
  optionText: {
    fontSize: 12,
    color: colors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: colors.text,
  },
  optionCheck: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  results: {
    gap: 8,
  },
  resultRow: {
    gap: 4,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  resultBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  resultFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primaryFrom,
  },
  resultMeta: {
    fontSize: 11,
    color: colors.subtext,
  },
});
