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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AppShell from '@/components/navigation/AppShell';
import ReelGrid from '@/components/reels/ReelGrid';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { apiClient } from '@/lib/api/client';
import { buildAvatarSrc, buildUploadSrc } from '@/lib/uploads';
import { getTagStyle } from '@/lib/utils/tags';
import { timeAgo } from '@/lib/utils/time';

type ProfileUser = {
  user_id?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  about?: string;
  skills?: string;
  avatar_path?: string | null;
  banner_path?: string | null;
  verified?: number | string;
  verified_community_id?: string | number | null;
  is_public?: number | string;
  is_ambassador?: number | string;
  recent_university_id?: string | number | null;
  profile_visibility?: string | null;
  allow_messages_from?: string | null;
  show_email?: number | string | boolean | null;
  email_visible?: number | string | boolean | null;
  email?: string | null;
  community_ambassador_of?: Array<string | number> | string | null;
};

type ExperienceItem = {
  experience_id?: string;
  title?: string;
  company?: string;
  start_date?: string;
  end_date?: string;
  employment_type?: string;
  location_city?: string;
  location_state?: string;
  description?: string;
  responsibilities?: string[] | null;
};

type EducationItem = {
  education_id?: string;
  degree?: string;
  field_of_study?: string;
  institution?: string;
  start_date?: string;
  end_date?: string;
  gpa?: string;
  honors?: string;
  activities_societies?: string;
  achievements?: string[] | null;
};

type ThreadItem = {
  thread_id: string;
  forum_id?: string;
  forum_name?: string;
  community_name?: string;
  community_id?: string;
  title?: string;
  created_at?: string;
  upvotes?: number | string;
  downvotes?: number | string;
  post_count?: number | string;
  tags?: string[];
};

const stripHtml = (value?: string | null) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

