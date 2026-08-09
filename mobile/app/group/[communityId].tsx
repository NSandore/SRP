import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import AppShell from '@/components/navigation/AppShell';
import ReelGrid from '@/components/reels/ReelGrid';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { isSuperAdmin } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { apiClient } from '@/lib/api/client';
import { buildUploadSrc } from '@/lib/uploads';

type Group = {
  id?: string;
  community_id?: string;
  name?: string;
  tagline?: string;
  location?: string;
  website?: string;
  logo_path?: string | null;
  banner_path?: string | null;
  followers_count?: number | string;
  child_count?: number | string;
  is_following?: boolean;
  primary_color?: string | null;
  secondary_color?: string | null;
  parent_name?: string;
  parent_type?: string;
};

type PinnedItem = {
  pin_id?: string;
  item_type?: 'thread' | 'forum';
  item_id?: string;
  thread_id?: string;
  forum_id?: string;
  title?: string;
  forum_name?: string;
  post_count?: number | string;
  thread_count?: number | string;
};

type SubCommunity = {
  community_id: string;
  community_type?: string;
  name?: string;
  tagline?: string;
  location?: string;
  logo_path?: string | null;
  followers_count?: number | string;
  is_following?: number | string;
};

type Question = {
  question_id: string;
  title?: string;
  body?: string;
  asker_first_name?: string;
  asker_last_name?: string;
  created_at?: string;
  status?: string;
  answers?: {
    answer_id: string;
    body?: string;
    first_name?: string;
    last_name?: string;
  }[];
};

