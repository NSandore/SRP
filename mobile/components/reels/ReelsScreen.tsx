import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AppShell from '@/components/navigation/AppShell';
import ReelCard from '@/components/reels/ReelCard';
import ReelCommentsSheet from '@/components/reels/ReelCommentsSheet';
import ReelComposer from '@/components/reels/ReelComposer';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/brand';
import { isAdmin, isModerator } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import {
  fetchReels,
  performReelAction,
  type Reel,
  type UploadReelResult,
} from '@/lib/api/reels';
import { apiClient } from '@/lib/api/client';
import { loadStoredSessionId } from '@/lib/storage';

type FeedScope = 'feed' | 'saved';

const readParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

export default function ReelsScreen() {
  const params = useLocalSearchParams<{
    reelId?: string | string[];
    userId?: string | string[];
    communityId?: string | string[];
    compose?: string | string[];
    intro?: string | string[];
    saved?: string | string[];
  }>();
  const requestedReelId = readParam(params.reelId);
  const filterUserId = readParam(params.userId);
  const filterCommunityId = readParam(params.communityId);
  const shouldOpenComposer = readParam(params.compose) === '1';
  const shouldCreateIntro = readParam(params.intro) === '1';
  const initialScope: FeedScope = readParam(params.saved) === '1' ? 'saved' : 'feed';

  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const listRef = useRef<FlatList<Reel> | null>(null);
  const requestSequence = useRef(0);
  const actionBusy = useRef(new Set<string>());
  const initialComposerHandled = useRef(false);

  const [scope, setScope] = useState<FeedScope>(initialScope);
  const [reels, setReels] = useState<Reel[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedHeight, setFeedHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const [commentsReel, setCommentsReel] = useState<Reel | null>(null);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerIntro, setComposerIntro] = useState(false);
  const [ambassadorCommunityIds, setAmbassadorCommunityIds] = useState<string[]>([]);

  useEffect(() => {
    loadStoredSessionId().then(setSessionId).catch(() => setSessionId(null));
  }, []);

  useEffect(() => {
    const sessionCommunities = user?.ambassador_communities || [];
    if (sessionCommunities.length > 0) {
      setAmbassadorCommunityIds(
        sessionCommunities.map((community) => String(community.community_id))
      );
      return;
    }
    if (!user?.user_id || !Number(user.is_ambassador)) {
      setAmbassadorCommunityIds([]);
      return;
    }

    let mounted = true;
    apiClient
      .get('/fetch_ambassador_communities.php', {
        params: { user_id: user.user_id },
      })
      .then((response) => {
        if (!mounted) return;
        const rows = Array.isArray(response.data?.communities)
          ? response.data.communities
          : [];
        setAmbassadorCommunityIds(
          rows
            .map((community: { community_id?: unknown }) =>
              String(community.community_id || '')
            )
            .filter(Boolean)
        );
      })
      .catch(() => {
        if (mounted) setAmbassadorCommunityIds([]);
      });
    return () => {
      mounted = false;
    };
  }, [user?.ambassador_communities, user?.is_ambassador, user?.user_id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const loadPage = useCallback(async ({
    reset = false,
    refresh = false,
  }: {
    reset?: boolean;
    refresh?: boolean;
  } = {}) => {
    const sequence = ++requestSequence.current;
    if (refresh) setIsRefreshing(true);
    else if (reset) setIsLoading(true);
    else setIsLoadingMore(true);
    if (reset) setError(null);

    try {
      const result = await fetchReels({
        scope,
        reelId: reset ? requestedReelId : undefined,
        userId: filterUserId,
        communityId: filterCommunityId,
        limit: 12,
        cursor: reset ? null : cursor,
      });
      if (sequence !== requestSequence.current) return;
      setReels((current) => {
        if (reset) return result.reels;
        const known = new Set(current.map((reel) => reel.reel_id));
        return [...current, ...result.reels.filter((reel) => !known.has(reel.reel_id))];
      });
      setCursor(result.nextCursor);
    } catch (reason) {
      if (sequence !== requestSequence.current) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load reels.');
      if (reset) setReels([]);
    } finally {
      if (sequence === requestSequence.current) {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    }
  }, [cursor, filterCommunityId, filterUserId, requestedReelId, scope]);

  useEffect(() => {
    setReels([]);
    setCursor(null);
    setActiveIndex(0);
    loadPage({ reset: true });
    // `loadPage` changes when its cursor changes; a scope/filter change is the
    // intended reset trigger, while pagination is handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCommunityId, filterUserId, requestedReelId, scope]);

  useEffect(() => {
    if (!shouldOpenComposer || initialComposerHandled.current || !user?.user_id) return;
    initialComposerHandled.current = true;
    setComposerIntro(shouldCreateIntro);
    setComposerVisible(true);
  }, [shouldCreateIntro, shouldOpenComposer, user?.user_id]);

  useEffect(() => {
    if (!requestedReelId || !feedHeight || reels.length === 0) return;
    const index = reels.findIndex((reel) => reel.reel_id === requestedReelId);
    if (index < 0) return;
    setActiveIndex(index);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: false });
    });
  }, [feedHeight, reels, requestedReelId]);

  const onFeedLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.floor(event.nativeEvent.layout.height);
    if (nextHeight > 0 && nextHeight !== feedHeight) setFeedHeight(nextHeight);
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<Reel>[] }) => {
      const visible = viewableItems.find((token) => token.isViewable && token.index !== null);
      if (visible?.index !== null && visible?.index !== undefined) {
        setActiveIndex(visible.index);
      }
    }
  ).current;

  const patchReel = (reelId: string, patcher: (reel: Reel) => Reel) => {
    setReels((current) =>
      current.map((reel) => reel.reel_id === reelId ? patcher(reel) : reel)
    );
    setCommentsReel((current) =>
      current?.reel_id === reelId ? patcher(current) : current
    );
  };

  const requireMember = (feature: string) => {
    if (user?.user_id) return true;
    openLockedFeature(feature);
    return false;
  };

  const runToggle = async (
    reel: Reel,
    kind: 'like' | 'save',
  ) => {
    if (!requireMember(kind === 'like' ? 'Liking reels' : 'Saving reels')) return;
    const busyKey = `${kind}:${reel.reel_id}`;
    if (actionBusy.current.has(busyKey)) return;
    actionBusy.current.add(busyKey);

    const wasActive = kind === 'like' ? reel.is_liked : reel.is_saved;
    const action = kind === 'like'
      ? (wasActive ? 'unlike' : 'like')
      : (wasActive ? 'unsave' : 'save');

    patchReel(reel.reel_id, (current) => ({
      ...current,
      ...(kind === 'like'
        ? {
            is_liked: !wasActive,
            like_count: Math.max(0, current.like_count + (wasActive ? -1 : 1)),
          }
        : { is_saved: !wasActive }),
    }));

    try {
      await performReelAction(action, reel.reel_id);
      if (scope === 'saved' && kind === 'save' && wasActive) {
        setReels((current) => current.filter((item) => item.reel_id !== reel.reel_id));
      }
    } catch (reason) {
      patchReel(reel.reel_id, (current) => ({
        ...current,
        ...(kind === 'like'
          ? {
              is_liked: wasActive,
              like_count: Math.max(0, current.like_count + (wasActive ? 1 : -1)),
            }
          : { is_saved: wasActive }),
      }));
      Alert.alert(
        'Could not update reel',
        reason instanceof Error ? reason.message : 'Please try again.'
      );
    } finally {
      actionBusy.current.delete(busyKey);
    }
  };

  const managedCommunityIds = [
    ...new Set([
      ...(user?.admin_community_ids || []).map(String),
      ...ambassadorCommunityIds,
    ]),
  ];

  const getPinTarget = (reel: Reel) => {
    if (reel.community_id) return String(reel.community_id);
    // A profile-only Reel has no natural target. Expose pinning only when the
    // user's managed community makes the action unambiguous.
    return managedCommunityIds.length === 1 ? managedCommunityIds[0] : null;
  };

  const canPinReel = (reel: Reel) => {
    if (!user?.user_id) return false;
    const targetCommunityId = getPinTarget(reel);
    if (!targetCommunityId) return false;
    if (reel.can_pin === true || isModerator(user.role_id)) return true;
    return managedCommunityIds.includes(targetCommunityId);
  };

  const togglePin = async (reel: Reel) => {
    if (!requireMember('Community pinning')) return;
    const communityId = getPinTarget(reel);
    if (!communityId) {
      Alert.alert(
        'Choose a community first',
        'Associate the reel with a community you manage before pinning it.'
      );
      return;
    }
    const busyKey = `pin:${reel.reel_id}`;
    if (actionBusy.current.has(busyKey)) return;
    actionBusy.current.add(busyKey);
    const wasPinned = reel.is_pinned;
    patchReel(reel.reel_id, (current) => ({ ...current, is_pinned: !wasPinned }));
    try {
      const result = await performReelAction(
        wasPinned ? 'unpin' : 'pin',
        reel.reel_id,
        {
          community_id: communityId,
          pin_id: reel.pin_id || undefined,
        }
      );
      const pinnedCommunityIds = Array.isArray(result.pinned_community_ids)
        ? result.pinned_community_ids.map(String)
        : wasPinned
          ? reel.pinned_community_ids.filter((id) => id !== communityId)
          : [...new Set([...reel.pinned_community_ids, communityId])];
      patchReel(reel.reel_id, (current) => ({
        ...current,
        pinned_community_ids: pinnedCommunityIds,
        is_pinned: pinnedCommunityIds.includes(communityId),
      }));
    } catch (reason) {
      patchReel(reel.reel_id, (current) => ({ ...current, is_pinned: wasPinned }));
      Alert.alert(
        'Could not update pin',
        reason instanceof Error ? reason.message : 'Please try again.'
      );
    } finally {
      actionBusy.current.delete(busyKey);
    }
  };

  const setIntro = async (reel: Reel) => {
    const nextAction = reel.is_intro ? 'unset_intro' : 'set_intro';
    try {
      await performReelAction(nextAction, reel.reel_id);
      setReels((current) =>
        current.map((item) => ({
          ...item,
          is_intro: item.reel_id === reel.reel_id ? !reel.is_intro : false,
        }))
      );
    } catch (reason) {
      Alert.alert(
        'Could not update intro',
        reason instanceof Error ? reason.message : 'Please try again.'
      );
    }
  };

  const deleteReel = (reel: Reel) => {
    Alert.alert('Delete this reel?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await performReelAction('delete', reel.reel_id);
            setReels((current) => current.filter((item) => item.reel_id !== reel.reel_id));
          } catch (reason) {
            Alert.alert(
              'Could not delete reel',
              reason instanceof Error ? reason.message : 'Please try again.'
            );
          }
        },
      },
    ]);
  };

  const toggleFeatured = async (reel: Reel) => {
    try {
      await performReelAction(reel.is_featured ? 'unfeature' : 'feature', reel.reel_id);
      patchReel(reel.reel_id, (current) => ({
        ...current,
        is_featured: !reel.is_featured,
      }));
    } catch (reason) {
      Alert.alert(
        'Could not update featured status',
        reason instanceof Error ? reason.message : 'Please try again.'
      );
    }
  };

  const openMenu = (reel: Reel) => {
    const isOwner = user?.user_id === (reel.creator_user_id || reel.user_id);
    if (isOwner) {
      Alert.alert('Reel options', undefined, [
        {
          text: reel.is_intro ? 'Remove profile intro' : 'Use as profile intro',
          onPress: () => setIntro(reel),
        },
        {
          text: 'Delete reel',
          style: 'destructive',
          onPress: () => deleteReel(reel),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (isAdmin(user?.role_id)) {
      Alert.alert('Reel options', undefined, [
        {
          text: reel.is_featured ? 'Remove Featured badge' : 'Feature this reel',
          onPress: () => toggleFeatured(reel),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert('Reel options', 'More sharing and reporting options are coming soon.');
  };

  const openCreator = (reel: Reel) => {
    const creatorId = reel.creator_user_id || reel.user_id;
    if (!creatorId) return;
    if (creatorId === user?.user_id) {
      router.push('/profile');
      return;
    }
    router.push({
      pathname: '/user/[userId]',
      params: { userId: creatorId },
    });
  };

  const openCommunity = (reel: Reel) => {
    if (!reel.community_id) return;
    router.push(
      reel.community_type === 'group'
        ? {
            pathname: '/group/[communityId]',
            params: { communityId: reel.community_id },
          }
        : {
            pathname: '/university/[communityId]',
            params: { communityId: reel.community_id },
          }
    );
  };

  const openComposer = (intro: boolean = false) => {
    if (!requireMember('Creating reels')) return;
    setComposerIntro(intro);
    setComposerVisible(true);
  };

  const handleUploadComplete = (result: UploadReelResult) => {
    setComposerVisible(false);
    if (result.reel) {
      setReels((current) => [
        result.reel!,
        ...current.filter((reel) => reel.reel_id !== result.reel!.reel_id),
      ]);
      setActiveIndex(0);
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
    } else {
      Alert.alert(
        'Reel uploaded',
        'Your reel is still finishing its light compression and will appear shortly.'
      );
      loadPage({ reset: true });
    }
  };

  const selectScope = (nextScope: FeedScope) => {
    if (nextScope === 'saved' && !requireMember('Saved reels')) return;
    if (nextScope !== scope) setScope(nextScope);
  };

  const headerTitle = filterUserId
    ? 'Profile reels'
    : filterCommunityId
      ? 'Community reels'
      : 'Reels';
  const playbackEnabled =
    isFocused &&
    appIsActive &&
    !commentsReel &&
    !composerVisible;

  return (
    <AppShell showSearch={false}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons name="play-box-multiple" size={24} color="#fff" />
            <ThemedText style={styles.headerTitle}>{headerTitle}</ThemedText>
          </View>
          {!filterUserId && !filterCommunityId ? (
            <View style={styles.scopePicker}>
              {(['feed', 'saved'] as const).map((item) => {
                const active = scope === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => selectScope(item)}
                    style={({ pressed }) => [
                      styles.scopeButton,
                      active && styles.scopeButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText style={[styles.scopeText, active && styles.scopeTextActive]}>
                      {item === 'feed' ? 'For you' : 'Saved'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : <View style={styles.headerFlex} />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a reel"
            onPress={() => openComposer(false)}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="plus" size={23} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.feed} onLayout={onFeedLayout}>
          {feedHeight > 0 ? (
            <FlatList
              ref={listRef}
              data={reels}
              keyExtractor={(item) => item.reel_id}
              pagingEnabled
              snapToInterval={feedHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              showsVerticalScrollIndicator={false}
              viewabilityConfig={{ itemVisiblePercentThreshold: 72 }}
              onViewableItemsChanged={onViewableItemsChanged}
              onEndReached={() => {
                if (cursor && !isLoadingMore) loadPage();
              }}
              onEndReachedThreshold={0.7}
              refreshing={isRefreshing}
              onRefresh={() => loadPage({ reset: true, refresh: true })}
              initialNumToRender={2}
              maxToRenderPerBatch={3}
              windowSize={3}
              removeClippedSubviews={Platform.OS === 'android'}
              getItemLayout={(_, index) => ({
                length: feedHeight,
                offset: feedHeight * index,
                index,
              })}
              onScrollToIndexFailed={({ index }) => {
                listRef.current?.scrollToOffset({
                  offset: index * feedHeight,
                  animated: false,
                });
              }}
              renderItem={({ item, index }) => (
                <ReelCard
                  reel={item}
                  height={feedHeight}
                  isActive={playbackEnabled && index === activeIndex}
                  sessionId={sessionId}
                  canPin={canPinReel(item)}
                  onToggleLike={(reel) => runToggle(reel, 'like')}
                  onToggleSave={(reel) => runToggle(reel, 'save')}
                  onOpenComments={setCommentsReel}
                  onTogglePin={togglePin}
                  onOpenCreator={openCreator}
                  onOpenCommunity={openCommunity}
                  onOpenMenu={openMenu}
                />
              )}
              ListEmptyComponent={
                !isLoading ? (
                  <View style={[styles.empty, { height: feedHeight }]}>
                    <View style={styles.emptyIcon}>
                      <MaterialCommunityIcons
                        name={scope === 'saved' ? 'bookmark-outline' : 'movie-open-outline'}
                        size={38}
                        color="#CBD5E1"
                      />
                    </View>
                    <ThemedText style={styles.emptyTitle}>
                      {error ? 'Reels are unavailable' : scope === 'saved' ? 'No saved reels' : 'No reels yet'}
                    </ThemedText>
                    <ThemedText style={styles.emptyText}>
                      {error || (scope === 'saved'
                        ? 'Save reels to build a collection here.'
                        : 'Share the first short video with your community.')}
                    </ThemedText>
                    {scope === 'feed' && !error ? (
                      <Pressable
                        onPress={() => openComposer(false)}
                        style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
                      >
                        <MaterialCommunityIcons name="plus" size={19} color="#fff" />
                        <ThemedText style={styles.emptyButtonText}>Create a reel</ThemedText>
                      </Pressable>
                    ) : error ? (
                      <Pressable
                        onPress={() => loadPage({ reset: true })}
                        style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
                      >
                        <MaterialCommunityIcons name="refresh" size={19} color="#fff" />
                        <ThemedText style={styles.emptyButtonText}>Try again</ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null
              }
            />
          ) : null}

          {isLoading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <ThemedText style={styles.loadingText}>Loading reels…</ThemedText>
            </View>
          ) : null}
          {isLoadingMore ? (
            <View style={styles.moreIndicator}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : null}
        </View>
      </View>

      <ReelCommentsSheet
        reel={commentsReel}
        visible={Boolean(commentsReel)}
        canComment={Boolean(user?.user_id)}
        onClose={() => setCommentsReel(null)}
        onRequireAuth={() => openLockedFeature('Commenting on reels')}
        onCommentAdded={(reelId) =>
          patchReel(reelId, (reel) => ({ ...reel, comment_count: reel.comment_count + 1 }))
        }
      />

      {user?.user_id ? (
        <ReelComposer
          visible={composerVisible}
          userId={user.user_id}
          defaultIntro={composerIntro}
          defaultCommunityId={filterCommunityId || null}
          onClose={() => setComposerVisible(false)}
          onComplete={handleUploadComplete}
        />
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    minHeight: 58,
    paddingHorizontal: Brand.spacing.md,
    backgroundColor: '#071226',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Brand.spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerFlex: {
    flex: 1,
  },
  scopePicker: {
    flex: 1,
    maxWidth: 180,
    height: 36,
    padding: 3,
    borderRadius: Brand.radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
  },
  scopeButton: {
    flex: 1,
    borderRadius: Brand.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeButtonActive: {
    backgroundColor: '#fff',
  },
  scopeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  scopeTextActive: {
    color: '#0F172A',
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F80ED',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.42)',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  feed: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#020617',
  },
  loadingText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  moreIndicator: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 9,
    backgroundColor: '#020617',
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 340,
  },
  emptyButton: {
    minHeight: 44,
    marginTop: 10,
    borderRadius: Brand.radius.pill,
    paddingHorizontal: 18,
    backgroundColor: '#2F80ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
