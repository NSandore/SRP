import { useMemo, useEffect, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { isSuperAdmin } from '@/constants/roles';
import { apiClient } from '@/lib/api/client';
import { buildAvatarSrc, buildUploadSrc } from '@/lib/uploads';
import { timeAgo } from '@/lib/utils/time';
import { getTagStyle } from '@/lib/utils/tags';
import useTagOptions from '@/hooks/use-tag-options';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { fetchThreads, voteThread } from '@/lib/api/thread';

type ForumData = {
  forum_id: string;
  community_id?: string;
  name?: string;
  description?: string;
  banner_path?: string;
  created_at?: string;
  created_by?: string;
  created_by_first_name?: string;
  created_by_last_name?: string;
  created_by_avatar_path?: string;
  tags?: string[];
};

export default function ForumScreen() {
  const { forumId } = useLocalSearchParams<{ forumId?: string }>();
  const router = useRouter();
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { tags: tagOptions } = useTagOptions();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);
  const [forum, setForum] = useState<ForumData | null>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'mostRecent' | 'popularity' | 'mostUpvoted'>('mostRecent');
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [openThreadMenuId, setOpenThreadMenuId] = useState<string | null>(null);
  const [threadSavedMap, setThreadSavedMap] = useState<Record<string, boolean>>({});
  const [ambassadorCommunities, setAmbassadorCommunities] = useState<
    { community_id: string; name: string }[]
  >([]);
  const [openPinThreadId, setOpenPinThreadId] = useState<string | null>(null);
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
    if (!forumId) return;
    setIsLoading(true);
    apiClient
      .get<ForumData>('/fetch_forum.php', { params: { forum_id: forumId } })
      .then((res) => setForum(res.data))
      .catch(() => setError('Failed to load forum details.'))
      .finally(() => setIsLoading(false));
  }, [forumId]);

  useEffect(() => {
    if (!forumId) return;
    setIsLoadingThreads(true);
    fetchThreads(String(forumId), user?.user_id)
      .then((list) => setThreads(list || []))
      .catch(() => setError('Failed to load threads.'))
      .finally(() => setIsLoadingThreads(false));
  }, [forumId, user?.user_id]);

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
    loadPinnedStatus(menuOverlay.id, 'thread');
  }, [menuOverlay?.id, ambassadorCommunities]);

  const normalizeTagValue = (value: string) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  const activeTagLabel = activeTags.length
    ? `${activeTags.length} tag${activeTags.length === 1 ? '' : 's'} selected`
    : 'All tags';

  const sortedThreads = useMemo(() => {
    const filtered = activeTags.length
      ? threads.filter((thread) => {
          const tags = Array.isArray(thread.tags) ? thread.tags : [];
          const normalized = tags.map((tag: string) => normalizeTagValue(tag));
          return activeTags.some((slug) => normalized.includes(slug));
        })
      : threads;
    const sorted = [...filtered];
    if (sortBy === 'mostUpvoted') {
      sorted.sort((a, b) => (Number(b.upvotes) || 0) - (Number(a.upvotes) || 0));
    } else if (sortBy === 'popularity') {
      sorted.sort(
        (a, b) =>
          (Number(b.upvotes) + Number(b.downvotes) || 0) -
          (Number(a.upvotes) + Number(a.downvotes) || 0)
      );
    } else {
      sorted.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    }
    return sorted;
  }, [threads, sortBy, activeTags]);

  const handleToggleTag = (tag: string) => {
    const slug = normalizeTagValue(tag);
    setActiveTags((prev) =>
      prev.includes(slug) ? prev.filter((value) => value !== slug) : [...prev, slug]
    );
  };

  const handleThreadVote = async (threadId: string, voteType: 'up' | 'down') => {
    if (!user?.user_id) {
      openLockedFeature('Voting');
      return;
    }
    try {
      await voteThread(threadId, user.user_id, voteType);
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.thread_id !== threadId) return thread;
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
        })
      );
    } catch {
      setError('Unable to update vote.');
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </AppShell>
    );
  }

  const bannerSrc = buildUploadSrc(forum?.banner_path || '/uploads/banners/DefaultBanner.jpeg');

  return (
    <AppShell>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <View style={styles.breadcrumbs}>
          <Pressable onPress={() => router.push('/info')}>
            <ThemedText style={styles.breadcrumbText}>Info Board</ThemedText>
          </Pressable>
          <ThemedText style={styles.breadcrumbSep}>/</ThemedText>
          <ThemedText style={styles.breadcrumbText}>
            {forum?.name ? forum.name : `Forum ${forumId || ''}`}
          </ThemedText>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.bannerWrap}>
            <Image source={{ uri: bannerSrc }} style={styles.bannerImage} />
          </View>

          <View style={styles.titleRow}>
            <ThemedText type="title" style={styles.title}>
              {forum?.name ? forum.name : `Forum ${forumId || ''}`}
            </ThemedText>
            <Pressable
              style={styles.tagFilterButton}
              onPress={() => setShowTagFilter((prev) => !prev)}
              accessibilityLabel="Filter by tag"
            >
              <ThemedText style={styles.tagFilterText}>{activeTagLabel}</ThemedText>
              <MaterialCommunityIcons
                name={showTagFilter ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.subtext}
              />
            </Pressable>
          </View>

          {Array.isArray(forum?.tags) && forum.tags.length > 0 ? (
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

          {forum?.description ? (
            <ThemedText style={styles.description}>{forum.description}</ThemedText>
          ) : null}

          {forum?.created_by ? (
            <View style={styles.metaRow}>
              <ThemedText style={styles.metaText}>Created by</ThemedText>
              <Image source={{ uri: buildAvatarSrc(forum.created_by_avatar_path) }} style={styles.metaAvatar} />
              <Pressable onPress={() => router.push(`/user/${forum.created_by}`)}>
                <ThemedText style={styles.metaName}>
                  {forum.created_by_first_name || 'User'} {forum.created_by_last_name || ''}
                </ThemedText>
              </Pressable>
              {forum.created_at ? (
                <ThemedText style={styles.metaText}>· {timeAgo(forum.created_at)}</ThemedText>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Threads</ThemedText>
          <View style={styles.dropdownAnchor}>
            <Pressable
              style={styles.sortDropdown}
              onPress={(event) => {
                setShowSortMenu((prev) => !prev);
                setSortMenuAnchor({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
                setMenuOverlay(null);
                setOpenThreadMenuId(null);
                setOpenPinThreadId(null);
              }}
            >
              <ThemedText style={styles.sortDropdownLabel}>
                {sortBy === 'mostRecent'
                  ? 'Sort by Newest'
                  : sortBy === 'popularity'
                  ? 'Most Popular'
                  : 'Most Upvoted'}
              </ThemedText>
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.subtext} />
            </Pressable>
          </View>
        </View>

        {isLoadingThreads ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator />
          </View>
        ) : sortedThreads.length === 0 ? (
          <View style={styles.emptyCard}>
            <ThemedText style={styles.emptyTitle}>
              {activeTags.length ? 'No threads match these tags.' : 'No threads available.'}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.threadList}>
            {sortedThreads.map((thread) => {
              const hasUpvoted = thread.user_vote === 'up';
              const hasDownvoted = thread.user_vote === 'down';
              const comments = thread.post_count || thread.comment_count || 0;
              return (
                <Pressable
                  key={thread.thread_id}
                  style={styles.threadCard}
                  onPress={() => router.push(`/thread/${thread.thread_id}`)}
                >
                  <View style={styles.threadHeader}>
                    <View style={styles.threadTitleRow}>
                      <ThemedText style={styles.threadTitle}>{thread.title || 'Untitled Thread'}</ThemedText>
                      <Pressable
                        style={styles.kebabButton}
                        onPress={(event) => {
                          event.stopPropagation();
                          const nextId = thread.thread_id;
                          const nextOpen = openThreadMenuId !== nextId;
                          setOpenThreadMenuId(nextOpen ? nextId : null);
                          setOpenPinThreadId(null);
                          setShowSortMenu(false);
                          setMenuOverlay(
                            nextOpen
                              ? {
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
                      <ThemedText style={styles.metaText}>{forum?.name || thread.forum_name || 'Forum'}</ThemedText>
                      <ThemedText style={styles.metaText}>•</ThemedText>
                      <ThemedText style={styles.metaText}>{timeAgo(thread.created_at)}</ThemedText>
                    </View>
                  </View>

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
                    <Pressable onPress={() => handleThreadVote(thread.thread_id, 'up')} style={styles.voteButton}>
                      <MaterialCommunityIcons
                        name={hasUpvoted ? 'arrow-up-bold' : 'arrow-up-bold-outline'}
                        size={20}
                        color={hasUpvoted ? '#16a34a' : colors.subtext}
                      />
                    </Pressable>
                    <ThemedText style={styles.voteCount}>{Number(thread.upvotes) || 0}</ThemedText>
                    <Pressable onPress={() => handleThreadVote(thread.thread_id, 'down')} style={styles.voteButton}>
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
            })}
          </View>
        )}
        </ScrollView>

        {showTagFilter ? (
          <View style={styles.overlayRoot} pointerEvents="box-none">
            <Pressable style={styles.overlayBackdrop} onPress={() => setShowTagFilter(false)} />
            <View style={styles.overlayCard}>
              <View style={styles.tagPanelHeader}>
                <ThemedText style={styles.metaText}>Select tags to filter threads.</ThemedText>
                <Pressable onPress={() => setActiveTags([])} disabled={activeTags.length === 0}>
                  <ThemedText style={[styles.clearText, activeTags.length === 0 && styles.clearTextDisabled]}>
                    Clear
                  </ThemedText>
                </Pressable>
              </View>
              <View style={styles.tagPanelList}>
                <Pressable
                  style={[
                    styles.tagPanelItem,
                    activeTags.length === 0 && styles.tagPanelItemSelected,
                  ]}
                  onPress={() => setActiveTags([])}
                >
                  <ThemedText
                    style={[
                      styles.tagPanelText,
                      activeTags.length === 0 && styles.tagPanelTextSelected,
                    ]}
                  >
                    All Tags
                  </ThemedText>
                </Pressable>
                {(tagOptions || []).map((opt) => {
                  const slug = normalizeTagValue(opt.slug || opt.name || '');
                  const isActive = activeTags.includes(slug);
                  return (
                    <Pressable
                      key={opt.slug || opt.name}
                      style={[styles.tagPanelItem, isActive && styles.tagPanelItemSelected]}
                      onPress={() => handleToggleTag(opt.slug || opt.name || '')}
                    >
                      <ThemedText
                        style={[styles.tagPanelText, isActive && styles.tagPanelTextSelected]}
                      >
                        {opt.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {menuOverlay ? (
          <View style={styles.menuOverlayRoot} pointerEvents="box-none">
            <Pressable
              style={styles.menuOverlayBackdrop}
              onPress={() => {
                setMenuOverlay(null);
                setOpenThreadMenuId(null);
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
                              setThreads((prev) => prev.filter((t) => t.thread_id !== menuOverlay.id));
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
            </View>
          </View>
        ) : null}
        {showSortMenu ? (
          <View style={styles.menuOverlayRoot} pointerEvents="box-none">
            <Pressable style={styles.menuOverlayBackdrop} onPress={() => setShowSortMenu(false)} />
            <View
              style={[
                styles.menuOverlayCard,
                (() => {
                  const menuWidth = 220;
                  const left = Math.min(
                    Math.max(12, (sortMenuAnchor?.x ?? 24) - menuWidth + 24),
                    screenWidth - menuWidth - 12
                  );
                  const top = Math.min((sortMenuAnchor?.y ?? 220) + 8, screenHeight - 260);
                  return { left, top, width: menuWidth };
                })(),
              ]}
            >
              {[
                { key: 'mostRecent', label: 'Sort by Newest' },
                { key: 'mostUpvoted', label: 'Most Upvoted' },
                { key: 'popularity', label: 'Most Popular' },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setSortBy(opt.key as any);
                    setShowSortMenu(false);
                  }}
                  style={styles.menuItem}
                >
                  <MaterialCommunityIcons
                    name={sortBy === opt.key ? 'radiobox-marked' : 'radiobox-blank'}
                    size={16}
                    color={colors.primaryFrom}
                  />
                  <ThemedText style={styles.menuText}>{opt.label}</ThemedText>
                </Pressable>
              ))}
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
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: colors.danger,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbText: {
    fontSize: 12,
    color: colors.subtext,
  },
  breadcrumbSep: {
    color: colors.subtext,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  bannerWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: hexToRgba(colors.text, 0.05),
  },
  bannerImage: {
    width: '100%',
    height: 140,
  },
  titleRow: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    color: colors.subtext,
  },
  metaName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  metaAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: hexToRgba(colors.subtext, 0.2),
  },
  tagFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tagFilterText: {
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
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 8,
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
  sectionHeader: {
    marginTop: 8,
    flexDirection: 'column',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  dropdownAnchor: {
    alignSelf: 'flex-start',
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
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: colors.subtext,
  },
  threadList: {
    gap: 12,
  },
  threadCard: {
    backgroundColor: colors.card,
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  threadHeader: {
    gap: 4,
  },
  threadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  kebabButton: {
    padding: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
