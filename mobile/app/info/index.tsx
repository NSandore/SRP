import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { isSuperAdmin } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import useTagOptions from '@/hooks/use-tag-options';
import { fetchForums } from '@/lib/api/forums';
import type { ForumItem } from '@/lib/api/forums';
import { apiClient } from '@/lib/api/client';
import { buildAvatarSrc } from '@/lib/uploads';
import { timeAgo } from '@/lib/utils/time';
import { getTagStyle } from '@/lib/utils/tags';
import {
  ALL_TOPICS_VALUE,
  extractForumTopicsFromForum,
  normalizeTopicValue,
  topicLabelFromValue,
} from '@/lib/utils/topics';
import { INFO_COMMUNITY_ID } from '@/constants/info';

const SORT_OPTIONS = [
  { key: 'mostRecent', label: 'Most Recent' },
  { key: 'popularity', label: 'Popularity' },
  { key: 'mostUpvoted', label: 'Most Upvoted' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['key'];

export default function InfoScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { tags: tagOptions } = useTagOptions();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [forums, setForums] = useState<ForumItem[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('mostRecent');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([ALL_TOPICS_VALUE]);
  const [isLoadingForums, setIsLoadingForums] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(true);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [openForumMenuId, setOpenForumMenuId] = useState<string | null>(null);
  const [forumSavedMap, setForumSavedMap] = useState<Record<string, boolean>>({});
  const [ambassadorCommunities, setAmbassadorCommunities] = useState<
    { community_id: string; name: string }[]
  >([]);
  const [openPinForumId, setOpenPinForumId] = useState<string | null>(null);
  const [pinnedMap, setPinnedMap] = useState<
    Record<string, { community_id: string; name: string; pin_id: string }[]>
  >({});
  const [pinLoadingMap, setPinLoadingMap] = useState<Record<string, boolean>>({});
  const [menuOverlay, setMenuOverlay] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const buildPinKey = (itemId: string, itemType: 'forum' | 'thread') => `${itemType}:${itemId}`;

  const loadPinnedStatus = async (itemId: string, itemType: 'forum' | 'thread') => {
    if (!itemId || ambassadorCommunities.length === 0) return;
    const key = buildPinKey(itemId, itemType);
    if (pinLoadingMap[key] || pinnedMap[key]) return;
    setPinLoadingMap((prev) => ({ ...prev, [key]: true }));
    try {
      const pinned: { community_id: string; name: string; pin_id: string }[] = [];
      await Promise.all(
        ambassadorCommunities.map(async (community) => {
          try {
            const res = await apiClient.get('/fetch_pinned_items.php', {
              params: { community_id: community.community_id, limit: 50 },
            });
            if ((res.data as any)?.success) {
              const items = (res.data as any)?.items || [];
              const match = items.find(
                (item: any) =>
                  String(item?.item_id) === String(itemId) &&
                  String(item?.item_type) === itemType
              );
              if (match?.pin_id) {
                pinned.push({
                  community_id: community.community_id,
                  name: community.name,
                  pin_id: String(match.pin_id),
                });
              }
            }
          } catch {
            // ignore per-community fetch errors
          }
        })
      );
      setPinnedMap((prev) => ({ ...prev, [key]: pinned }));
    } finally {
      setPinLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  useEffect(() => {
    let mounted = true;
    setIsLoadingForums(true);
    setError(null);
    fetchForums(INFO_COMMUNITY_ID, user?.user_id)
      .then((list) => {
        if (!mounted) return;
        setForums(list);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Unable to load forums.');
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoadingForums(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.user_id]);

  useEffect(() => {
    if (!user?.user_id) {
      setAmbassadorCommunities([]);
      return;
    }
    apiClient
      .get('/fetch_ambassador_communities.php', { params: { user_id: user.user_id } })
      .then((res) => {
        const list = (res.data as any)?.communities || [];
        setAmbassadorCommunities(
          Array.isArray(list)
            ? list.map((c) => ({
                community_id: String(c.community_id ?? c.id ?? ''),
                name: String(c.name ?? 'Community'),
              }))
            : []
        );
      })
      .catch(() => setAmbassadorCommunities([]));
  }, [user?.user_id]);

  useEffect(() => {
    if (!openForumMenuId || !user?.user_id) return;
    apiClient
      .get('/save_check.php', {
        params: { user_id: user.user_id, item_type: 'forum', item_id: openForumMenuId },
      })
      .then((res) => {
        const saved = Boolean((res.data as any)?.saved ?? (res.data as any)?.is_saved);
        setForumSavedMap((prev) => ({ ...prev, [openForumMenuId]: saved }));
      })
      .catch(() => {
        setForumSavedMap((prev) => ({ ...prev, [openForumMenuId]: false }));
      });
  }, [openForumMenuId, user?.user_id]);

  useEffect(() => {
    if (!menuOverlay?.id) return;
    if (ambassadorCommunities.length === 0) return;
    loadPinnedStatus(menuOverlay.id, 'forum');
  }, [menuOverlay?.id, ambassadorCommunities]);

  const sortItems = (items: ForumItem[], criteria: SortKey) => {
    const sorted = [...items];
    if (criteria === 'popularity') {
      sorted.sort(
        (a, b) =>
          (Number(b.upvotes) + Number(b.downvotes) || 0) -
          (Number(a.upvotes) + Number(a.downvotes) || 0)
      );
    } else if (criteria === 'mostUpvoted') {
      sorted.sort((a, b) => Number(b.upvotes) - Number(a.upvotes));
    } else if (criteria === 'mostRecent') {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    }
    return sorted;
  };

  const sortedForums = sortItems(forums, sortBy);

  const topicOptions = useMemo(() => {
    const optionMap = new Map(
      (tagOptions || []).map((opt) => [normalizeTopicValue(opt.slug || opt.name), opt.name])
    );

    forums.forEach((forum) => {
      const forumTopics = extractForumTopicsFromForum(forum);
      forumTopics.forEach((topicValue) => {
        if (!optionMap.has(topicValue)) {
          optionMap.set(topicValue, topicLabelFromValue(topicValue));
        }
      });
    });

    return Array.from(optionMap, ([value, label]) => ({ value, label }));
  }, [forums, tagOptions]);

  const topicOptionsWithAll = useMemo(
    () => [{ value: ALL_TOPICS_VALUE, label: 'All tags' }, ...topicOptions],
    [topicOptions]
  );

  const filteredForums = sortedForums.filter((forum) => {
    if (!selectedTopics.length || selectedTopics.includes(ALL_TOPICS_VALUE)) return true;
    const forumTopics = extractForumTopicsFromForum(forum);
    if (!forumTopics.length) return false;
    return forumTopics.some((topicValue) => selectedTopics.includes(topicValue));
  });

  const isAllTopicsSelected =
    selectedTopics.includes(ALL_TOPICS_VALUE) || !selectedTopics.length;

  const selectedTopicLabels = isAllTopicsSelected
    ? 'All tags'
    : selectedTopics
        .map((topic) => {
          const match = topicOptionsWithAll.find((opt) => opt.value === topic);
          return match ? match.label : topicLabelFromValue(topic);
        })
        .join(', ');

  const updateTopicSelection = (nextSelection: string[]) => {
    let normalized = Array.from(
      new Set(nextSelection.filter(Boolean).map(normalizeTopicValue))
    ).filter(Boolean);
    if (!normalized.length || normalized.includes(ALL_TOPICS_VALUE)) {
      normalized = [ALL_TOPICS_VALUE];
    } else {
      normalized = normalized.filter((topic) => topic !== ALL_TOPICS_VALUE);
    }
    setSelectedTopics(normalized);
  };

  const handleTopicToggle = (value: string) => {
    const normalizedValue = normalizeTopicValue(value);
    if (!normalizedValue) return;
    if (normalizedValue === ALL_TOPICS_VALUE) {
      updateTopicSelection([ALL_TOPICS_VALUE]);
      return;
    }
    const withoutAll = selectedTopics.filter((topic) => topic !== ALL_TOPICS_VALUE);
    const hasValue = withoutAll.includes(normalizedValue);
    const next = hasValue
      ? withoutAll.filter((topic) => topic !== normalizedValue)
      : [...withoutAll, normalizedValue];
    updateTopicSelection(next);
  };

  const clearTopicFilter = () => {
    updateTopicSelection([ALL_TOPICS_VALUE]);
  };

  return (
    <AppShell>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.pageTitle}>Info Board</ThemedText>
        </View>
        <ThemedText style={styles.metaText}>
          Welcome back, {user?.first_name ? user.first_name : 'there'}!
        </ThemedText>

        <View style={styles.controlBar}>
          <View style={styles.controlGroup}>
            <View style={styles.controlRow}>
              <ThemedText style={styles.controlLabel}>Sort</ThemedText>
              <Pressable style={styles.sortDropdown} onPress={() => setShowSortMenu((prev) => !prev)}>
              <ThemedText style={styles.sortDropdownLabel}>
                {SORT_OPTIONS.find((opt) => opt.key === sortBy)?.label || 'Most Recent'}
              </ThemedText>
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.subtext} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowTagSelector((prev) => {
                    const next = !prev;
                    if (!next) {
                      setShowFilters(false);
                    }
                    return next;
                  });
                }}
                style={styles.filterIcon}
              >
                <MaterialCommunityIcons
                  name="filter-variant"
                  size={16}
                  color={colors.primaryFrom}
                />
              </Pressable>
            </View>
          </View>

          {showTagSelector ? (
            <View style={styles.controlGroup}>
              <View style={styles.tagSelectorRow}>
                <ThemedText style={styles.controlLabel}>Tags</ThemedText>
                <Pressable
                  style={styles.tagSelector}
                  onPress={() => setShowFilters((prev) => !prev)}
                >
                  <ThemedText style={styles.tagSelectorText}>{selectedTopicLabels}</ThemedText>
                  <MaterialCommunityIcons
                    name={showFilters ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.subtext}
                  />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {showTagSelector && showFilters ? (
          <View style={styles.tagPanel}>
            <View style={styles.tagPanelHeader}>
              <ThemedText style={styles.metaText}>Select tags to filter forums.</ThemedText>
              <Pressable onPress={clearTopicFilter}>
                <ThemedText style={styles.clearText}>Clear</ThemedText>
              </Pressable>
            </View>
            <View style={styles.tagPanelList}>
              {topicOptionsWithAll.map((topicOption) => {
                const checked =
                  selectedTopics.includes(topicOption.value) ||
                  (isAllTopicsSelected && topicOption.value === ALL_TOPICS_VALUE);
                return (
                  <Pressable
                    key={topicOption.value}
                    style={[styles.tagPanelItem, checked && styles.tagPanelItemSelected]}
                    onPress={() => handleTopicToggle(topicOption.value)}
                  >
                    <ThemedText style={[styles.tagPanelText, checked && styles.tagPanelTextSelected]}>
                      {topicOption.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {isLoadingForums ? <ActivityIndicator /> : null}
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        {filteredForums.length === 0 ? (
          <ThemedText style={styles.helper}>No forums match your filters.</ThemedText>
        ) : (
          filteredForums.map((forum) => (
            <Pressable
              key={forum.forum_id}
              style={styles.card}
              onPress={() => router.push(`/info/forum/${forum.forum_id}`)}
            >
              <View style={styles.cardTitleRow}>
                <ThemedText style={styles.cardTitle}>{forum.name || 'Forum'}</ThemedText>
                <Pressable
                  style={styles.kebabButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    const nextId = forum.forum_id;
                    const nextOpen = openForumMenuId !== nextId;
                    setOpenForumMenuId(nextOpen ? nextId : null);
                    setOpenPinForumId(null);
                    setShowSortMenu(false);
                    setMenuOverlay(
                      nextOpen
                        ? { id: nextId, x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }
                        : null
                    );
                  }}
                  accessibilityLabel="Forum menu"
                >
                  <MaterialCommunityIcons name="dots-vertical" size={18} color={colors.subtext} />
                </Pressable>
              </View>
              {forum.description ? (
                <ThemedText style={styles.metaText}>{forum.description}</ThemedText>
              ) : null}
              {Array.isArray(forum.tags) && forum.tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {forum.tags.map((tag) => {
                    const tagStyle = getTagStyle(tag);
                    return (
                      <View
                        key={tag}
                        style={[
                          styles.tagChip,
                          { borderColor: tagStyle.borderColor, backgroundColor: tagStyle.backgroundColor },
                        ]}
                      >
                        <ThemedText style={[styles.tagText, { color: tagStyle.color }]}>{tag}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {forum.created_by ? (
                <View style={styles.createdByRow}>
                  <ThemedText style={styles.metaText}>Created by</ThemedText>
                  <Image
                    source={{ uri: buildAvatarSrc(forum.created_by_avatar_path) }}
                    style={styles.createdByAvatar}
                  />
                  <Pressable onPress={() => router.push(`/user/${forum.created_by}`)}>
                    <ThemedText style={styles.createdByName}>
                      {forum.created_by_first_name || 'User'} {forum.created_by_last_name || ''}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.cardMetaRow}>
                <ThemedText style={styles.metaText}>{forum.thread_count || 0} threads</ThemedText>
                <ThemedText style={styles.metaText}>•</ThemedText>
                <ThemedText style={styles.metaText}>{timeAgo(forum.created_at)}</ThemedText>
              </View>
            </Pressable>
          ))
        )}
        </ScrollView>

        {showSortMenu ? (
          <View style={styles.overlayRoot} pointerEvents="box-none">
            <Pressable style={styles.overlayBackdrop} onPress={() => setShowSortMenu(false)} />
            <View style={styles.overlayCard}>
              {SORT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={styles.sortMenuItem}
                  onPress={() => {
                    setSortBy(opt.key);
                    setShowSortMenu(false);
                  }}
                >
                  <MaterialCommunityIcons
                    name={sortBy === opt.key ? 'radiobox-marked' : 'radiobox-blank'}
                    size={16}
                    color={colors.primaryFrom}
                  />
                  <ThemedText style={styles.sortMenuText}>{opt.label}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {menuOverlay ? (
          <View style={styles.menuOverlayRoot} pointerEvents="box-none">
            <Pressable
              style={styles.menuOverlayBackdrop}
              onPress={() => {
                setMenuOverlay(null);
                setOpenForumMenuId(null);
                setOpenPinForumId(null);
              }}
            />
            <View
              style={[
                styles.menuOverlayCard,
                (() => {
                  const menuWidth = 240;
                  const left = Math.min(
                    Math.max(12, menuOverlay.x - menuWidth + 24),
                    screenWidth - menuWidth - 12
                  );
                  const top = Math.min(menuOverlay.y + 8, screenHeight - 260);
                  return { left, top, width: menuWidth };
                })(),
              ]}
            >
              {ambassadorCommunities.length > 0 ? (
                <View>
                  {(() => {
                    const key = buildPinKey(menuOverlay.id, 'forum');
                    const hasStatus = Object.prototype.hasOwnProperty.call(pinnedMap, key);
                    const pinnedOptions = hasStatus ? pinnedMap[key] : [];
                    const pinOptions = ambassadorCommunities.filter(
                      (community) =>
                        !pinnedOptions.some((pinned) => pinned.community_id === community.community_id)
                    );
                    const showUnpin = pinnedOptions.length > 0;
                    const showPin = pinnedOptions.length === 0 && pinOptions.length > 0;
                    const isLoading = pinLoadingMap[key] || !hasStatus;

                    if (isLoading) {
                      return (
                        <View style={styles.menuItem}>
                          <ThemedText style={styles.menuText}>Loading pin options…</ThemedText>
                        </View>
                      );
                    }

                    if (!showUnpin && !showPin) return null;

                    return (
                      <>
                        <Pressable
                          style={styles.menuItem}
                          onPress={() =>
                            setOpenPinForumId((prev) => (prev === menuOverlay.id ? null : menuOverlay.id))
                          }
                        >
                          <ThemedText style={styles.menuText}>
                            {showUnpin ? 'Unpin from Community' : 'Pin to Community'}
                          </ThemedText>
                          <MaterialCommunityIcons
                            name={openPinForumId === menuOverlay.id ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.subtext}
                          />
                        </Pressable>
                        {openPinForumId === menuOverlay.id ? (
                          <View style={styles.menuSubList}>
                            {(showUnpin ? pinnedOptions : pinOptions).map((community) => (
                              <Pressable
                                key={community.community_id}
                                style={styles.subMenuItem}
                                onPress={async () => {
                                  try {
                                    if (showUnpin && 'pin_id' in community) {
                                      await apiClient.post('/unpin_from_community.php', {
                                        pin_id: (community as any).pin_id,
                                      });
                                      setPinnedMap((prev) => {
                                        const current = prev[key] || [];
                                        return {
                                          ...prev,
                                          [key]: current.filter(
                                            (pinned) => pinned.pin_id !== (community as any).pin_id
                                          ),
                                        };
                                      });
                                    } else {
                                      const res = await apiClient.post('/pin_to_community.php', {
                                        community_id: community.community_id,
                                        item_id: menuOverlay.id,
                                        item_type: 'forum',
                                      });
                                      const pinId = String((res.data as any)?.pin_id || '');
                                      if (pinId) {
                                        setPinnedMap((prev) => {
                                          const current = prev[key] || [];
                                          if (current.some((pinned) => pinned.community_id === community.community_id)) {
                                            return prev;
                                          }
                                          return {
                                            ...prev,
                                            [key]: [
                                              ...current,
                                              { community_id: community.community_id, name: community.name, pin_id: pinId },
                                            ],
                                          };
                                        });
                                      }
                                    }
                                    setMenuOverlay(null);
                                    setOpenForumMenuId(null);
                                    setOpenPinForumId(null);
                                  } catch {
                                    setError(showUnpin ? 'Unable to unpin forum.' : 'Unable to pin forum.');
                                  }
                                }}
                              >
                                <ThemedText style={styles.subMenuText}>{community.name}</ThemedText>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </>
                    );
                  })()}
                </View>
              ) : null}

              {user?.user_id ? (
                <Pressable
                  style={styles.menuItem}
                  onPress={async () => {
                    const saved = Boolean(forumSavedMap[menuOverlay.id]);
                    try {
                      await apiClient.post(saved ? '/unsave_forum.php' : '/save_forum.php', {
                        user_id: user.user_id,
                        forum_id: menuOverlay.id,
                      });
                      setForumSavedMap((prev) => ({ ...prev, [menuOverlay.id]: !saved }));
                      setMenuOverlay(null);
                      setOpenForumMenuId(null);
                    } catch {
                      setError('Unable to update saved forum.');
                    }
                  }}
                >
                  <ThemedText style={styles.menuText}>
                    {forumSavedMap[menuOverlay.id] ? 'Unsave' : 'Save'}
                  </ThemedText>
                </Pressable>
              ) : null}

              <Pressable
                style={styles.menuItem}
                onPress={async () => {
                  if (!user?.user_id) {
                    setMenuOverlay(null);
                    setOpenForumMenuId(null);
                    openLockedFeature('Reporting');
                    return;
                  }
                  try {
                    await apiClient.post('/submit_report.php', {
                      item_type: 'forum',
                      item_id: menuOverlay.id,
                      reason_code: 'other',
                      reason_text: 'Reported from mobile',
                    });
                    setMenuOverlay(null);
                    setOpenForumMenuId(null);
                  } catch {
                    setError('Unable to submit report.');
                  }
                }}
              >
                <ThemedText style={styles.menuText}>Report</ThemedText>
              </Pressable>

              {isSuperAdmin(user?.role_id) ? (
                <>
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuOverlay(null);
                      setOpenForumMenuId(null);
                      setError('Editing forums is not yet available on mobile.');
                    }}
                  >
                    <ThemedText style={styles.menuText}>Edit</ThemedText>
                  </Pressable>
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      Alert.alert('Delete forum?', 'This cannot be undone.', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await apiClient.post('/delete_forum.php', { forum_id: menuOverlay.id });
                              setForums((prev) => prev.filter((f) => f.forum_id !== menuOverlay.id));
                            } catch {
                              setError('Unable to delete forum.');
                            } finally {
                              setMenuOverlay(null);
                              setOpenForumMenuId(null);
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    <ThemedText style={[styles.menuText, styles.menuTextDanger]}>Delete</ThemedText>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </AppShell>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: Brand.spacing.lg,
    gap: 16,
  },
  header: {
    gap: 6,
  },
  pageTitle: {
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
    color: colors.subtext,
  },
  controlBar: {
    gap: 16,
  },
  controlGroup: {
    gap: 8,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtext,
  },
  filterIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  sortDropdownLabel: {
    fontSize: 12,
    color: colors.subtext,
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'flex-start',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  overlayCard: {
    marginHorizontal: Brand.spacing.lg,
    marginTop: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 8,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  sortMenuText: {
    fontSize: 13,
    color: colors.text,
  },
  tagSelector: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  tagSelectorText: {
    fontSize: 13,
    color: colors.text,
  },
  tagSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tagPanel: {
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    gap: 10,
  },
  tagPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagPanelList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPanelItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: hexToRgba(colors.text, 0.04),
  },
  tagPanelItemSelected: {
    borderColor: colors.primaryFrom,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
  },
  tagPanelText: {
    fontSize: 12,
    color: colors.text,
  },
  tagPanelTextSelected: {
    color: colors.primaryFrom,
    fontWeight: '600',
  },
  clearText: {
    fontSize: 12,
    color: colors.primaryFrom,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
  },
  helper: {
    color: colors.subtext,
  },
  card: {
    padding: 12,
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  kebabButton: {
    padding: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  createdByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  createdByAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  createdByName: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  menuOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  menuOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  menuOverlayCard: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  menuText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  menuTextDanger: {
    color: colors.danger,
  },
  menuSubList: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 6,
    gap: 4,
  },
  subMenuItem: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  subMenuText: {
    fontSize: 12,
    color: colors.text,
  },
});
