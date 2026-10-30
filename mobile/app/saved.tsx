import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { apiClient } from '@/lib/api/client';

type SavedForum = {
  forum_id: string;
  community_id?: string;
  community_name?: string;
  name?: string;
  description?: string;
  saved_at?: string;
};

type SavedThread = {
  thread_id: string;
  forum_id?: string;
  forum_name?: string;
  title?: string;
  first_post_content?: string;
  saved_at?: string;
};

type SavedPost = {
  post_id: string;
  content?: string;
  verified?: string | number;
  thread_id?: string;
  forum_id?: string;
  forum_name?: string;
  thread_title?: string;
  original_post_content?: string;
  saved_at?: string;
};

const SAVED_CARD_MAX_CHARS = 50;

const stripHtml = (value = '') => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const summarizeContent = (value = '', maxLength = 200) => {
  const plain = stripHtml(value);
  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}...`;
};

const summarizeWithEllipsis = (value = '', maxLength = 200) => {
  const summary = summarizeContent(value, maxLength);
  if (!summary) return '';
  return summary.endsWith('...') ? summary : `${summary}...`;
};

const formatSavedAt = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const SAVED_TABS = [
  { key: 'forums', label: 'Forums' },
  { key: 'threads', label: 'Threads' },
  { key: 'posts', label: 'Comments' },
] as const;

type SavedTab = (typeof SAVED_TABS)[number]['key'];

export default function SavedScreen() {
  const { user, isLoading } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const router = useRouter();
  const userId = user?.user_id ? String(user.user_id) : '';
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [savedTab, setSavedTab] = useState<SavedTab>('forums');
  const [savedForums, setSavedForums] = useState<SavedForum[]>([]);
  const [savedThreads, setSavedThreads] = useState<SavedThread[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const segmentAnim = useRef(new Animated.Value(0)).current;
  const [actionMap, setActionMap] = useState<Record<string, boolean>>({});

  const activeCount = useMemo(() => {
    if (savedTab === 'forums') return savedForums.length;
    if (savedTab === 'threads') return savedThreads.length;
    return savedPosts.length;
  }, [savedForums.length, savedThreads.length, savedPosts.length, savedTab]);

  const metrics = useMemo(
    () => [
      { key: 'forums' as const, label: 'Forums', count: savedForums.length },
      { key: 'threads' as const, label: 'Threads', count: savedThreads.length },
      { key: 'posts' as const, label: 'Comments', count: savedPosts.length },
    ],
    [savedForums.length, savedThreads.length, savedPosts.length]
  );

  useEffect(() => {
    const index = savedTab === 'forums' ? 0 : savedTab === 'threads' ? 1 : 2;
    Animated.timing(segmentAnim, {
      toValue: index,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [savedTab, segmentAnim]);

  useEffect(() => {
    if (isLoading) return;
    if (!userId) {
      openLockedFeature('Saved');
    }
  }, [userId, isLoading, openLockedFeature]);

  useEffect(() => {
    if (!userId) {
      setSavedForums([]);
      setSavedThreads([]);
      setSavedPosts([]);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get('/fetch_saved_forums.php', { params: { user_id: userId } }),
      apiClient.get('/fetch_saved_threads.php', { params: { user_id: userId } }),
      apiClient.get('/fetch_saved_posts.php', { params: { user_id: userId } }),
    ])
      .then(([forumsRes, threadsRes, postsRes]) => {
        if (!mounted) return;
        const forumsRaw = (forumsRes.data as any)?.saved_forums ?? [];
        const threadsRaw = (threadsRes.data as any)?.saved_threads ?? [];
        const postsRaw = (postsRes.data as any)?.saved_posts ?? [];

        setSavedForums(
          Array.isArray(forumsRaw)
            ? forumsRaw.map((f: any) => ({
                forum_id: String(f.forum_id ?? ''),
                community_id: f.community_id ? String(f.community_id) : '',
                community_name: f.community_name || '',
                name: f.name || '',
                description: f.description || '',
                saved_at: f.saved_at || '',
              }))
            : []
        );
        setSavedThreads(
          Array.isArray(threadsRaw)
            ? threadsRaw.map((t: any) => ({
                thread_id: String(t.thread_id ?? ''),
                forum_id: t.forum_id ? String(t.forum_id) : '',
                forum_name: t.forum_name || '',
                title: t.title || '',
                first_post_content: t.first_post_content || '',
                saved_at: t.saved_at || '',
              }))
            : []
        );
        setSavedPosts(
          Array.isArray(postsRaw)
            ? postsRaw.map((p: any) => ({
                post_id: String(p.post_id ?? ''),
                content: p.content || '',
                verified: p.verified,
                thread_id: p.thread_id ? String(p.thread_id) : '',
                forum_id: p.forum_id ? String(p.forum_id) : '',
                forum_name: p.forum_name || '',
                thread_title: p.thread_title || '',
                original_post_content: p.original_post_content || '',
                saved_at: p.saved_at || '',
              }))
            : []
        );
      })
      .catch(() => {
        if (!mounted) return;
        setError('Unable to load saved content.');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleUnsaveForum = async (forumId: string) => {
    if (!userId || !forumId) return;
    const key = `forum-${forumId}`;
    if (actionMap[key]) return;
    setActionMap((prev) => ({ ...prev, [key]: true }));
    try {
      await apiClient.post('/unsave_forum.php', { user_id: userId, forum_id: forumId });
      setSavedForums((prev) => prev.filter((f) => String(f.forum_id) !== String(forumId)));
    } catch {
      setError('Unable to update saved forum.');
    } finally {
      setActionMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleUnsaveThread = async (threadId: string) => {
    if (!userId || !threadId) return;
    const key = `thread-${threadId}`;
    if (actionMap[key]) return;
    setActionMap((prev) => ({ ...prev, [key]: true }));
    try {
      await apiClient.post('/unsave_thread.php', { user_id: userId, thread_id: threadId });
      setSavedThreads((prev) => prev.filter((t) => String(t.thread_id) !== String(threadId)));
    } catch {
      setError('Unable to update saved thread.');
    } finally {
      setActionMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleUnsavePost = async (postId: string) => {
    if (!userId || !postId) return;
    const key = `post-${postId}`;
    if (actionMap[key]) return;
    setActionMap((prev) => ({ ...prev, [key]: true }));
    try {
      await apiClient.post('/unsave_post.php', { user_id: userId, post_id: postId });
      setSavedPosts((prev) => prev.filter((p) => String(p.post_id) !== String(postId)));
    } catch {
      setError('Unable to update saved comment.');
    } finally {
      setActionMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.pageTitle}>Saved</ThemedText>
          <ThemedText style={styles.pageSubtitle}>
            Curate your favorites across forums, threads, and comments.
          </ThemedText>
        </View>

        {!userId ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>Sign in to view saved content</ThemedText>
            <ThemedText style={styles.emptyText}>
              Save items from the menu to build your personal library.
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.metricsRow}>
              {metrics.map((metric) => (
                <Pressable
                  key={metric.key}
                  style={[
                    styles.metricCard,
                    savedTab === metric.key && styles.metricCardActive,
                  ]}
                  onPress={() => setSavedTab(metric.key)}
                >
                  <ThemedText style={styles.metricLabel}>{metric.label}</ThemedText>
                  <ThemedText style={styles.metricValue}>{metric.count}</ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.controlsRow}>
              <View style={styles.viewPill}>
                <ThemedText style={styles.viewPillText}>View</ThemedText>
              </View>
              <View
                style={styles.segmentControl}
                onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
              >
                <Animated.View
                  style={[
                    styles.segmentIndicator,
                    {
                      width: segmentWidth ? segmentWidth / 3 - 6 : 0,
                      transform: [
                        {
                          translateX: segmentAnim.interpolate({
                            inputRange: [0, 1, 2],
                            outputRange: [3, segmentWidth / 3 + 3, (segmentWidth * 2) / 3 + 3],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <View style={styles.segmentPillBackground} />
                {SAVED_TABS.map((tab, index) => (
                  <Pressable
                    key={tab.key}
                    style={[
                      styles.segmentButton,
                      index === 0
                        ? styles.segmentButtonLeft
                        : index === 1
                        ? styles.segmentButtonMiddle
                        : styles.segmentButtonRight,
                    ]}
                    onPress={() => setSavedTab(tab.key)}
                  >
                    <ThemedText
                      style={[
                        styles.segmentButtonText,
                        savedTab === tab.key && styles.segmentButtonTextActive,
                      ]}
                    >
                      {tab.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <ThemedText style={styles.activeCount}>{activeCount} saved</ThemedText>
            </View>

            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primaryFrom} />
              </View>
            ) : null}

            {activeCount === 0 && !loading ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>
                  No saved {savedTab === 'posts' ? 'comments' : savedTab} yet
                </ThemedText>
                <ThemedText style={styles.emptyText}>
                  Save content from menus to build your quick-access library.
                </ThemedText>
              </View>
            ) : null}

            {savedTab === 'forums' && savedForums.length > 0 ? (
              <View style={styles.cardsGrid}>
                {savedForums.map((forum) => (
                  <Pressable
                    key={forum.forum_id}
                    style={styles.savedCard}
                    onPress={() => router.push(`/info/forum/${forum.forum_id}`)}
                    accessibilityRole="link"
                  >
                    <View style={styles.cardMetaRow}>
                      <View style={styles.typeBadge}>
                        <ThemedText style={styles.typeBadgeText}>Forum</ThemedText>
                      </View>
                      {forum.saved_at ? (
                        <ThemedText style={styles.savedTime}>
                          Saved {formatSavedAt(forum.saved_at)}
                        </ThemedText>
                      ) : null}
                    </View>
                    <View style={styles.crumbRow}>
                      <ThemedText style={styles.crumbText}>
                        {forum.community_name || 'Community'}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.cardTitle}>
                      {forum.name || 'Forum'}
                    </ThemedText>
                    <ThemedText style={styles.cardText}>
                      {summarizeWithEllipsis(forum.description || '', SAVED_CARD_MAX_CHARS) ||
                        'No description provided...'}
                    </ThemedText>
                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.pillButton}
                        onPress={() => handleUnsaveForum(forum.forum_id)}
                        disabled={actionMap[`forum-${forum.forum_id}`]}
                      >
                        <ThemedText style={styles.pillButtonText}>Unsave</ThemedText>
                        </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {savedTab === 'threads' && savedThreads.length > 0 ? (
              <View style={styles.cardsGrid}>
                {savedThreads.map((thread) => (
                  <Pressable
                    key={thread.thread_id}
                    style={styles.savedCard}
                    onPress={() =>
                      router.push(`/info/forum/${thread.forum_id || 0}/thread/${thread.thread_id}`)
                    }
                    accessibilityRole="link"
                  >
                    <View style={styles.cardMetaRow}>
                      <View style={styles.typeBadge}>
                        <ThemedText style={styles.typeBadgeText}>Thread</ThemedText>
                      </View>
                      {thread.saved_at ? (
                        <ThemedText style={styles.savedTime}>
                          Saved {formatSavedAt(thread.saved_at)}
                        </ThemedText>
                      ) : null}
                    </View>
                    <View style={styles.crumbRow}>
                      <ThemedText style={styles.crumbText}>Info Board</ThemedText>
                      <ThemedText style={styles.crumbSep}>/</ThemedText>
                      <ThemedText style={styles.crumbText}>
                        {thread.forum_name || 'Forum'}
                      </ThemedText>
                      <ThemedText style={styles.crumbSep}>/</ThemedText>
                    </View>
                    <ThemedText style={styles.cardTitle}>
                      {thread.title || 'Untitled thread'}
                    </ThemedText>
                    <ThemedText style={styles.cardText}>
                      {summarizeWithEllipsis(thread.first_post_content || '', SAVED_CARD_MAX_CHARS) ||
                        'No thread preview available...'}
                    </ThemedText>
                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.pillButton}
                        onPress={() => handleUnsaveThread(thread.thread_id)}
                        disabled={actionMap[`thread-${thread.thread_id}`]}
                      >
                        <ThemedText style={styles.pillButtonText}>Unsave</ThemedText>
                        </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {savedTab === 'posts' && savedPosts.length > 0 ? (
              <View style={styles.cardsGrid}>
                {savedPosts.map((post) => {
                  const originalPostText = stripHtml(post.original_post_content || '');
                  const headingText =
                    summarizeWithEllipsis(originalPostText, SAVED_CARD_MAX_CHARS) ||
                    summarizeWithEllipsis(post.thread_title || '', SAVED_CARD_MAX_CHARS) ||
                    'Saved Comment';
                  const isVerified = Number(post.verified) === 1;
                  return (
                    <Pressable
                      key={post.post_id}
                      style={[styles.savedCard, isVerified && styles.savedCardVerified]}
                      onPress={() =>
                        router.push(`/info/forum/${post.forum_id || 0}/thread/${post.thread_id || 0}`)
                      }
                      accessibilityRole="link"
                    >
                      <View style={styles.cardMetaRow}>
                        <View style={styles.typeBadge}>
                          <ThemedText style={styles.typeBadgeText}>Comment</ThemedText>
                        </View>
                        {post.saved_at ? (
                          <ThemedText style={styles.savedTime}>
                            Saved {formatSavedAt(post.saved_at)}
                          </ThemedText>
                        ) : null}
                      </View>
                      {isVerified ? (
                        <View style={styles.verifiedBadge}>
                          <ThemedText style={styles.verifiedBadgeText}>Verified Answer</ThemedText>
                        </View>
                      ) : null}
                      <View style={styles.crumbRow}>
                        <ThemedText style={styles.crumbText}>Info Board</ThemedText>
                        <ThemedText style={styles.crumbSep}>/</ThemedText>
                        <ThemedText style={styles.crumbText}>
                          {post.forum_name || 'Forum'}
                        </ThemedText>
                        {post.thread_title ? (
                          <>
                            <ThemedText style={styles.crumbSep}>/</ThemedText>
                            <ThemedText style={styles.crumbText}>
                              {summarizeWithEllipsis(post.thread_title, SAVED_CARD_MAX_CHARS)}
                            </ThemedText>
                          </>
                        ) : null}
                      </View>
                      <ThemedText style={styles.cardTitle}>{headingText}</ThemedText>
                      <ThemedText style={styles.cardText}>
                        {summarizeWithEllipsis(post.content || '', SAVED_CARD_MAX_CHARS) ||
                          'No preview available...'}
                      </ThemedText>
                      <View style={styles.cardActions}>
                        <Pressable
                          style={styles.pillButton}
                          onPress={() => handleUnsavePost(post.post_id)}
                          disabled={actionMap[`post-${post.post_id}`]}
                        >
                          <ThemedText style={styles.pillButtonText}>Unsave</ThemedText>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
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
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: hexToRgba(colors.card, 0.95),
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  metricCardActive: {
    borderColor: hexToRgba(colors.primaryFrom, 0.55),
    shadowOpacity: 0.12,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtext,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  viewPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
  },
  viewPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryFrom,
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
    marginRight: 2,
  },
  segmentButtonMiddle: {
    marginHorizontal: 2,
  },
  segmentButtonRight: {
    marginLeft: 2,
  },
  segmentButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  segmentButtonTextActive: {
    color: '#fff',
  },
  activeCount: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtext,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
  },
  loadingState: {
    paddingVertical: 12,
  },
  emptyState: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hexToRgba(colors.subtext, 0.42),
    padding: 18,
    backgroundColor: hexToRgba(colors.card, 0.78),
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    fontSize: 12,
    color: colors.subtext,
  },
  cardsGrid: {
    gap: 14,
  },
  savedCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: hexToRgba(colors.subtext, 0.28),
    backgroundColor: hexToRgba(colors.card, 0.96),
    padding: 14,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  savedCardVerified: {
    borderColor: hexToRgba('#22c55e', 0.5),
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryFrom,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  savedTime: {
    fontSize: 11,
    color: colors.subtext,
  },
  verifiedBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: hexToRgba('#22c55e', 0.35),
    backgroundColor: hexToRgba('#22c55e', 0.14),
    alignSelf: 'flex-start',
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  crumbText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.subtext,
  },
  crumbSep: {
    fontSize: 11,
    color: colors.subtext,
    opacity: 0.7,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cardText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  cardActions: {
    marginTop: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
});
