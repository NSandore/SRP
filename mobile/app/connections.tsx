import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { apiClient } from '@/lib/api/client';
import { buildAvatarSrc } from '@/lib/uploads';
import { useBrandStyles } from '@/hooks/use-brand-styles';

type ConnectionUser = {
  user_id: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  avatar_path?: string | null;
};

type ConnectionMap = Record<string, ConnectionUser>;

const TABS = [
  { key: 'following', label: 'Following' },
  { key: 'followers', label: 'Followers' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function ConnectionsScreen() {
  const router = useRouter();
  const { user, isLoading } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const userId = user?.user_id ? String(user.user_id) : '';
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [following, setFollowing] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [userDetails, setUserDetails] = useState<ConnectionMap>({});
  const [activeTab, setActiveTab] = useState<TabKey>('following');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segWidth, setSegWidth] = useState(0);
  const segAnim = useRef(new Animated.Value(0)).current;
  const [actionMap, setActionMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const index = activeTab === 'following' ? 0 : 1;
    Animated.timing(segAnim, {
      toValue: index,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeTab, segAnim]);

  useEffect(() => {
    if (isLoading) return;
    if (!userId) {
      openLockedFeature('Connections');
    }
  }, [userId, isLoading, openLockedFeature]);

  useEffect(() => {
    if (!userId) {
      setFollowing([]);
      setFollowers([]);
      setUserDetails({});
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    apiClient
      .get('/fetch_connections_list.php', { params: { user_id: userId } })
      .then((resp) => {
        if (!mounted) return;
        const data = resp.data as any;
        if (data?.success) {
          const nextFollowing = Array.isArray(data.following)
            ? data.following.map((id: any) => String(id))
            : [];
          const nextFollowers = Array.isArray(data.followers)
            ? data.followers.map((id: any) => String(id))
            : [];
          setFollowing(nextFollowing);
          setFollowers(nextFollowers);
          const allIds = Array.from(new Set([...nextFollowing, ...nextFollowers])).filter(Boolean);
          fetchUserDetails(allIds);
        } else {
          setError(data?.error || 'Unable to load connections.');
        }
      })
      .catch(() => {
        if (!mounted) return;
        setError('Unable to load connections.');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  const fetchUserDetails = async (userIds: string[]) => {
    const missing = userIds.filter((id) => !userDetails[id]);
    if (!missing.length) return;
    try {
      const results = await Promise.all(
        missing.map(async (uid) => {
          try {
            const resp = await apiClient.get('/fetch_user.php', { params: { user_id: uid } });
            if ((resp.data as any)?.success) {
              const info = (resp.data as any)?.user || {};
              return {
                user_id: uid,
                first_name: info.first_name || '',
                last_name: info.last_name || '',
                headline: info.headline || '',
                avatar_path: info.avatar_path || null,
              } as ConnectionUser;
            }
          } catch {
            return null;
          }
          return null;
        })
      );
      setUserDetails((prev) => {
        const mapped: ConnectionMap = { ...prev };
        results.forEach((item) => {
          if (item?.user_id) mapped[item.user_id] = item;
        });
        return mapped;
      });
    } catch {
      // ignore details failures
    }
  };

  const handleUnfollow = async (targetId: string) => {
    if (!userId || !targetId) return;
    const key = `unfollow-${targetId}`;
    if (actionMap[key]) return;
    setActionMap((prev) => ({ ...prev, [key]: true }));
    try {
      const resp = await apiClient.post('/unfollow_user.php', {
        follower_id: userId,
        followed_user_id: targetId,
      });
      if ((resp.data as any)?.success) {
        setFollowing((prev) => prev.filter((id) => String(id) !== String(targetId)));
      } else {
        setError((resp.data as any)?.error || 'Unable to update follow status.');
      }
    } catch {
      setError('Unable to update follow status.');
    } finally {
      setActionMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const activeIds = useMemo(
    () => (activeTab === 'following' ? following : followers),
    [activeTab, following, followers]
  );

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.pageTitle}>Connections</ThemedText>
          <ThemedText style={styles.pageSubtitle}>
            Review who you follow and who follows you.
          </ThemedText>
        </View>

        {!userId ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>Sign in to view connections</ThemedText>
            <ThemedText style={styles.emptyText}>
              Your network of connections and followers will appear here.
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.controlsRow}>
              <View style={styles.viewPill}>
                <ThemedText style={styles.viewPillText}>View</ThemedText>
              </View>
              <View style={styles.segmentControl} onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}>
                <Animated.View
                  style={[
                    styles.segmentIndicator,
                    {
                      width: segWidth ? segWidth / 2 - 6 : 0,
                      transform: [
                        {
                          translateX: segAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [3, segWidth / 2 + 3],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <View style={styles.segmentPillBackground} />
                {TABS.map((tab, index) => (
                  <Pressable
                    key={tab.key}
                    style={[
                      styles.segmentButton,
                      index === 0 ? styles.segmentButtonLeft : styles.segmentButtonRight,
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <ThemedText
                      style={[
                        styles.segmentButtonText,
                        activeTab === tab.key && styles.segmentButtonTextActive,
                      ]}
                    >
                      {tab.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primaryFrom} />
                <ThemedText style={styles.loadingText}>Loading connections...</ThemedText>
              </View>
            ) : null}

            {!loading && activeIds.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>
                  {activeTab === 'following'
                    ? 'You are not following anyone yet.'
                    : 'You have no followers yet.'}
                </ThemedText>
                <ThemedText style={styles.emptyText}>
                  Start engaging with members to build your network.
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.list}>
              {activeIds.map((id) => {
                const details = userDetails[id] || { user_id: id };
                const fullName =
                  `${details.first_name || ''} ${details.last_name || ''}`.trim() || 'Member';
                return (
                  <View key={id} style={styles.card}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.avatarWrap}>
                        <Image
                          source={{ uri: buildAvatarSrc(details.avatar_path) }}
                          style={styles.avatar}
                        />
                      </View>
                      <View style={styles.info}>
                        <Pressable onPress={() => router.push(`/user/${id}`)}>
                          <ThemedText style={styles.name}>{fullName}</ThemedText>
                        </Pressable>
                        <ThemedText style={styles.headline}>
                          {details.headline || 'No headline'}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.actions}>
                      {activeTab === 'following' ? (
                        <Pressable
                          style={styles.unfollowButton}
                          onPress={() => handleUnfollow(id)}
                          disabled={actionMap[`unfollow-${id}`]}
                        >
                          <ThemedText style={styles.unfollowText}>Unfollow</ThemedText>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={styles.messageButton}
                        onPress={() => router.push(`/messages?user=${id}`)}
                      >
                        <ThemedText style={styles.messageText}>Message</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    minWidth: 200,
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
  segmentButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  segmentButtonTextActive: {
    color: '#fff',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
  },
  loadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.subtext,
  },
  list: {
    gap: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 1, height: 1 },
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    padding: 3,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  headline: {
    fontSize: 12,
    color: colors.subtext,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unfollowButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: hexToRgba(colors.text, 0.08),
  },
  unfollowText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  messageButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#22c55e',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
});
