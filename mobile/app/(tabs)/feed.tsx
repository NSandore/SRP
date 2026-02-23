import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { isSuperAdmin } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import useTagOptions from '@/hooks/use-tag-options';
import { fetchExplore, fetchFeed } from '@/lib/api/feed';
import { apiClient } from '@/lib/api/client';
import { voteThread } from '@/lib/api/thread';
import { timeAgo } from '@/lib/utils/time';
import { getTagStyle } from '@/lib/utils/tags';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { loadStoredDefaultFeed } from '@/lib/storage';

const FEED_TABS = [
  { key: 'yourFeed', label: 'Your Feed' },
  { key: 'explore', label: 'Explore' },
] as const;

const CONTENT_TABS = [
  { key: 'forums', label: 'Forums' },
  { key: 'threads', label: 'Threads' },
] as const;

type FeedTab = (typeof FEED_TABS)[number]['key'];
type ContentTab = (typeof CONTENT_TABS)[number]['key'];

type ThreadItem = any;

type ForumItem = any;

const applyVote = (thread: ThreadItem, voteType: 'up' | 'down') => {
  let upvotes = Number(thread.upvotes) || 0;
  let downvotes = Number(thread.downvotes) || 0;
  let userVote = thread.user_vote || null;

  if (userVote === voteType) {
    if (voteType === 'up') upvotes -= 1;
    else downvotes -= 1;
    userVote = null;
  } else if (userVote && userVote !== voteType) {
    if (voteType === 'up') {
      upvotes += 1;
      downvotes -= 1;
    } else {
      downvotes += 1;
      upvotes -= 1;
    }
    userVote = voteType;
  } else {
    if (voteType === 'up') upvotes += 1;
    else downvotes += 1;
    userVote = voteType;
  }

  return { ...thread, upvotes, downvotes, user_vote: userVote };
};