const parseAmbassadorIds = (raw: ProfileUser['community_ambassador_of']) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item) => String(item));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return raw ? [raw] : [];
    }
  }
  if (typeof raw === 'number') return [String(raw)];
  return [];
};

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const router = useRouter();
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 640;
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [verified, setVerified] = useState(false);
  const [verifiedCommunityName, setVerifiedCommunityName] = useState('');
  const [ambassadorCommunities, setAmbassadorCommunities] = useState<string[]>([]);
  const [communityLogos, setCommunityLogos] = useState<Record<string, string>>({});
  const [communityNames, setCommunityNames] = useState<Record<string, string>>({});

  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollowStatus, setLoadingFollowStatus] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [messageRestriction, setMessageRestriction] = useState('');
  const [openMenu, setOpenMenu] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [isRequester, setIsRequester] = useState(false);

  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingEdu, setLoadingEdu] = useState(true);
  const [errorExp, setErrorExp] = useState<string | null>(null);
  const [errorEdu, setErrorEdu] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'about' | 'reels' | 'posts'>('about');
  const [userThreads, setUserThreads] = useState<ThreadItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [hasLoadedThreads, setHasLoadedThreads] = useState(false);

  const bannerHeight = isNarrow ? 120 : 180;
  const logoSize = isNarrow ? 90 : 120;

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
      top: isNarrow ? bannerHeight - logoSize / 2 - 24 : -10,
      bottom: isNarrow ? undefined : 10,
    }),
    [logoSize, bannerHeight, isNarrow]
  );

  useEffect(() => {
    setActiveTab('about');
  }, [userId]);

  useEffect(() => {
    setUserThreads([]);
    setHasLoadedThreads(false);
    setThreadsError(null);
  }, [userId, user?.user_id]);

  useEffect(() => {
    setOpenMenu(false);
    setMessageRestriction('');
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    setIsLoading(true);
    setError(null);
    apiClient
      .get('/fetch_user.php', { params: { user_id: userId } })
      .then((resp) => {
        if (!mounted) return;
        if ((resp.data as any)?.success) {
          const nextProfile = (resp.data as any)?.user as ProfileUser;
          setProfile(nextProfile);
          const isVerified = Number(nextProfile?.verified) === 1;
          setVerified(Boolean(isVerified));

          const communityIds = parseAmbassadorIds(nextProfile?.community_ambassador_of);
          setAmbassadorCommunities(communityIds);
          if (communityIds.length) {
            fetchCommunityBadges(communityIds);
          } else {
            setCommunityLogos({});
            setCommunityNames({});
          }
        } else {
          setError((resp.data as any)?.error || 'Unable to load profile.');
        }
      })
      .catch(() => {
        if (!mounted) return;
        setError('Unable to load profile.');
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (!verified || !profile?.verified_community_id) {
      setVerifiedCommunityName('');
      return;
    }
    apiClient
      .get('/fetch_university.php', { params: { community_id: profile.verified_community_id } })
      .then((resp) => {
        if ((resp.data as any)?.success && (resp.data as any)?.university?.name) {
          setVerifiedCommunityName((resp.data as any)?.university?.name || '');
        }
      })
      .catch(() => setVerifiedCommunityName(''));
  }, [profile?.verified_community_id, verified, userId]);

  useEffect(() => {
    if (!user?.user_id || !userId) {
      setLoadingFollowStatus(false);
      return;
    }
    setLoadingFollowStatus(true);
    apiClient
      .get('/fetch_following_status.php', {
        params: { follower_id: user.user_id, followed_user_id: userId },
      })
      .then((resp) => {
        if ((resp.data as any)?.success) {
          setIsFollowing(Boolean((resp.data as any)?.isFollowing));
        }
      })
      .catch(() => setIsFollowing(false))
      .finally(() => setLoadingFollowStatus(false));
  }, [user?.user_id, userId]);

  useEffect(() => {
    if (!userId) return;
    apiClient
      .get('/fetch_follower_count.php', { params: { user_id: userId } })
      .then((resp) => {
        if ((resp.data as any)?.success) {
          setFollowerCount(Number((resp.data as any)?.follower_count || 0));
        }
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    apiClient
      .get('/fetch_following_count.php', { params: { user_id: userId } })
      .then((resp) => {
        if ((resp.data as any)?.success) {
          setFollowingCount(Number((resp.data as any)?.following_count || 0));
        }
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!user?.user_id || !userId) return;
    apiClient
      .get('/fetch_connection_status.php', {
        params: { user_id1: user.user_id, user_id2: userId },
      })
      .then((resp) => {
        if ((resp.data as any)?.success) {
          setConnectionStatus((resp.data as any)?.status || 'none');
          const cid = (resp.data as any)?.connection_id;
          setConnectionId(cid ? String(cid) : null);
          setIsRequester(Boolean((resp.data as any)?.is_sender));
        }
      })
      .catch(() => {});
  }, [user?.user_id, userId]);

  useEffect(() => {
    if (!userId) return;
    setLoadingExp(true);
    setLoadingEdu(true);
    setErrorExp(null);
    setErrorEdu(null);

    apiClient
      .get('/user_experience.php', { params: { user_id: userId } })
      .then((resp) => {
        setExperience(Array.isArray(resp.data) ? (resp.data as ExperienceItem[]) : []);
      })
      .catch(() => setErrorExp('Error fetching experience.'))
      .finally(() => setLoadingExp(false));

    apiClient
      .get('/user_education.php', { params: { user_id: userId } })
      .then((resp) => {
        setEducation(Array.isArray(resp.data) ? (resp.data as EducationItem[]) : []);
      })
      .catch(() => setErrorEdu('Error fetching education.'))
      .finally(() => setLoadingEdu(false));
  }, [userId]);

  const fetchCommunityBadges = async (communityIds: string[]) => {
    const logos: Record<string, string> = {};
    const names: Record<string, string> = {};
    await Promise.all(
      communityIds.map(async (communityId) => {
        try {
          const resp = await apiClient.get('/fetch_community.php', {
            params: { community_id: communityId },
          });
          if ((resp.data as any)?.success && (resp.data as any)?.community) {
            logos[communityId] = (resp.data as any)?.community?.logo_path || '';
            names[communityId] = (resp.data as any)?.community?.name || 'Community';
          }
        } catch {
          // ignore
        }
      })
    );
    setCommunityLogos(logos);
    setCommunityNames(names);
  };

  const fetchProfileThreads = async () => {
    if (!userId) return;
    setThreadsLoading(true);
    setThreadsError(null);
    try {
      const resp = await apiClient.get('/fetch_user_threads.php', {
        params: { user_id: userId, viewer_id: user?.user_id || '' },
      });
      if ((resp.data as any)?.success) {
        setUserThreads((resp.data as any)?.threads || []);
      } else {
        setThreadsError((resp.data as any)?.error || 'Unable to load posts.');
      }
    } catch {
      setThreadsError('Unable to load posts.');
    } finally {
      setThreadsLoading(false);
      setHasLoadedThreads(true);
    }
  };

  useEffect(() => {
    if (activeTab === 'posts' && !hasLoadedThreads) {
      fetchProfileThreads();
    }
  }, [activeTab, hasLoadedThreads, userId, user?.user_id]);

  const handleFollowToggle = async () => {
    if (!user?.user_id || !userId) {
      openLockedFeature('Following users');
      return;
    }
    try {
      const endpoint = isFollowing ? '/unfollow_user.php' : '/follow_user.php';
      await apiClient.post(endpoint, {
        follower_id: user.user_id,
        followed_user_id: userId,
      });
      setIsFollowing((prev) => !prev);
    } catch {
      Alert.alert('Unable to update', 'Please try again.');
    } finally {
      setOpenMenu(false);
    }
  };

  const handleConnect = async () => {
    if (!user?.user_id || !userId) {
      openLockedFeature('Connections');
      return;
    }
    try {
      const resp = await apiClient.post('/request_connection.php', {
        user_id1: user.user_id,
        user_id2: userId,
      });
      if ((resp.data as any)?.success) {
        setConnectionStatus('pending');
        const cid = (resp.data as any)?.connection_id;
        setConnectionId(cid ? String(cid) : null);
        setIsRequester(true);
      }
    } catch {
      Alert.alert('Unable to connect', 'Please try again.');
    }
  };

  const handleAccept = async () => {
    if (!connectionId && !(user?.user_id && userId)) return;
    try {
      await apiClient.post('/accept_connection.php', {
        connection_id: connectionId,
        user_id1: user?.user_id,
        user_id2: userId,
      });
      setConnectionStatus('accepted');
      setIsRequester(false);
    } catch {
      Alert.alert('Unable to accept', 'Please try again.');
    }
  };

  const handleCancel = async () => {
    if (!connectionId) return;
    try {
      await apiClient.post('/cancel_connection.php', { connection_id: connectionId });
      setConnectionStatus('none');
      setConnectionId(null);
      setIsRequester(false);
    } catch {
      Alert.alert('Unable to cancel', 'Please try again.');
    }
  };

  const handleRemoveConnection = async () => {
    if (!user?.user_id || !userId) return;
    try {
      await apiClient.post('/remove_connection.php', {
        user_id1: user.user_id,
        user_id2: userId,
      });
      setConnectionStatus('none');
      setConnectionId(null);
      setIsRequester(false);
    } catch {
      Alert.alert('Unable to remove', 'Please try again.');
    } finally {
      setOpenMenu(false);
    }
  };

  const allowMessagesFrom = String(profile?.allow_messages_from || 'everyone').toLowerCase();
  const isConnected = connectionStatus === 'accepted';
  const sharesCommunity =
    profile?.recent_university_id &&
    user?.recent_university_id &&
    String(profile.recent_university_id) === String(user.recent_university_id);
  const canMessageUser = () => {
    if (!user?.user_id) return false;
    if (allowMessagesFrom === 'everyone') return true;
    if (allowMessagesFrom === 'connections') return isConnected;
    if (allowMessagesFrom === 'community') return isConnected || sharesCommunity;
    return true;
  };

  const handleMessagePress = () => {
    if (!userId) return;
    if (!user?.user_id) {
      openLockedFeature('Messaging');
      return;
    }
    if (canMessageUser()) {
      setMessageRestriction('');
      router.push(`/messages?user=${userId}`);
      return;
    }
    let reason = 'Connect with this user first to send messages.';
    if (allowMessagesFrom === 'community') {
      reason = 'Join the same community or connect to message this user.';
    }
    setMessageRestriction(reason);
  };

  if (isLoading && !profile) {
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

  if (!profile || !userId) {
    return (
      <AppShell>
        <View style={styles.loadingWrap}>
          <ThemedText style={styles.errorText}>User not found.</ThemedText>
        </View>
      </AppShell>
    );
  }

  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
  const displayHeadline = profile.headline || 'Student at Your University';
  const displayAbout = stripHtml(profile.about) || 'No about information provided yet.';
  const displaySkills = profile.skills || '';
  const isDefaultAvatar = String(profile.avatar_path || '').includes('DefaultAvatar');
  const isOwnProfile = user && String(user.user_id) === String(userId);
  const isPrivateProfile = Number(profile.is_public) === 0;
  const profileVisibility = profile.profile_visibility || 'network';
  const isAmbassadorProfile = Number(profile.is_ambassador) === 1;
  const viewerCommunityId = user?.recent_university_id;
  const ambassadorCommunityIds = ambassadorCommunities.map((id) => Number(id));
  const sharesAmbassadorCommunity =
    Boolean(viewerCommunityId) &&
    ambassadorCommunityIds.some((cid) => Number(cid) === Number(viewerCommunityId));
  const isNetworkRestricted =
    profileVisibility === 'network' &&
    isAmbassadorProfile &&
    !isOwnProfile &&
    !isConnected &&
    !sharesAmbassadorCommunity;
  const isRestrictedForPrivacy =
    (profileVisibility === 'private' || isPrivateProfile) && !isOwnProfile && !isConnected;
  const shouldBlurDetails = !user || isRestrictedForPrivacy || isNetworkRestricted;

  const contactVisibilityRaw = profile.show_email;
  const contactVisibility = Number(contactVisibilityRaw === true ? 2 : contactVisibilityRaw || 0);
  const emailVisibleFlag =
    profile.email_visible === true ||
    profile.email_visible === '1' ||
    Number(profile.email_visible) === 1;
  const contactEmail = profile.email || '';
  const viewerCanSeeEmail =
    isOwnProfile ||
    emailVisibleFlag ||
    contactVisibility === 2 ||
    (contactVisibility === 1 && isConnected);
  const canDisplayEmailValue = viewerCanSeeEmail && Boolean(contactEmail);

  const primaryAmbassadorCommunity =
    Array.isArray(ambassadorCommunities) && ambassadorCommunities.length > 0
      ? ambassadorCommunities[0]
      : null;
  const primaryAmbassadorLogo =
    primaryAmbassadorCommunity && communityLogos[primaryAmbassadorCommunity]
      ? buildUploadSrc(communityLogos[primaryAmbassadorCommunity])
      : '';

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.heroCard, isNarrow && styles.heroCardNarrow]}>
          <Image
            source={{ uri: buildUploadSrc(profile.banner_path || '/uploads/banners/DefaultBanner.jpeg') }}
            style={[styles.heroBanner, { height: bannerHeight }]}
          />
          <View style={[styles.heroLogoWrap, heroLogoWrapStyle]}>
            <Image
              source={{ uri: buildAvatarSrc(profile.avatar_path) }}
              style={[styles.heroLogo, heroLogoStyle, isDefaultAvatar && styles.heroLogoDefault]}
            />
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
                <View style={styles.heroTitleRow}>
                  <ThemedText style={styles.heroTitle}>{fullName}</ThemedText>
                  {verified ? (
                    <MaterialCommunityIcons
                      name="check-decagram"
                      size={18}
                      color={colors.primaryFrom}
                      accessibilityLabel={verifiedCommunityName ? `Verified from ${verifiedCommunityName}` : 'Verified'}
                    />
                  ) : null}
                  {primaryAmbassadorLogo ? (
                    <Image source={{ uri: primaryAmbassadorLogo }} style={styles.ambassadorInlineLogo} />
                  ) : null}
                </View>
                <View style={styles.heroSubtitleRow}>
                  <ThemedText style={styles.heroSub}>{displayHeadline}</ThemedText>
                  {!verified ? (
                    <View style={styles.statusPill}>
                      <ThemedText style={styles.statusPillText}>Unverified</ThemedText>
                    </View>
                  ) : null}
                </View>
                <View style={styles.heroRow}>
                  <ThemedText style={styles.heroMeta}>{followerCount} Followers</ThemedText>
                  <ThemedText style={styles.heroMeta}>{followingCount} Following</ThemedText>
                </View>
                {ambassadorCommunities.length > 0 ? (
                  <View style={styles.ambassadorRow}>
                    {ambassadorCommunities.map((communityId) => (
                      <Pressable
                        key={communityId}
                        onPress={() => router.push(`/university/${communityId}`)}
                      >
                        <Image
                          source={{
                            uri: buildUploadSrc(
                              communityLogos[communityId] || '/uploads/logos/default-logo.png'
                            ),
                          }}
                          style={styles.ambassadorLogo}
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            {user && !isOwnProfile ? (
              <View style={styles.heroActions}>
                {connectionStatus === 'accepted' ? (
                  <Pressable onPress={handleMessagePress} style={styles.actionButton}>
                    <LinearGradient
                      colors={['#22c55e', '#16a34a']}
                      style={styles.actionButtonGradient}
                    >
                      <ThemedText style={styles.actionButtonText}>Message</ThemedText>
                    </LinearGradient>
                  </Pressable>
                ) : connectionStatus === 'pending' ? (
                  isRequester ? (
                    <View style={[styles.actionButton, styles.actionButtonSecondary]}>
                      <ThemedText style={styles.actionButtonTextSecondary}>Pending</ThemedText>
                    </View>
                  ) : (
                    <Pressable onPress={handleAccept} style={styles.actionButton}>
                      <LinearGradient
                        colors={[colors.primaryFrom, colors.primaryTo]}
                        style={styles.actionButtonGradient}
                      >
                        <ThemedText style={styles.actionButtonText}>Accept</ThemedText>
                      </LinearGradient>
                    </Pressable>
                  )
                ) : (
                  <Pressable onPress={handleConnect} style={styles.actionButton}>
                    <LinearGradient
                      colors={[colors.primaryFrom, colors.primaryTo]}
                      style={styles.actionButtonGradient}
                    >
                      <ThemedText style={styles.actionButtonText}>Connect</ThemedText>
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            ) : null}

            {messageRestriction ? (
              <View style={styles.infoBanner}>
                <ThemedText style={styles.infoBannerText}>{messageRestriction}</ThemedText>
              </View>
            ) : null}

            {user && !isOwnProfile ? (
              <View style={styles.kebabMenu}>
                <Pressable
                  onPress={() => setOpenMenu((prev) => !prev)}
                  accessibilityLabel="Profile menu"
                >
                  <MaterialCommunityIcons name="dots-vertical" size={18} color={colors.subtext} />
                </Pressable>
                {openMenu ? (
                  <View style={styles.dropdownMenu}>
                    <Pressable
                      style={styles.dropdownItem}
                      onPress={handleFollowToggle}
                      disabled={loadingFollowStatus}
                    >
                      <ThemedText style={styles.dropdownText}>
                        {isFollowing ? 'Unfollow' : 'Follow'}
                      </ThemedText>
                    </Pressable>
                    {connectionStatus === 'accepted' ? (
                      <Pressable style={styles.dropdownItem} onPress={handleRemoveConnection}>
                        <ThemedText style={styles.dropdownText}>Remove Connection</ThemedText>
                      </Pressable>
                    ) : null}
                    {connectionStatus === 'pending' && isRequester ? (
                      <Pressable style={styles.dropdownItem} onPress={handleCancel}>
                        <ThemedText style={styles.dropdownText}>Cancel Request</ThemedText>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={styles.dropdownItem}
                      onPress={() => Alert.alert('Coming soon', 'Report or block is not yet available.')}
                    >
                      <ThemedText style={styles.dropdownText}>Report or Block</ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.tabsRow}>
            {[
              { id: 'about', label: 'About' },
              { id: 'reels', label: 'Reels' },
              { id: 'posts', label: 'Posts' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable key={tab.id} onPress={() => setActiveTab(tab.id as typeof activeTab)}>
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

        <View style={styles.detailCard}>
          {shouldBlurDetails ? (
            <View style={styles.ctaCard}>
              <ThemedText style={styles.ctaText}>
                {isRestrictedForPrivacy
                  ? "This user's account is private. Send a connection request to view their info."
                  : 'Want more details? Log in or create an account to unlock experience, education, and skills.'}
              </ThemedText>
              <View style={styles.ctaActions}>
                {isRestrictedForPrivacy ? (
                  connectionStatus === 'pending' ? (
                    isRequester ? (
                      <View style={[styles.ctaButton, styles.ctaButtonGhost]}>
                        <ThemedText style={styles.ctaButtonTextGhost}>Request pending</ThemedText>
                      </View>
                    ) : (
                      <Pressable style={styles.ctaButton} onPress={handleAccept}>
                        <ThemedText style={styles.ctaButtonText}>Accept request to view</ThemedText>
                      </Pressable>
                    )
                  ) : (
                    <Pressable style={styles.ctaButton} onPress={handleConnect}>
                      <ThemedText style={styles.ctaButtonText}>Send connection request</ThemedText>
                    </Pressable>
                  )
                ) : (
                  <>
                    <Pressable style={styles.ctaButton} onPress={() => router.push('/login')}>
                      <ThemedText style={styles.ctaButtonText}>Log In</ThemedText>
                    </Pressable>
                    <Pressable
                      style={[styles.ctaButton, styles.ctaButtonGhost]}
                      onPress={() => Alert.alert('Coming soon', 'Account creation is not yet available on mobile.')}
                    >
                      <ThemedText style={styles.ctaButtonTextGhost}>Create Account</ThemedText>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          ) : null}

          <View style={[styles.detailSections, shouldBlurDetails && styles.detailSectionsRestricted]}>
            {shouldBlurDetails ? <View style={styles.detailOverlay} pointerEvents="none" /> : null}

            {activeTab === 'about' ? (
              <View style={styles.aboutWrap}>
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionTitle}>About</ThemedText>
                  </View>
                  <ThemedText style={styles.sectionBody}>{displayAbout}</ThemedText>
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionTitle}>Experience</ThemedText>
                  </View>
                  {loadingExp ? <ActivityIndicator /> : null}
                  {!loadingExp && errorExp ? (
                    <ThemedText style={styles.mutedText}>{errorExp}</ThemedText>
                  ) : null}
                  {!loadingExp && !errorExp && experience.length === 0 ? (
                    <ThemedText style={styles.mutedText}>No experience added yet.</ThemedText>
                  ) : null}
                  {experience.map((exp, idx) => {
                    const responsibilities = Array.isArray(exp.responsibilities)
                      ? exp.responsibilities
                      : [];
                    return (
                      <View key={`${exp.experience_id || idx}`} style={styles.detailItem}>
                        <ThemedText style={styles.detailTitle}>
                          {exp.title || 'Role'} {exp.company ? `at ${exp.company}` : ''}
                        </ThemedText>
                        {exp.start_date ? (
                          <ThemedText style={styles.detailMeta}>
                            {exp.start_date} - {exp.end_date || 'Present'}
                          </ThemedText>
                        ) : null}
                        <View style={styles.detailMetaRow}>
                          {exp.employment_type ? (
                            <ThemedText style={styles.detailMeta}>{exp.employment_type}</ThemedText>
                          ) : null}
                          {(exp.location_city || exp.location_state) ? (
                            <ThemedText style={styles.detailMeta}>
                              {exp.location_city || ''}
                              {exp.location_state ? `, ${exp.location_state}` : ''}
                            </ThemedText>
                          ) : null}
                        </View>
                        {exp.description ? (
                          <ThemedText style={styles.detailBody}>{exp.description}</ThemedText>
                        ) : null}
                        {responsibilities.length > 0 ? (
                          <View style={styles.detailList}>
                            {responsibilities.map((resp, rIdx) => (
                              <View key={`${exp.experience_id || idx}-resp-${rIdx}`} style={styles.detailListItem}>
                                <ThemedText style={styles.detailBullet}>•</ThemedText>
                                <ThemedText style={styles.detailListText}>{resp}</ThemedText>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionTitle}>Education</ThemedText>
                  </View>
                  {loadingEdu ? <ActivityIndicator /> : null}
                  {!loadingEdu && errorEdu ? (
                    <ThemedText style={styles.mutedText}>{errorEdu}</ThemedText>
                  ) : null}
                  {!loadingEdu && !errorEdu && education.length === 0 ? (
                    <ThemedText style={styles.mutedText}>No education details added yet.</ThemedText>
                  ) : null}
                  {education.map((edu, idx) => {
                    const achievements = Array.isArray(edu.achievements) ? edu.achievements : [];
                    return (
                      <View key={`${edu.education_id || idx}`} style={styles.detailItem}>
                        <ThemedText style={styles.detailTitle}>
                          {edu.degree || 'Degree'} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}
                        </ThemedText>
                        {edu.institution ? (
                          <ThemedText style={styles.detailMeta}>{edu.institution}</ThemedText>
                        ) : null}
                        {edu.start_date ? (
                          <ThemedText style={styles.detailMeta}>
                            {edu.start_date} - {edu.end_date || 'Present'}
                          </ThemedText>
                        ) : null}
                        {edu.gpa ? <ThemedText style={styles.detailMeta}>GPA: {edu.gpa}</ThemedText> : null}
                        {edu.honors ? (
                          <ThemedText style={styles.detailMeta}>Honors: {edu.honors}</ThemedText>
                        ) : null}
                        {edu.activities_societies ? (
                          <ThemedText style={styles.detailMeta}>
                            Activities: {edu.activities_societies}
                          </ThemedText>
                        ) : null}
                        {achievements.length > 0 ? (
                          <View style={styles.detailList}>
                            {achievements.map((ach, aIdx) => (
                              <View key={`${edu.education_id || idx}-ach-${aIdx}`} style={styles.detailListItem}>
                                <ThemedText style={styles.detailBullet}>•</ThemedText>
                                <ThemedText style={styles.detailListText}>{ach}</ThemedText>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionTitle}>Skills</ThemedText>
                  </View>
                  {displaySkills ? (
                    <View style={styles.skillsRow}>
                      {displaySkills.split(',').map((skill, idx) => (
                        <View key={`${skill}-${idx}`} style={styles.skillChip}>
                          <ThemedText style={styles.skillText}>{skill.trim()}</ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <ThemedText style={styles.mutedText}>No skills listed yet.</ThemedText>
                  )}
                </View>

                <View style={styles.contactCard}>
                  <ThemedText style={styles.sectionTitle}>Contact Me</ThemedText>
                  {viewerCanSeeEmail ? (
                    canDisplayEmailValue ? (
                      <ThemedText style={styles.contactEmail}>{contactEmail}</ThemedText>
                    ) : isOwnProfile ? (
                      contactVisibility === 1 ? (
                        <ThemedText style={styles.mutedText}>
                          Only your connections can view this email. Change it in Account Settings to share more widely.
                        </ThemedText>
                      ) : (
                        <ThemedText style={styles.mutedText}>
                          Your email is hidden. Switch to &quot;Connections only&quot; or &quot;Everyone&quot; in Account
                          Settings to share it.
                        </ThemedText>
                      )
                    ) : (
                      <ThemedText style={styles.mutedText}>No email provided.</ThemedText>
                    )
                  ) : isOwnProfile ? (
                    <ThemedText style={styles.mutedText}>Update your email visibility in Account Settings.</ThemedText>
                  ) : contactVisibility === 1 ? (
                    <ThemedText style={styles.mutedText}>
                      Only this user&apos;s connections can view their email.
                    </ThemedText>
                  ) : (
                    <ThemedText style={styles.mutedText}>This user has chosen to hide their email.</ThemedText>
                  )}
                </View>
              </View>
            ) : null}

            {activeTab === 'reels' ? (
              <View style={styles.sectionCard}>
                <ReelGrid userId={userId} isOwnProfile={Boolean(isOwnProfile)} />
              </View>
            ) : null}

            {activeTab === 'posts' ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Posts</ThemedText>
                </View>
                {threadsLoading ? <ActivityIndicator /> : null}
                {!threadsLoading && threadsError ? (
                  <ThemedText style={styles.mutedText}>{threadsError}</ThemedText>
                ) : null}
                {!threadsLoading && !threadsError && userThreads.length === 0 ? (
                  <ThemedText style={styles.mutedText}>No posts yet.</ThemedText>
                ) : null}
                <View style={styles.threadList}>
                  {userThreads.map((thread) => (
                    <Pressable
                      key={thread.thread_id}
                      style={styles.threadCard}
                      onPress={() => router.push(`/thread/${thread.thread_id}`)}
                    >
                      <View style={styles.threadHeader}>
                        <ThemedText style={styles.threadTitle}>{thread.title || 'Untitled Thread'}</ThemedText>
                        <View style={styles.threadMetaRow}>
                          <ThemedText style={styles.metaText}>
                            {thread.forum_name || thread.community_name || 'Forum'}
                          </ThemedText>
                          <ThemedText style={styles.metaText}>•</ThemedText>
                          <ThemedText style={styles.metaText}>{timeAgo(thread.created_at)}</ThemedText>
                        </View>
                      </View>
                      {Array.isArray(thread.tags) && thread.tags.length > 0 ? (
                        <View style={styles.tagsRow}>
                          {thread.tags.map((tag) => {
                            const tagStyle = getTagStyle(tag);
                            return (
                              <View
                                key={`${thread.thread_id}-${tag}`}
                                style={[
                                  styles.tagChip,
                                  {
                                    borderColor: tagStyle.borderColor,
                                    backgroundColor: tagStyle.backgroundColor,
                                  },
                                ]}
                              >
                                <ThemedText style={[styles.tagText, { color: tagStyle.color }]}>
                                  {tag}
                                </ThemedText>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                      <View style={styles.threadStats}>
                        <MaterialCommunityIcons name="arrow-up-bold-outline" size={16} color={colors.subtext} />
                        <ThemedText style={styles.statText}>{Number(thread.upvotes) || 0}</ThemedText>
                        <MaterialCommunityIcons name="arrow-down-bold-outline" size={16} color={colors.subtext} />
                        <ThemedText style={styles.statText}>{Number(thread.downvotes) || 0}</ThemedText>
                        <MaterialCommunityIcons name="message-outline" size={16} color={colors.subtext} />
                        <ThemedText style={styles.statText}>{Number(thread.post_count) || 0}</ThemedText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
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
    borderColor: '#fff',
  },
  heroLogoDefault: {
    transform: [{ scale: 1.12 }],
  },
  heroContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    marginTop: 6,
    position: 'relative',
  },
  heroLeft: {
    flex: 1,
  },
  heroText: {
    gap: 6,
  },
  heroTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  heroSubtitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  heroSub: {
    fontSize: 12,
    color: colors.subtext,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroMeta: {
    fontSize: 12,
    color: colors.subtext,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.text, 0.08),
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.subtext,
  },
  ambassadorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  ambassadorLogo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5f5',
    backgroundColor: colors.card,
  },
  ambassadorInlineLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  actionButtonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionButtonTextSecondary: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  infoBanner: {
    marginTop: 6,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoBannerText: {
    fontSize: 11,
    color: colors.text,
  },
  kebabMenu: {
    position: 'absolute',
    right: 12,
    top: 10,
    zIndex: 10,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 24,
    right: 0,
    width: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 10,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownText: {
    fontSize: 12,
    color: colors.text,
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
  detailCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  detailSections: {
    position: 'relative',
    gap: 12,
  },
  detailSectionsRestricted: {
    maxHeight: 620,
    overflow: 'hidden',
  },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    zIndex: 2,
  },
  ctaCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  ctaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  ctaButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.primaryFrom,
  },
  ctaButtonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primaryFrom,
  },
  ctaButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  ctaButtonTextGhost: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryFrom,
  },
  aboutWrap: {
    gap: 12,
  },
  sectionCard: {
    gap: 8,
  },
  sectionHeader: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primaryFrom,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryFrom,
  },
  sectionBody: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  mutedText: {
    fontSize: 12,
    color: colors.subtext,
  },
  detailItem: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  detailMeta: {
    fontSize: 11,
    color: colors.subtext,
  },
  detailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailBody: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  detailList: {
    gap: 4,
    marginTop: 4,
  },
  detailListItem: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  detailBullet: {
    fontSize: 12,
    color: colors.text,
    marginTop: 1,
  },
  detailListText: {
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  contactCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: colors.card,
  },
  contactEmail: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryFrom,
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
  threadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  threadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11,
    color: colors.subtext,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  threadStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    minWidth: 16,
  },
});