type UploadAsset = {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
  file?: unknown | null;
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'subgroups', label: 'Sub-Groups' },
  { key: 'reels', label: 'Reels' },
  { key: 'posts', label: 'Pinned Topics' },
  { key: 'qa', label: 'Q+A' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function GroupProfileScreen() {
  const params = useLocalSearchParams<{ communityId?: string | string[] }>();
  const communityId = Array.isArray(params.communityId)
    ? params.communityId[0]
    : params.communityId;
  const router = useRouter();
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 640;
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [group, setGroup] = useState<Group | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFollowBusy, setIsFollowBusy] = useState(false);
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [loadingPinned, setLoadingPinned] = useState(false);
  const [subcommunities, setSubcommunities] = useState<SubCommunity[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editPrimaryColor, setEditPrimaryColor] = useState('#2F80ED');
  const [editSecondaryColor, setEditSecondaryColor] = useState('#1D5FC4');
  const [editLogoAsset, setEditLogoAsset] = useState<UploadAsset | null>(null);
  const [editBannerAsset, setEditBannerAsset] = useState<UploadAsset | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editStatus, setEditStatus] = useState('');

  const followerCount = Number(group?.followers_count || 0);
  const subCount = Number(group?.child_count || 0);
  const canEditCommunity = Boolean(user?.role_id) && isSuperAdmin(user?.role_id);

  const bannerHeight = isNarrow ? 120 : 160;
  const logoSize = isNarrow ? 64 : 96;

  const heroLogoStyle = useMemo(
    () => ({
      width: logoSize,
      height: logoSize,
      borderRadius: logoSize / 2,
    }),
    [logoSize]
  );

  const heroLogoWrapStyle = useMemo(
    () => ({
      width: logoSize + 12,
      height: logoSize + 12,
      borderRadius: (logoSize + 12) / 2,
      left: 16,
      top: isNarrow ? bannerHeight - logoSize / 2 - 18 : undefined,
      bottom: isNarrow ? undefined : 10,
    }),
    [logoSize, bannerHeight, isNarrow]
  );

  useEffect(() => {
    if (!communityId) return;
    let mounted = true;
    setIsLoading(true);
    setError(null);
    apiClient
      .get('/fetch_group.php', {
        params: {
          community_id: communityId,
          user_id: user?.user_id,
        },
      })
      .then((resp) => {
        if (!mounted) return;
        if ((resp.data as any)?.success) {
          setGroup((resp.data as any)?.group || null);
        } else {
          setError((resp.data as any)?.error || 'Unable to load group.');
        }
      })
      .catch(() => {
        if (!mounted) return;
        setError('Unable to load group.');
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [communityId, user?.user_id]);

  useEffect(() => {
    if (!communityId) return;
    let mounted = true;
    setLoadingPinned(true);
    apiClient
      .get('/fetch_pinned_items.php', { params: { community_id: communityId } })
      .then((resp) => {
        if (!mounted) return;
        if ((resp.data as any)?.success) {
          setPinnedItems((resp.data as any)?.items || []);
        } else {
          setPinnedItems([]);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setPinnedItems([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingPinned(false);
      });
    return () => {
      mounted = false;
    };
  }, [communityId]);

  useEffect(() => {
    if (!communityId) return;
    let mounted = true;
    setLoadingSub(true);
    apiClient
      .get('/fetch_subcommunities.php', {
        params: { parent_id: communityId, user_id: user?.user_id },
      })
      .then((resp) => {
        if (!mounted) return;
        if ((resp.data as any)?.success) {
          setSubcommunities((resp.data as any)?.subcommunities || []);
        } else {
          setSubcommunities([]);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSubcommunities([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingSub(false);
      });
    return () => {
      mounted = false;
    };
  }, [communityId, user?.user_id]);

  useEffect(() => {
    if (!communityId) return;
    let mounted = true;
    setLoadingQuestions(true);
    apiClient
      .get('/fetch_group_questions.php', {
        params: { group_id: communityId, viewer_id: user?.user_id },
      })
      .then((resp) => {
        if (!mounted) return;
        if ((resp.data as any)?.success) {
          setQuestions((resp.data as any)?.questions || []);
        } else {
          setQuestions([]);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setQuestions([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingQuestions(false);
      });
    return () => {
      mounted = false;
    };
  }, [communityId, user?.user_id]);

  const handleFollowToggle = async () => {
    if (!user?.user_id || !communityId) {
      openLockedFeature('Following communities');
      return;
    }
    if (!group) return;
    setIsFollowBusy(true);
    try {
      if (group.is_following) {
        await apiClient.post('/unfollow_community.php', {
          user_id: user.user_id,
          community_id: communityId,
        });
        setGroup((prev) =>
          prev ? { ...prev, is_following: false, followers_count: followerCount - 1 } : prev
        );
      } else {
        await apiClient.post('/follow_community.php', {
          user_id: user.user_id,
          community_id: communityId,
        });
        setGroup((prev) =>
          prev ? { ...prev, is_following: true, followers_count: followerCount + 1 } : prev
        );
      }
    } catch {
      Alert.alert('Unable to update', 'Please try again.');
    } finally {
      setIsFollowBusy(false);
    }
  };

  const openEditModal = () => {
    if (!group) return;
    setEditName(group.name || '');
    setEditTagline(group.tagline || '');
    setEditLocation(group.location || '');
    setEditWebsite(group.website || '');
    setEditPrimaryColor(group.primary_color || '#2F80ED');
    setEditSecondaryColor(group.secondary_color || '#1D5FC4');
    setEditLogoAsset(null);
    setEditBannerAsset(null);
    setEditStatus('');
    setShowEditModal(true);
  };

  const getAssetLabel = (asset: UploadAsset | null, fallback: string) => {
    if (!asset) return fallback;
    if (asset.fileName) return asset.fileName;
    if (asset.name) return asset.name;
    if (asset.uri) {
      const parts = asset.uri.split('/');
      return parts[parts.length - 1] || fallback;
    }
    return fallback;
  };

  const buildFormFile = (asset: UploadAsset | null, fallbackName: string) => {
    if (!asset) return null;
    if (asset.file) return asset.file;
    const name = asset.fileName || asset.name || fallbackName;
    const type = asset.mimeType || asset.type || 'image/jpeg';
    return { uri: asset.uri, name, type } as any;
  };

  const ensureLibraryPermission = async () => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo access needed', 'Please allow photo library access to select images.');
      return false;
    }
    return true;
  };

  const pickImage = async (setter: (asset: UploadAsset | null) => void) => {
    const hasPermission = await ensureLibraryPermission();
    if (!hasPermission) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.length) {
        setter(result.assets[0] as UploadAsset);
      }
    } catch {
      Alert.alert('Unable to open media picker', 'Please try again or choose another upload method.');
    }
  };

  const handleUpdateCommunity = async () => {
    if (!canEditCommunity || !communityId) return;
    if (!editName.trim()) {
      setEditStatus('Name is required.');
      return;
    }
    setIsSavingEdit(true);
    setEditStatus('');
    const formData = new FormData();
    formData.append('community_id', communityId);
    formData.append('name', editName.trim());
    formData.append('tagline', editTagline.trim());
    formData.append('location', editLocation.trim());
    formData.append('website', editWebsite.trim());
    formData.append('primary_color', editPrimaryColor || '#2F80ED');
    formData.append('secondary_color', editSecondaryColor || '#1D5FC4');
    const logoPayload = buildFormFile(editLogoAsset, 'logo.jpg');
    const bannerPayload = buildFormFile(editBannerAsset, 'banner.jpg');
    if (logoPayload) formData.append('logo', logoPayload as any);
    if (bannerPayload) formData.append('banner', bannerPayload as any);

    try {
      const res = await apiClient.post('/update_university.php', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const payload =
        typeof res.data === 'string'
          ? (() => {
              try {
                return JSON.parse(res.data);
              } catch {
                return {};
              }
            })()
          : res.data || {};
      if (payload?.success) {
        const updated = payload.university || payload.group || payload.community || null;
        if (updated) {
          setGroup(updated);
          setShowEditModal(false);
          setEditStatus('Community updated successfully.');
        } else {
          setEditStatus('Updated, but no data returned. Please refresh.');
        }
      } else {
        setEditStatus(payload?.error || 'Unable to update community.');
      }
    } catch {
      setEditStatus('An error occurred while updating.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const bannerSrc = buildUploadSrc(
    group?.banner_path || '/uploads/banners/DefaultBanner.jpeg'
  );
  const logoSrc = buildUploadSrc(group?.logo_path || '/uploads/logos/default-logo.png');

  const tabs = TABS.filter((tab) => tab.key !== 'subgroups' || subCount > 0 || canEditCommunity);

  if (isLoading && !group) {
    return (
      <AppShell>
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <View style={styles.loadingWrap}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell>
        <View style={styles.loadingWrap}>
          <ThemedText style={styles.errorText}>Group not found.</ThemedText>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.heroCard, isNarrow && styles.heroCardNarrow]}>
          <Image source={{ uri: bannerSrc }} style={[styles.heroBanner, { height: bannerHeight }]} />
          <View style={[styles.heroLogoWrap, heroLogoWrapStyle]}>
            <Image source={{ uri: logoSrc }} style={[styles.heroLogo, heroLogoStyle]} />
          </View>
          <View
            style={[
              styles.heroContent,
              {
                paddingLeft: isNarrow ? 16 : 16 + logoSize + 16,
                paddingTop: isNarrow ? logoSize - 45 : 12,
              },
            ]}
          >
            <View style={styles.heroLeft}>
              <View style={styles.heroText}>
                <ThemedText style={styles.heroTitle}>{group.name || 'Group'}</ThemedText>
                {group.tagline ? (
                  <ThemedText style={styles.heroSub}>{group.tagline}</ThemedText>
                ) : null}
                {group.location ? (
                  <ThemedText style={styles.heroSub}>{group.location}</ThemedText>
                ) : null}
                {group.parent_name ? (
                  <ThemedText style={styles.heroSub}>
                    Part of {group.parent_name}
                  </ThemedText>
                ) : null}
                <View style={styles.heroRow}>
                  <ThemedText style={styles.heroMeta}>
                    {followerCount} follower{followerCount === 1 ? '' : 's'}
                  </ThemedText>
                  <ThemedText style={styles.heroMeta}>
                    {subCount} {subCount === 1 ? 'sub-group' : 'sub-groups'}
                  </ThemedText>
                </View>
              </View>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                onPress={handleFollowToggle}
                disabled={isFollowBusy}
                style={[styles.followButton, group.is_following && styles.followButtonSecondary]}
              >
                <LinearGradient
                  colors={
                    group.is_following
                      ? [hexToRgba(colors.text, 0.08), hexToRgba(colors.text, 0.08)]
                      : [colors.primaryFrom, colors.primaryTo]
                  }
                  style={styles.followButtonGradient}
                >
                  <ThemedText
                    style={[
                      styles.followButtonText,
                      group.is_following && styles.followButtonTextSecondary,
                    ]}
                  >
                    {isFollowBusy ? 'Updating…' : group.is_following ? 'Unfollow' : 'Follow'}
                  </ThemedText>
                </LinearGradient>
              </Pressable>
              {canEditCommunity ? (
                <Pressable
                  style={[styles.followButton, styles.followButtonSecondary]}
                  onPress={openEditModal}
                >
                  <View style={styles.followButtonGradient}>
                    <ThemedText style={styles.followButtonTextSecondary}>Edit Community</ThemedText>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={styles.tabsRow}>
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}>
                  <View style={styles.tabButton}>
                    <ThemedText style={[styles.tabText, active && styles.tabTextActive]}>
                      {tab.label}
                    </ThemedText>
                    {active ? <View style={styles.tabUnderline} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {activeTab === 'overview' ? (
          <View style={styles.contentCard}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Pinned</ThemedText>
              <ThemedText style={styles.sectionSub}>
                Ambassador-picked threads and forums for {group.name}.
              </ThemedText>
            </View>
            {loadingPinned ? <ActivityIndicator /> : null}
            {!loadingPinned && pinnedItems.length === 0 ? (
              <ThemedText style={styles.mutedText}>No pinned threads or forums yet.</ThemedText>
            ) : (
              pinnedItems.map((item) => {
                const isThread = item.item_type === 'thread';
                const threadId = item.thread_id || item.item_id;
                const forumId = item.forum_id || item.item_id;
                return (
                  <Pressable
                    key={item.pin_id || `${item.item_type}:${item.item_id}`}
                    style={styles.pinnedCard}
                    onPress={() => {
                      if (isThread && threadId) {
                        router.push(`/thread/${threadId}`);
                      } else if (!isThread && forumId) {
                        router.push(`/info/forum/${forumId}`);
                      }
                    }}
                  >
                    <ThemedText style={styles.pinnedTitle}>{item.title || 'Pinned item'}</ThemedText>
                    {isThread ? (
                      <ThemedText style={styles.pinnedMeta}>
                        {item.forum_name || 'Forum'} • {item.post_count || 0} replies
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.pinnedMeta}>
                        {item.thread_count || 0} threads
                      </ThemedText>
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

        {activeTab === 'subgroups' ? (
          <View style={styles.contentCard}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Sub-Groups</ThemedText>
              <ThemedText style={styles.sectionSub}>
                Teams or programs inside {group.name}.
              </ThemedText>
            </View>
            {loadingSub ? <ActivityIndicator /> : null}
            {!loadingSub && subcommunities.length === 0 ? (
              <ThemedText style={styles.mutedText}>No sub-groups yet.</ThemedText>
            ) : (
              subcommunities.map((sub) => (
                <Pressable
                  key={sub.community_id}
                  style={styles.subCard}
                  onPress={() => {
                    router.push(
                      sub.community_type === 'university'
                        ? {
                            pathname: '/university/[communityId]',
                            params: { communityId: sub.community_id },
                          }
                        : {
                            pathname: '/group/[communityId]',
                            params: { communityId: sub.community_id },
                          }
                    );
                  }}
                >
                  <Image
                    source={{ uri: buildUploadSrc(sub.logo_path || '/uploads/logos/default-logo.png') }}
                    style={styles.subLogo}
                  />
                  <View style={styles.subContent}>
                    <ThemedText style={styles.subName}>{sub.name}</ThemedText>
                    {sub.tagline ? <ThemedText style={styles.subMeta}>{sub.tagline}</ThemedText> : null}
                    {sub.location ? <ThemedText style={styles.subMeta}>{sub.location}</ThemedText> : null}
                    <ThemedText style={styles.subMeta}>
                      Followers: {sub.followers_count || 0}
                    </ThemedText>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'reels' ? (
          <View style={styles.contentCard}>
            <ReelGrid communityId={communityId} title={`${group?.name || 'Community'} reels`} />
          </View>
        ) : null}

        {activeTab === 'posts' ? (
          <View style={styles.contentCard}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Pinned Topics</ThemedText>
              <ThemedText style={styles.sectionSub}>
                Threads and forums highlighted by group ambassadors.
              </ThemedText>
            </View>
            {loadingPinned ? <ActivityIndicator /> : null}
            {!loadingPinned && pinnedItems.length === 0 ? (
              <ThemedText style={styles.mutedText}>No pinned topics yet.</ThemedText>
            ) : (
              pinnedItems.map((item) => {
                const isThread = item.item_type === 'thread';
                const threadId = item.thread_id || item.item_id;
                const forumId = item.forum_id || item.item_id;
                return (
                  <Pressable
                    key={`${item.item_type}:${item.item_id}`}
                    style={styles.pinnedCard}
                    onPress={() => {
                      if (isThread && threadId) {
                        router.push(`/thread/${threadId}`);
                      } else if (!isThread && forumId) {
                        router.push(`/info/forum/${forumId}`);
                      }
                    }}
                  >
                  <ThemedText style={styles.pinnedTitle}>{item.title}</ThemedText>
                  <ThemedText style={styles.pinnedMeta}>
                    {item.item_type === 'thread' ? 'Thread' : 'Forum'} •{' '}
                    {item.item_type === 'thread'
                      ? `${item.post_count || 0} replies`
                      : `${item.thread_count || 0} threads`}
                  </ThemedText>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

        {activeTab === 'qa' ? (
          <View style={styles.contentCard}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Group Q+A</ThemedText>
              <ThemedText style={styles.sectionSub}>
                Submit a question for ambassadors. Approved items appear for everyone.
              </ThemedText>
            </View>
            {loadingQuestions ? <ActivityIndicator /> : null}
            {!loadingQuestions && questions.length === 0 ? (
              <ThemedText style={styles.mutedText}>No questions yet.</ThemedText>
            ) : (
              questions.map((q) => (
                <View key={q.question_id} style={styles.qaCard}>
                  <View style={styles.qaHeader}>
                    <ThemedText style={styles.qaTitle}>{q.title}</ThemedText>
                    <ThemedText style={styles.qaMeta}>
                      Asked by {q.asker_first_name} {q.asker_last_name}
                      {q.status === 'pending' ? ' · Pending approval' : ''}
                    </ThemedText>
                  </View>
                  {q.body ? <ThemedText style={styles.qaBody}>{q.body}</ThemedText> : null}
                  {(q.answers || []).length > 0 ? (
                    (q.answers || []).map((ans) => (
                      <View key={ans.answer_id} style={styles.qaAnswer}>
                        <ThemedText style={styles.qaAnswerName}>
                          {ans.first_name} {ans.last_name}
                        </ThemedText>
                        <ThemedText style={styles.qaAnswerBody}>{ans.body}</ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText style={styles.mutedText}>No answers yet.</ThemedText>
                  )}
                </View>
              ))
            )}
            <Pressable
              style={styles.askButton}
              onPress={() => Alert.alert('Coming soon', 'Asking questions is not yet available.')}
            >
              <MaterialCommunityIcons name="comment-question-outline" size={16} color="#fff" />
              <ThemedText style={styles.askButtonText}>Ask a question</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        transparent
        visible={showEditModal}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <ThemedText style={styles.modalTitle}>Edit Community</ThemedText>
                <ThemedText style={styles.modalSubtitle}>
                  Update basic info, branding, and media.
                </ThemedText>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setShowEditModal(false)}>
                <MaterialCommunityIcons name="close" size={18} color={colors.subtext} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              <View style={styles.formField}>
                <ThemedText style={styles.formLabel}>Name</ThemedText>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  style={styles.input}
                  placeholder="Community name"
                  placeholderTextColor={colors.subtext}
                />
              </View>
              <View style={styles.formField}>
                <ThemedText style={styles.formLabel}>Tagline</ThemedText>
                <TextInput
                  value={editTagline}
                  onChangeText={setEditTagline}
                  style={styles.input}
                  placeholder="Short description"
                  placeholderTextColor={colors.subtext}
                />
              </View>
              <View style={styles.formField}>
                <ThemedText style={styles.formLabel}>Location</ThemedText>
                <TextInput
                  value={editLocation}
                  onChangeText={setEditLocation}
                  style={styles.input}
                  placeholder="City, State"
                  placeholderTextColor={colors.subtext}
                />
              </View>
              <View style={styles.formField}>
                <ThemedText style={styles.formLabel}>Website</ThemedText>
                <TextInput
                  value={editWebsite}
                  onChangeText={setEditWebsite}
                  style={styles.input}
                  autoCapitalize="none"
                  placeholder="https://"
                  placeholderTextColor={colors.subtext}
                />
              </View>
              <View style={styles.formField}>
                <ThemedText style={styles.formLabel}>Primary Color</ThemedText>
                <View style={styles.colorRow}>
                  <TextInput
                    value={editPrimaryColor}
                    onChangeText={setEditPrimaryColor}
                    style={[styles.input, styles.colorInput]}
                    autoCapitalize="none"
                    placeholder="#2F80ED"
                    placeholderTextColor={colors.subtext}
                  />
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: editPrimaryColor || '#2F80ED' },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.formField}>
                <ThemedText style={styles.formLabel}>Secondary Color</ThemedText>
                <View style={styles.colorRow}>
                  <TextInput
                    value={editSecondaryColor}
                    onChangeText={setEditSecondaryColor}
                    style={[styles.input, styles.colorInput]}
                    autoCapitalize="none"
                    placeholder="#1D5FC4"
                    placeholderTextColor={colors.subtext}
                  />
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: editSecondaryColor || '#1D5FC4' },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.formField}>
                <ThemedText style={styles.formLabel}>Logo</ThemedText>
                <View style={styles.uploadRow}>
                  <Pressable style={styles.uploadButton} onPress={() => pickImage(setEditLogoAsset)}>
                    <ThemedText style={styles.uploadButtonText}>Select image</ThemedText>
                  </Pressable>
                  <ThemedText style={styles.fileMeta}>
                    {getAssetLabel(editLogoAsset, 'No file selected')}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.formField}>
                <ThemedText style={styles.formLabel}>Banner</ThemedText>
                <View style={styles.uploadRow}>
                  <Pressable style={styles.uploadButton} onPress={() => pickImage(setEditBannerAsset)}>
                    <ThemedText style={styles.uploadButtonText}>Select image</ThemedText>
                  </Pressable>
                  <ThemedText style={styles.fileMeta}>
                    {getAssetLabel(editBannerAsset, 'No file selected')}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.pillButton, styles.pillPrimary]}
                  disabled={isSavingEdit}
                  onPress={handleUpdateCommunity}
                >
                  <ThemedText style={styles.pillText}>
                    {isSavingEdit ? 'Saving…' : 'Save changes'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.pillButton, styles.pillSecondary]}
                  onPress={() => setShowEditModal(false)}
                >
                  <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>Cancel</ThemedText>
                </Pressable>
              </View>
              {editStatus ? <ThemedText style={styles.editStatus}>{editStatus}</ThemedText> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  container: {
    paddingHorizontal: Brand.spacing.lg,
    paddingTop: 0,
    paddingBottom: 32,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: colors.danger,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  heroCardNarrow: {
    borderRadius: 0,
    marginHorizontal: -Brand.spacing.lg,
  },
  heroBanner: {
    width: '100%',
  },
  heroLogoWrap: {
    position: 'absolute',
    backgroundColor: colors.card,
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    borderRadius: 999,
    borderWidth: 4,
    borderColor: colors.card,
  },
  heroContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    marginTop: 6,
  },
  heroLeft: {
    flex: 1,
  },
  heroText: {
    gap: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  heroSub: {
    fontSize: 12,
    color: colors.subtext,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  heroMeta: {
    fontSize: 12,
    color: colors.subtext,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  followButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  followButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  followButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  followButtonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: hexToRgba(colors.text, 0.05),
  },
  followButtonTextSecondary: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabButton: {
    paddingVertical: 10,
  },
  tabText: {
    fontSize: 12,
    color: colors.text,
  },
  tabTextActive: {
    color: colors.primaryFrom,
    fontWeight: '600',
  },
  tabUnderline: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primaryFrom,
    marginTop: 6,
  },
  contentCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.subtext,
  },
  mutedText: {
    fontSize: 12,
    color: colors.subtext,
  },
  pinnedCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: hexToRgba(colors.text, 0.04),
  },
  pinnedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pinnedMeta: {
    fontSize: 12,
    color: colors.subtext,
  },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  subLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  subContent: {
    flex: 1,
    gap: 2,
  },
  subName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  subMeta: {
    fontSize: 12,
    color: colors.subtext,
  },
  qaCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: colors.card,
  },
  qaHeader: {
    gap: 2,
  },
  qaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  qaMeta: {
    fontSize: 11,
    color: colors.subtext,
  },
  qaBody: {
    fontSize: 12,
    color: colors.text,
  },
  qaAnswer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    gap: 4,
  },
  qaAnswerName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  qaAnswerBody: {
    fontSize: 12,
    color: colors.subtext,
  },
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 10,
    backgroundColor: colors.primaryFrom,
  },
  askButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitleBlock: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.subtext,
  },
  modalClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.text, 0.06),
  },
  modalForm: {
    gap: 12,
    paddingTop: 16,
    paddingBottom: 8,
  },
  formField: {
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hexToRgba('#94a3b8', 0.35),
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: colors.card,
    color: colors.text,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorInput: {
    flex: 1,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  uploadButton: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primaryFrom,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  fileMeta: {
    fontSize: 12,
    color: colors.subtext,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  pillButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primaryFrom,
  },
  pillPrimary: {
    backgroundColor: colors.primaryFrom,
  },
  pillSecondary: {
    backgroundColor: hexToRgba(colors.text, 0.08),
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  pillSecondaryText: {
    color: colors.text,
  },
  editStatus: {
    fontSize: 12,
    color: colors.subtext,
  },
});