export default function FeedScreen() {
  const { user, isLoading } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { tags: tagOptions } = useTagOptions();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [activeFeed, setActiveFeed] = useState<FeedTab>(user ? 'yourFeed' : 'explore');
  const [yourFeedView, setYourFeedView] = useState<ContentTab>('forums');
  const [exploreView, setExploreView] = useState<ContentTab>('forums');
  const [exploreTags, setExploreTags] = useState<string[]>(['__all__']);
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [feedThreads, setFeedThreads] = useState<ThreadItem[]>([]);
  const [feedForums, setFeedForums] = useState<ForumItem[]>([]);
  const [exploreThreads, setExploreThreads] = useState<ThreadItem[]>([]);
  const [exploreForums, setExploreForums] = useState<ForumItem[]>([]);
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
  const [openThreadMenuId, setOpenThreadMenuId] = useState<string | null>(null);
  const [threadSavedMap, setThreadSavedMap] = useState<Record<string, boolean>>({});
  const [openPinThreadId, setOpenPinThreadId] = useState<string | null>(null);
  const [menuOverlay, setMenuOverlay] = useState<{
    type: 'forum' | 'thread';
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedSegWidth, setFeedSegWidth] = useState(0);
  const [contentSegWidth, setContentSegWidth] = useState(0);
  const feedSegAnim = useRef(new Animated.Value(0)).current;
  const contentSegAnim = useRef(new Animated.Value(0)).current;
  const activeContentTab = activeFeed === 'yourFeed' ? yourFeedView : exploreView;
  const appliedDefaultRef = useRef(false);

  useEffect(() => {
    if (appliedDefaultRef.current) return;
    let mounted = true;
    loadStoredDefaultFeed()
      .then((value) => {
        if (!mounted || !value) return;
        if (value === 'info') {
          router.replace('/info');
          appliedDefaultRef.current = true;
          return;
        }
        if (value === 'yourFeed' && !user?.user_id) {
          setActiveFeed('explore');
        } else if (value === 'yourFeed' || value === 'explore') {
          setActiveFeed(value as FeedTab);
        }
        appliedDefaultRef.current = true;
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [router, user?.user_id]);

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
    if (!user && activeFeed === 'yourFeed') {
      setActiveFeed('explore');
    }
  }, [user, activeFeed]);

  useEffect(() => {
    const index = activeFeed === 'yourFeed' ? 0 : 1;
    Animated.timing(feedSegAnim, {
      toValue: index,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeFeed, feedSegAnim]);

  useEffect(() => {
    const index = activeContentTab === 'forums' ? 0 : 1;
    Animated.timing(contentSegAnim, {
      toValue: index,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeContentTab, contentSegAnim]);

  const exploreTagOptions = useMemo(
    () => (tagOptions || []).map((opt) => ({ value: opt.slug, label: opt.name })),
    [tagOptions]
  );

  const exploreLabelText = useMemo(() => {
    if (!exploreTags.length || exploreTags.includes('__all__')) return 'All tags';
    const labels = exploreTags
      .map((slug) => exploreTagOptions.find((opt) => opt.value === slug)?.label || slug)
      .filter(Boolean);
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
  }, [exploreTags, exploreTagOptions]);

  useEffect(() => {
    let isMounted = true;
    setError(null);
    if (activeFeed === 'yourFeed') {
      if (!user) return;
      setIsFetching(true);
      fetchFeed(user.user_id)
        .then((resp) => {
          if (!isMounted) return;
          setFeedThreads(resp.threads || []);
          setFeedForums(resp.forums || []);
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err?.response?.data?.error || 'Unable to load your feed.');
        })
        .finally(() => {
          if (!isMounted) return;
          setIsFetching(false);
        });
      return;
    }

    setIsFetching(true);
    const tagsParam = exploreTags.includes('__all__') ? [] : exploreTags;
    fetchExplore(tagsParam)
      .then((resp) => {
        if (!isMounted) return;
        setExploreForums(resp.forums || []);
        setExploreThreads(resp.threads || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.response?.data?.error || 'Unable to load explore content.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsFetching(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeFeed, user, exploreTags]);

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
    if (!openThreadMenuId || !user?.user_id) return;
    apiClient
      .get('/save_check.php', {
        params: { user_id: user.user_id, item_type: 'thread', item_id: openThreadMenuId },
      })
      .then((res) => {
        const saved = Boolean((res.data as any)?.saved ?? (res.data as any)?.is_saved);
        setThreadSavedMap((prev) => ({ ...prev, [openThreadMenuId]: saved }));
      })
      .catch(() => {
        setThreadSavedMap((prev) => ({ ...prev, [openThreadMenuId]: false }));
      });
  }, [openThreadMenuId, user?.user_id]);

  useEffect(() => {
    if (!menuOverlay?.id) return;
    if (ambassadorCommunities.length === 0) return;
    loadPinnedStatus(menuOverlay.id, menuOverlay.type);
  }, [menuOverlay?.id, menuOverlay?.type, ambassadorCommunities]);

  const handleThreadVote = async (threadId: string, voteType: 'up' | 'down', scope: 'feed' | 'explore') => {
    if (!user?.user_id) {
      openLockedFeature('Voting');
      return;
    }
    try {
      await voteThread(threadId, user.user_id, voteType);
      const update = (list: ThreadItem[]) =>
        list.map((thread) =>
          thread.thread_id === threadId ? applyVote(thread, voteType) : thread
        );
      if (scope === 'feed') {
        setFeedThreads((prev) => update(prev));
      } else {
        setExploreThreads((prev) => update(prev));
      }
    } catch {
      setError('Unable to update vote.');
    }
  };

  const renderThreadCard = (thread: ThreadItem, scope: 'feed' | 'explore') => {
    const hasUpvoted = thread.user_vote === 'up';
    const hasDownvoted = thread.user_vote === 'down';
    const comments = thread.post_count || thread.comment_count || 0;

    return (
      <Pressable
        key={thread.thread_id}
        style={styles.card}
        onPress={() => router.push(`/thread/${thread.thread_id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <ThemedText style={styles.cardTitle}>{thread.title || 'Untitled Thread'}</ThemedText>
            <Pressable
              style={styles.kebabButton}
              onPress={(event) => {
                event.stopPropagation();
                const nextId = thread.thread_id;
                const nextOpen = openThreadMenuId !== nextId;
                setOpenThreadMenuId(nextOpen ? nextId : null);
                setOpenPinThreadId(null);
                setOpenForumMenuId(null);
                setOpenPinForumId(null);
                setMenuOverlay(
                  nextOpen
                    ? {
                        type: 'thread',
                        id: nextId,
                        x: event.nativeEvent.pageX,
                        y: event.nativeEvent.pageY,
                      }
                    : null
                );
              }}
              accessibilityLabel="Thread menu"
            >
              <MaterialCommunityIcons name="dots-vertical" size={18} color={colors.subtext} />
            </Pressable>
          </View>
          <View style={styles.cardMetaRow}>
            <ThemedText style={styles.metaText}>{thread.community_name || thread.forum_name || 'Community'}</ThemedText>
            <ThemedText style={styles.metaText}>•</ThemedText>
            <ThemedText style={styles.metaText}>{timeAgo(thread.created_at)}</ThemedText>
          </View>
        </View>

        {null}

        {Array.isArray(thread.tags) && thread.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {thread.tags.map((tag: string) => {
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

        <View style={styles.voteRow}>
          <Pressable onPress={() => handleThreadVote(thread.thread_id, 'up', scope)} style={styles.voteButton}>
            <MaterialCommunityIcons
              name={hasUpvoted ? 'arrow-up-bold' : 'arrow-up-bold-outline'}
              size={20}
              color={hasUpvoted ? '#16a34a' : colors.subtext}
            />
          </Pressable>
          <ThemedText style={styles.voteCount}>{Number(thread.upvotes) || 0}</ThemedText>
          <Pressable onPress={() => handleThreadVote(thread.thread_id, 'down', scope)} style={styles.voteButton}>
            <MaterialCommunityIcons
              name={hasDownvoted ? 'arrow-down-bold' : 'arrow-down-bold-outline'}
              size={20}
              color={hasDownvoted ? '#dc2626' : colors.subtext}
            />
          </Pressable>
          <ThemedText style={styles.voteCount}>{Number(thread.downvotes) || 0}</ThemedText>
          <MaterialCommunityIcons name="message-outline" size={18} color={colors.subtext} />
          <ThemedText style={styles.voteCount}>{comments}</ThemedText>
        </View>
      </Pressable>
    );
  };

  const renderForumCard = (forum: ForumItem) => (
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
            setOpenThreadMenuId(null);
            setOpenPinThreadId(null);
            setMenuOverlay(
              nextOpen
                ? {
                    type: 'forum',
                    id: nextId,
                    x: event.nativeEvent.pageX,
                    y: event.nativeEvent.pageY,
                  }
                : null
            );
          }}
          accessibilityLabel="Forum menu"
        >
          <MaterialCommunityIcons name="dots-vertical" size={18} color={colors.subtext} />
        </Pressable>
      </View>

      {null}

      {Array.isArray(forum.tags) && forum.tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {forum.tags.map((tag: string) => {
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
      {forum.description ? <ThemedText style={styles.metaText}>{forum.description}</ThemedText> : null}
      <View style={styles.cardMetaRow}>
        <ThemedText style={styles.metaText}>{forum.thread_count || 0} threads</ThemedText>
        <ThemedText style={styles.metaText}>•</ThemedText>
        <ThemedText style={styles.metaText}>{timeAgo(forum.created_at)}</ThemedText>
      </View>
    </Pressable>
  );

  const currentThreads = activeFeed === 'yourFeed' ? feedThreads : exploreThreads;
  const currentForums = activeFeed === 'yourFeed' ? feedForums : exploreForums;

  const isEmpty = activeContentTab === 'threads' ? currentThreads.length === 0 : currentForums.length === 0;

  return (
    <AppShell>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <ThemedText type="title">{activeFeed === 'yourFeed' ? 'Your Feed' : 'Explore'}</ThemedText>
          <ThemedText style={styles.metaText}>
            Welcome back, {user?.first_name ? user.first_name : 'there'}!
          </ThemedText>
        </View>

        <View style={styles.topControls}>
          <View
            style={styles.segmentControl}
            onLayout={(event) => setFeedSegWidth(event.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.segmentIndicator,
                {
                  width: feedSegWidth ? feedSegWidth / 2 - 6 : 0,
                  transform: [
                    {
                      translateX: feedSegAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [3, feedSegWidth / 2 + 3],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={styles.segmentPillBackground} />
            {FEED_TABS.map((tab, index) => (
              <Pressable
                key={tab.key}
                style={[
                  styles.segmentButton,
                  index === 0 ? styles.segmentButtonLeft : styles.segmentButtonRight,
                  !user && tab.key === 'yourFeed' && styles.segmentButtonDisabled,
                ]}
                onPress={() => {
                  if (!user && tab.key === 'yourFeed') {
                    openLockedFeature('Your Feed');
                    return;
                  }
                  setActiveFeed(tab.key);
                }}
              >
                <ThemedText
                  style={[
                    styles.segmentButtonText,
                    activeFeed === tab.key && styles.segmentButtonTextActive,
                    !user && tab.key === 'yourFeed' && styles.segmentTextDisabled,
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.filterButtonInline}
            onPress={() =>
              setShowFilters((prev) => {
                if (prev) {
                  setShowTagPanel(false);
                }
                return !prev;
              })
            }
            accessibilityLabel="Toggle filters"
          >
            <MaterialCommunityIcons name="filter-variant" size={16} color={colors.primaryFrom} />
          </Pressable>
        </View>

        {showFilters ? (
          <View style={styles.filterBar}>
            <View style={styles.filterGroup}>
              <ThemedText style={styles.filterLabel}>Content</ThemedText>
              <View
                style={styles.segmentControlSmall}
                onLayout={(event) => setContentSegWidth(event.nativeEvent.layout.width)}
              >
                <Animated.View
                  style={[
                    styles.segmentIndicatorSmall,
                    {
                      width: contentSegWidth ? contentSegWidth / 2 - 6 : 0,
                      transform: [
                        {
                          translateX: contentSegAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [3, contentSegWidth / 2 + 3],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                {CONTENT_TABS.map((tab, index) => (
                  <Pressable
                    key={tab.key}
                    style={[
                      styles.segmentButtonSmall,
                      index === 0 ? styles.segmentButtonLeft : styles.segmentButtonRight,
                    ]}
                    onPress={() =>
                      activeFeed === 'yourFeed'
                        ? setYourFeedView(tab.key)
                        : setExploreView(tab.key)
                    }
                  >
                    <ThemedText
                      style={[
                        styles.segmentButtonTextSmall,
                        activeContentTab === tab.key && styles.segmentButtonTextActive,
                      ]}
                    >
                      {tab.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {activeFeed === 'explore' ? (
              <View style={styles.filterGroup}>
                <ThemedText style={styles.filterLabel}>Tags</ThemedText>
                <Pressable
                  style={styles.tagSelector}
                  onPress={() => setShowTagPanel((prev) => !prev)}
                >
                  <ThemedText style={styles.tagSelectorText}>{exploreLabelText}</ThemedText>
                  <MaterialCommunityIcons name={showTagPanel ? 'chevron-up' : 'chevron-down'} size={18} color={colors.subtext} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {showTagPanel && activeFeed === 'explore' ? (
          <View style={styles.tagPanel}>
            <View style={styles.tagPanelHeader}>
              <ThemedText style={styles.metaText}>Select tags to refine Explore.</ThemedText>
              <Pressable
                onPress={() => setExploreTags(['__all__'])}
                disabled={exploreTags.length === 0 || exploreTags.includes('__all__')}
              >
                <ThemedText
                  style={[
                    styles.clearText,
                    (exploreTags.length === 0 || exploreTags.includes('__all__')) && styles.clearTextDisabled,
                  ]}
                >
                  Clear
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.tagPanelList}>
              <Pressable
                style={[
                  styles.tagPanelItem,
                  (exploreTags.length === 0 || exploreTags.includes('__all__')) && styles.tagPanelItemSelected,
                ]}
                onPress={() => setExploreTags(['__all__'])}
              >
                <ThemedText
                  style={[
                    styles.tagPanelText,
                    (exploreTags.length === 0 || exploreTags.includes('__all__')) && styles.tagPanelTextSelected,
                  ]}
                >
                  All Tags
                </ThemedText>
              </Pressable>
              {exploreTagOptions.map((tag) => {
                const isSelected = exploreTags.includes(tag.value);
                return (
                  <Pressable
                    key={tag.value}
                    style={[styles.tagPanelItem, isSelected && styles.tagPanelItemSelected]}
                    onPress={() =>
                      setExploreTags((prev) =>
                        prev.includes(tag.value)
                          ? prev.filter((t) => t !== tag.value && t !== '__all__')
                          : [...prev.filter((t) => t !== '__all__'), tag.value]
                      )
                    }
                  >
                    <ThemedText style={[styles.tagPanelText, isSelected && styles.tagPanelTextSelected]}>
                      {tag.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {isFetching ? <ActivityIndicator /> : null}
        {error && isEmpty ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        {isEmpty ? (
          <ThemedText style={styles.helper}>
            No {activeContentTab === 'threads' ? 'threads' : 'forums'} to show yet.
          </ThemedText>
        ) : null}

        {activeContentTab === 'threads'
          ? currentThreads.map((thread) => renderThreadCard(thread, activeFeed === 'yourFeed' ? 'feed' : 'explore'))
          : currentForums.map(renderForumCard)}
        </ScrollView>

        {menuOverlay ? (
          <View style={styles.menuOverlayRoot} pointerEvents="box-none">
            <Pressable
              style={styles.menuOverlayBackdrop}
              onPress={() => {
                setMenuOverlay(null);
                setOpenForumMenuId(null);
                setOpenThreadMenuId(null);
                setOpenPinForumId(null);
                setOpenPinThreadId(null);
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
              {menuOverlay.type === 'forum' ? (
                <>
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
                                  setFeedForums((prev) => prev.filter((f) => f.forum_id !== menuOverlay.id));
                                  setExploreForums((prev) => prev.filter((f) => f.forum_id !== menuOverlay.id));
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
                </>
              ) : (
                <>
                  {ambassadorCommunities.length > 0 ? (
                    <View>
                      {(() => {
                        const key = buildPinKey(menuOverlay.id, 'thread');
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
                                setOpenPinThreadId((prev) => (prev === menuOverlay.id ? null : menuOverlay.id))
                              }
                            >
                              <ThemedText style={styles.menuText}>
                                {showUnpin ? 'Unpin from Community' : 'Pin to Community'}
                              </ThemedText>
                              <MaterialCommunityIcons
                                name={openPinThreadId === menuOverlay.id ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color={colors.subtext}
                              />
                            </Pressable>
                            {openPinThreadId === menuOverlay.id ? (
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
                                            item_type: 'thread',
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
                                        setOpenThreadMenuId(null);
                                        setOpenPinThreadId(null);
                                      } catch {
                                        setError(showUnpin ? 'Unable to unpin thread.' : 'Unable to pin thread.');
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
                        const saved = Boolean(threadSavedMap[menuOverlay.id]);
                        try {
                          await apiClient.post(saved ? '/unsave_thread.php' : '/save_thread.php', {
                            user_id: user.user_id,
                            thread_id: menuOverlay.id,
                          });
                          setThreadSavedMap((prev) => ({ ...prev, [menuOverlay.id]: !saved }));
                          setMenuOverlay(null);
                          setOpenThreadMenuId(null);
                        } catch {
                          setError('Unable to update saved thread.');
                        }
                      }}
                    >
                      <ThemedText style={styles.menuText}>
                        {threadSavedMap[menuOverlay.id] ? 'Unsave' : 'Save'}
                      </ThemedText>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={styles.menuItem}
                    onPress={async () => {
                      if (!user?.user_id) {
                        setMenuOverlay(null);
                        setOpenThreadMenuId(null);
                        openLockedFeature('Reporting');
                        return;
                      }
                      try {
                        await apiClient.post('/submit_report.php', {
                          item_type: 'thread',
                          item_id: menuOverlay.id,
                          reason_code: 'other',
                          reason_text: 'Reported from mobile',
                        });
                        setMenuOverlay(null);
                        setOpenThreadMenuId(null);
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
                          setOpenThreadMenuId(null);
                          setError('Editing threads is not yet available on mobile.');
                        }}
                      >
                        <ThemedText style={styles.menuText}>Edit</ThemedText>
                      </Pressable>
                      <Pressable
                        style={styles.menuItem}
                        onPress={() => {
                          Alert.alert('Delete thread?', 'This cannot be undone.', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await apiClient.post('/delete_thread.php', { thread_id: menuOverlay.id });
                                  if (activeFeed === 'yourFeed') {
                                    setFeedThreads((prev) => prev.filter((t) => t.thread_id !== menuOverlay.id));
                                  } else {
                                    setExploreThreads((prev) => prev.filter((t) => t.thread_id !== menuOverlay.id));
                                  }
                                } catch {
                                  setError('Unable to delete thread.');
                                } finally {
                                  setMenuOverlay(null);
                                  setOpenThreadMenuId(null);
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
                </>
              )}
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
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hero: {
    gap: 4,
  },
  filterButtonInline: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.text, 0.08),
    padding: 3,
    alignSelf: 'flex-start',
    minWidth: 220,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: 999,
    backgroundColor: colors.primaryFrom,
  },
  segmentPillBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 999,
  },
  segmentButtonLeft: {
    marginRight: 4,
  },
  segmentButtonRight: {
    marginLeft: 4,
  },
  segmentButtonActive: {
    backgroundColor: 'transparent',
  },
  segmentButtonDisabled: {
    backgroundColor: 'transparent',
  },
  segmentButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  segmentButtonTextActive: {
    color: '#fff',
  },
  segmentRowSmall: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentControlSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.text, 0.08),
    padding: 2,
    alignSelf: 'flex-start',
    minWidth: 180,
  },
  segmentIndicatorSmall: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    borderRadius: 999,
    backgroundColor: colors.primaryFrom,
  },
  segmentButtonSmall: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    borderRadius: 999,
  },
  segmentButtonSmallActive: {
    backgroundColor: 'transparent',
  },
  segmentButtonTextSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  segmentChipActive: {
    backgroundColor: colors.primaryFrom,
    borderColor: colors.primaryFrom,
  },
  segmentTextActive: {
    color: '#fff',
  },
  segmentTextDisabled: {
    color: colors.subtext,
  },
  filterBar: {
    gap: 12,
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtext,
  },
  tagSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tagSelectorText: {
    fontSize: 13,
    color: colors.text,
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
  clearTextDisabled: {
    color: colors.subtext,
  },
  error: {
    color: colors.danger,
  },
  helper: {
    color: colors.subtext,
  },
  metaText: {
    fontSize: 12,
    color: colors.subtext,
  },
  card: {
    padding: 12,
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 8,
    position: 'relative',
    zIndex: 1,
  },
  cardHeader: {
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
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
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  voteButton: {
    padding: 4,
  },
  voteCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    minWidth: 18,
  },
});
