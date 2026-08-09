import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RenderHTML from 'react-native-render-html';

import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import AppShell from '@/components/navigation/AppShell';
import ReelGrid from '@/components/reels/ReelGrid';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { apiClient } from '@/lib/api/client';
import { buildAvatarSrc, buildUploadSrc, normalizeHtml } from '@/lib/uploads';
import { timeAgo } from '@/lib/utils/time';
import { getTagStyle } from '@/lib/utils/tags';

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
  primary_color?: string | null;
  secondary_color?: string | null;
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

type ReplyItem = {
  post_id: string;
  thread_id: string;
  thread_title?: string;
  forum_id?: string;
  content?: string;
  created_at?: string;
  community_name?: string;
  community_type?: string;
  community_id?: string;
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

export default function ProfileScreen() {
  const { user, isLoading: sessionLoading } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 640;
  const userId = user?.user_id;
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  useEffect(() => {
    if (sessionLoading) return;
    if (!userId) {
      openLockedFeature('Your profile');
    }
  }, [userId, sessionLoading, openLockedFeature]);

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [verified, setVerified] = useState(false);
  const [verifiedCommunityName, setVerifiedCommunityName] = useState('');
  const [ambassadorLogo, setAmbassadorLogo] = useState('');

  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingEdu, setLoadingEdu] = useState(true);
  const [errorExp, setErrorExp] = useState<string | null>(null);
  const [errorEdu, setErrorEdu] = useState<string | null>(null);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [activeTab, setActiveTab] = useState<'about' | 'reels' | 'posts' | 'replies'>('about');
  const [userThreads, setUserThreads] = useState<ThreadItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [hasLoadedThreads, setHasLoadedThreads] = useState(false);
  const [userReplies, setUserReplies] = useState<ReplyItem[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const [hasLoadedReplies, setHasLoadedReplies] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [skills, setSkills] = useState('');
  const [avatarPath, setAvatarPath] = useState('/uploads/avatars/DefaultAvatar.png');
  const [bannerPath, setBannerPath] = useState('/uploads/banners/DefaultBanner.jpeg');
  const [primaryColor, setPrimaryColor] = useState(colors.primaryFrom);
  const [secondaryColor, setSecondaryColor] = useState(colors.primaryTo);
  const [primaryColorInput, setPrimaryColorInput] = useState(colors.primaryFrom);
  const [secondaryColorInput, setSecondaryColorInput] = useState(colors.primaryTo);

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

  const accentColor = primaryColor || colors.primaryFrom;
  const accentSecondary = secondaryColor || colors.primaryTo;

  const fetchProfile = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const resp = await apiClient.get('/fetch_user.php', { params: { user_id: userId } });
      if ((resp.data as any)?.success) {
        const nextProfile = (resp.data as any)?.user as ProfileUser;
        setProfile(nextProfile);
        setVerified(Number(nextProfile?.verified) === 1);
        setAvatarPath(nextProfile?.avatar_path || '/uploads/avatars/DefaultAvatar.png');
        setBannerPath(nextProfile?.banner_path || '/uploads/banners/DefaultBanner.jpeg');
        setPrimaryColor(nextProfile?.primary_color || colors.primaryFrom);
        setSecondaryColor(nextProfile?.secondary_color || colors.primaryTo);
        setPrimaryColorInput(nextProfile?.primary_color || colors.primaryFrom);
        setSecondaryColorInput(nextProfile?.secondary_color || colors.primaryTo);
        setFirstName(nextProfile?.first_name || '');
        setLastName(nextProfile?.last_name || '');
        setHeadline(nextProfile?.headline || '');
        setAbout(nextProfile?.about || '');
        setSkills(nextProfile?.skills || '');

        const ambassadorIds = parseAmbassadorIds(nextProfile?.community_ambassador_of);
        if (ambassadorIds.length > 0) {
          const primaryAmbassadorId = ambassadorIds[0];
          try {
            const ambassadorResp = await apiClient.get('/fetch_community.php', {
              params: { community_id: primaryAmbassadorId },
            });
            if ((ambassadorResp.data as any)?.success) {
              const logoPath = (ambassadorResp.data as any)?.community?.logo_path;
              setAmbassadorLogo(logoPath ? buildUploadSrc(logoPath) : '');
            }
          } catch {
            setAmbassadorLogo('');
          }
        } else {
          setAmbassadorLogo('');
        }
      } else {
        setError((resp.data as any)?.error || 'Unable to load profile.');
      }
    } catch {
      setError('Unable to load profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !verified || !profile?.verified_community_id) {
      setVerifiedCommunityName('');
      return;
    }
    apiClient
      .get('/fetch_university.php', { params: { community_id: profile.verified_community_id } })
      .then((resp) => {
        if ((resp.data as any)?.success) {
          setVerifiedCommunityName((resp.data as any)?.university?.name || '');
        }
      })
      .catch(() => setVerifiedCommunityName(''));
  }, [profile?.verified_community_id, verified, userId]);

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
    if (!userId) {
      setExperience([]);
      setEducation([]);
      setLoadingExp(false);
      setLoadingEdu(false);
      return;
    }
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

  useEffect(() => {
    setActiveTab('about');
    setUserThreads([]);
    setHasLoadedThreads(false);
    setThreadsError(null);
    setUserReplies([]);
    setHasLoadedReplies(false);
    setRepliesError(null);
  }, [userId]);

  const fetchProfileThreads = async () => {
    if (!userId) return;
    setThreadsLoading(true);
    setThreadsError(null);
    try {
      const resp = await apiClient.get('/fetch_user_threads.php', {
        params: { user_id: userId, viewer_id: userId },
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

  const fetchProfileReplies = async () => {
    if (!userId) return;
    setRepliesLoading(true);
    setRepliesError(null);
    try {
      const resp = await apiClient.get('/fetch_user_replies.php', {
        params: { user_id: userId, viewer_id: userId },
      });
      if ((resp.data as any)?.success) {
        setUserReplies((resp.data as any)?.replies || []);
      } else {
        setRepliesError((resp.data as any)?.error || 'Unable to load replies.');
      }
    } catch {
      setRepliesError('Unable to load replies.');
    } finally {
      setRepliesLoading(false);
      setHasLoadedReplies(true);
    }
  };

  useEffect(() => {
    if (activeTab === 'posts' && !hasLoadedThreads) {
      fetchProfileThreads();
    }
    if (activeTab === 'replies' && !hasLoadedReplies) {
      fetchProfileReplies();
    }
  }, [activeTab, hasLoadedThreads, hasLoadedReplies, userId]);

  const handleToggleEdit = () => {
    if (isEditing && profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setHeadline(profile.headline || '');
      setAbout(profile.about || '');
      setSkills(profile.skills || '');
      setPrimaryColor(profile.primary_color || colors.primaryFrom);
      setSecondaryColor(profile.secondary_color || colors.primaryTo);
      setPrimaryColorInput(profile.primary_color || colors.primaryFrom);
      setSecondaryColorInput(profile.secondary_color || colors.primaryTo);
    }
    setIsEditing((prev) => !prev);
  };

  const handleHexInputChange = (
    value: string,
    setter: (val: string) => void,
    inputSetter: (val: string) => void
  ) => {
    const raw = value.trim();
    if (!/^#?[0-9a-fA-F]*$/.test(raw)) return;
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    if (normalized.length > 7) return;
    inputSetter(normalized);
    if (normalized.length === 7) {
      setter(normalized);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const skillList = skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const resp = await apiClient.post('/update_profile.php', {
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        headline,
        about,
        skills: skillList,
        avatar_path: avatarPath,
        banner_path: bannerPath,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });
      if ((resp.data as any)?.success) {
        await fetchProfile();
        setIsEditing(false);
      } else {
        Alert.alert('Update failed', (resp.data as any)?.error || 'Unable to update profile.');
      }
    } catch {
      Alert.alert('Update failed', 'Unable to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const isDefaultAvatar = avatarPath.includes('DefaultAvatar');
  const fullName =
    `${profile?.first_name || user?.first_name || ''} ${profile?.last_name || user?.last_name || ''}`.trim() ||
    'Your Profile';
  const displayHeadline = profile?.headline || headline || 'Student at Your University';
  const displayAbout = stripHtml(profile?.about || about) || 'No about information provided yet.';
  const displaySkills = profile?.skills || skills || '';
  const contactEmail = profile?.email || user?.email || '';

  if (!user) {
    return (
      <AppShell>
        <View style={styles.container}>
          <ThemedText type="title">Profile</ThemedText>
          <View style={styles.authPrompt}>
            <ThemedText style={styles.helper}>Sign in to view your profile.</ThemedText>
            <Pressable style={styles.action} onPress={() => router.push('/login')}>
              <ThemedText type="link">Go to sign in</ThemedText>
            </Pressable>
          </View>
        </View>
      </AppShell>
    );
  }

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

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.heroCard, isNarrow && styles.heroCardNarrow]}>
          <Image source={{ uri: buildUploadSrc(bannerPath) }} style={[styles.heroBanner, { height: bannerHeight }]} />
          <View style={[styles.heroLogoWrap, heroLogoWrapStyle]}>
            <Image
              source={{ uri: buildAvatarSrc(avatarPath) }}
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
                {isEditing ? (
                  <>
                    <View style={styles.nameRow}>
                      <TextInput
                        style={styles.nameInput}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="First Name"
                      />
                      <TextInput
                        style={styles.nameInput}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Last Name"
                      />
                    </View>
                    <TextInput
                      style={styles.headlineInput}
                      value={headline}
                      onChangeText={setHeadline}
                      placeholder="Headline"
                    />
                  </>
                ) : (
                  <>
                    <View style={styles.heroTitleRow}>
                      <ThemedText style={styles.heroTitle}>{fullName}</ThemedText>
                      {verified ? (
                        <MaterialCommunityIcons
                          name="check-decagram"
                          size={18}
                          color={accentColor}
                          accessibilityLabel={
                            verifiedCommunityName ? `Verified from ${verifiedCommunityName}` : 'Verified'
                          }
                        />
                      ) : null}
                      {ambassadorLogo ? (
                        <Image source={{ uri: ambassadorLogo }} style={styles.ambassadorInlineLogo} />
                      ) : null}
                    </View>
                    <View style={styles.heroSubtitleRow}>
                      <ThemedText style={styles.heroSub}>{displayHeadline}</ThemedText>
                      {!verified ? (
                        <View style={[styles.statusPill, { backgroundColor: hexToRgba(accentColor, 0.08) }]}>
                          <ThemedText style={styles.statusPillText}>Unverified</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.heroRow}>
                      <ThemedText style={styles.heroMeta}>{followerCount} Followers</ThemedText>
                      <ThemedText style={styles.heroMeta}>{followingCount} Following</ThemedText>
                    </View>
                  </>
                )}
              </View>
            </View>
            <View style={styles.heroActions}>
              {isEditing ? (
                <Pressable onPress={handleSave} disabled={isSaving} style={styles.actionButton}>
                  <LinearGradient colors={[accentColor, accentSecondary]} style={styles.actionButtonGradient}>
                    <ThemedText style={styles.actionButtonText}>
                      {isSaving ? 'Saving...' : 'Save Profile'}
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable onPress={handleToggleEdit} style={[styles.actionButton, styles.actionButtonSecondary]}>
                  <ThemedText style={styles.actionButtonTextSecondary}>Edit Profile</ThemedText>
                </Pressable>
              )}
              {isEditing ? (
                <View style={styles.heroEditControls}>
                  <Pressable
                    style={[styles.uploadButton, { backgroundColor: hexToRgba(accentColor, 0.1) }]}
                    onPress={() =>
                      Alert.alert('Upload coming soon', 'Avatar uploads are not yet available on mobile.')
                    }
                  >
                    <ThemedText style={[styles.uploadButtonText, { color: accentColor }]}>
                      Choose Avatar
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.uploadButton, { backgroundColor: hexToRgba(accentColor, 0.1) }]}
                    onPress={() =>
                      Alert.alert('Upload coming soon', 'Banner uploads are not yet available on mobile.')
                    }
                  >
                    <ThemedText style={[styles.uploadButtonText, { color: accentColor }]}>
                      Choose Banner
                    </ThemedText>
                  </Pressable>
                  <View style={styles.colorPickerRow}>
                    <View style={styles.colorPicker}>
                      <ThemedText style={styles.colorLabel}>Primary</ThemedText>
                      <View style={styles.colorInputRow}>
                        <TextInput
                          style={styles.colorInput}
                          value={primaryColorInput}
                          onChangeText={(value) =>
                            handleHexInputChange(value, setPrimaryColor, setPrimaryColorInput)
                          }
                          onBlur={() => setPrimaryColorInput(primaryColor)}
                          autoCapitalize="none"
                        />
                        <View style={[styles.colorSwatch, { backgroundColor: primaryColor }]} />
                      </View>
                    </View>
                    <View style={styles.colorPicker}>
                      <ThemedText style={styles.colorLabel}>Secondary</ThemedText>
                      <View style={styles.colorInputRow}>
                        <TextInput
                          style={styles.colorInput}
                          value={secondaryColorInput}
                          onChangeText={(value) =>
                            handleHexInputChange(value, setSecondaryColor, setSecondaryColorInput)
                          }
                          onBlur={() => setSecondaryColorInput(secondaryColor)}
                          autoCapitalize="none"
                        />
                        <View style={[styles.colorSwatch, { backgroundColor: secondaryColor }]} />
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.tabsRow}>
            {[
              { id: 'about', label: 'About' },
              { id: 'reels', label: 'Reels' },
              { id: 'posts', label: 'Posts' },
              { id: 'replies', label: 'Replies' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable key={tab.id} onPress={() => setActiveTab(tab.id as typeof activeTab)}>
                  <View style={styles.tabButton}>
                    <ThemedText style={[styles.tabText, active && { color: accentColor, fontWeight: '600' }]}>
                      {tab.label}
                    </ThemedText>
                    {active ? <View style={[styles.tabUnderline, { backgroundColor: accentColor }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.detailCard}>
          {activeTab === 'about' ? (
            <View style={styles.aboutWrap}>
              <View style={styles.sectionCard}>
                <View style={[styles.sectionHeader, { borderBottomColor: accentColor }]}>
                  <ThemedText style={[styles.sectionTitle, { color: accentColor }]}>About</ThemedText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={styles.aboutInput}
                    value={about}
                    onChangeText={setAbout}
                    placeholder="Tell us about yourself..."
                    multiline
                    textAlignVertical="top"
                  />
                ) : (
                  <ThemedText style={styles.sectionBody}>{displayAbout}</ThemedText>
                )}
              </View>

              <View style={styles.sectionCard}>
                <View style={[styles.sectionHeader, { borderBottomColor: accentColor }]}>
                  <ThemedText style={[styles.sectionTitle, { color: accentColor }]}>Experience</ThemedText>
                </View>
                {loadingExp ? <ActivityIndicator /> : null}
                {!loadingExp && errorExp ? <ThemedText style={styles.mutedText}>{errorExp}</ThemedText> : null}
                {!loadingExp && !errorExp && experience.length === 0 ? (
                  <ThemedText style={styles.mutedText}>No experience added yet.</ThemedText>
                ) : null}
                {experience.map((exp, idx) => {
                  const responsibilities = Array.isArray(exp.responsibilities) ? exp.responsibilities : [];
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
                <View style={[styles.sectionHeader, { borderBottomColor: accentColor }]}>
                  <ThemedText style={[styles.sectionTitle, { color: accentColor }]}>Education</ThemedText>
                </View>
                {loadingEdu ? <ActivityIndicator /> : null}
                {!loadingEdu && errorEdu ? <ThemedText style={styles.mutedText}>{errorEdu}</ThemedText> : null}
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
                      {edu.institution ? <ThemedText style={styles.detailMeta}>{edu.institution}</ThemedText> : null}
                      {edu.start_date ? (
                        <ThemedText style={styles.detailMeta}>
                          {edu.start_date} - {edu.end_date || 'Present'}
                        </ThemedText>
                      ) : null}
                      {edu.gpa ? <ThemedText style={styles.detailMeta}>GPA: {edu.gpa}</ThemedText> : null}
                      {edu.honors ? <ThemedText style={styles.detailMeta}>Honors: {edu.honors}</ThemedText> : null}
                      {edu.activities_societies ? (
                        <ThemedText style={styles.detailMeta}>Activities: {edu.activities_societies}</ThemedText>
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
                <View style={[styles.sectionHeader, { borderBottomColor: accentColor }]}>
                  <ThemedText style={[styles.sectionTitle, { color: accentColor }]}>Skills</ThemedText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={styles.skillsInput}
                    value={skills}
                    onChangeText={setSkills}
                    placeholder="Enter skills, separated by commas"
                  />
                ) : displaySkills ? (
                  <View style={styles.skillsRow}>
                  {displaySkills.split(',').map((skill, idx) => (
                    <View key={`${skill}-${idx}`} style={styles.skillChip}>
                        <ThemedText style={[styles.skillText, { color: accentColor }]}>
                          {skill.trim()}
                        </ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                  <ThemedText style={styles.mutedText}>No skills listed yet.</ThemedText>
                )}
              </View>

              <View style={styles.contactCard}>
                <ThemedText style={[styles.sectionTitle, { color: accentColor }]}>Contact Me</ThemedText>
                {contactEmail ? (
                  <ThemedText style={[styles.contactEmail, { color: accentColor }]}>
                    {contactEmail}
                  </ThemedText>
                ) : (
                  <ThemedText style={styles.mutedText}>No email provided.</ThemedText>
                )}
              </View>
            </View>
          ) : null}

          {activeTab === 'reels' ? (
            <View style={styles.sectionCard}>
              <ReelGrid userId={userId} isOwnProfile />
            </View>
          ) : null}

          {activeTab === 'posts' ? (
            <View style={styles.sectionCard}>
              <View style={[styles.sectionHeader, { borderBottomColor: accentColor }]}>
                <ThemedText style={[styles.sectionTitle, { color: accentColor }]}>Posts</ThemedText>
              </View>
              {threadsLoading ? <ActivityIndicator /> : null}
              {!threadsLoading && threadsError ? <ThemedText style={styles.mutedText}>{threadsError}</ThemedText> : null}
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
                                { borderColor: tagStyle.borderColor, backgroundColor: tagStyle.backgroundColor },
                              ]}
                            >
                              <ThemedText style={[styles.tagText, { color: tagStyle.color }]}>{tag}</ThemedText>
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

          {activeTab === 'replies' ? (
            <View style={styles.sectionCard}>
              <View style={[styles.sectionHeader, { borderBottomColor: accentColor }]}>
                <ThemedText style={[styles.sectionTitle, { color: accentColor }]}>Replies</ThemedText>
              </View>
              {repliesLoading ? <ActivityIndicator /> : null}
              {!repliesLoading && repliesError ? <ThemedText style={styles.mutedText}>{repliesError}</ThemedText> : null}
              {!repliesLoading && !repliesError && userReplies.length === 0 ? (
                <ThemedText style={styles.mutedText}>No replies yet.</ThemedText>
              ) : null}
              <View style={styles.replyList}>
                {userReplies.map((reply) => (
                  <View key={reply.post_id} style={styles.replyCard}>
                    <View style={styles.replyMetaRow}>
                      <Pressable onPress={() => router.push(`/thread/${reply.thread_id}`)}>
                        <ThemedText style={[styles.replyLink, { color: accentColor }]}>
                          {reply.thread_title || 'View Thread'}
                        </ThemedText>
                      </Pressable>
                      <ThemedText style={styles.metaText}>•</ThemedText>
                      <ThemedText style={styles.metaText}>{timeAgo(reply.created_at)}</ThemedText>
                      {reply.community_name && reply.community_id && reply.community_type ? (
                        <>
                          <ThemedText style={styles.metaText}>•</ThemedText>
                          <Pressable
                            onPress={() =>
                              router.push(
                                reply.community_type === 'group'
                                  ? {
                                      pathname: '/group/[communityId]',
                                      params: { communityId: reply.community_id! },
                                    }
                                  : {
                                      pathname: '/university/[communityId]',
                                      params: { communityId: reply.community_id! },
                                    }
                              )
                            }
                          >
                            <ThemedText style={[styles.replyLink, { color: accentColor }]}>
                              {reply.community_name}
                            </ThemedText>
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                    <RenderHTML
                      contentWidth={screenWidth - 64}
                      source={{ html: normalizeHtml(reply.content || '') }}
                      baseStyle={styles.replyContent}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
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
  helper: {
    opacity: 0.7,
  },
  authPrompt: {
    gap: 8,
  },
  action: {
    marginTop: 6,
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
  heroLogoDefault: {
    transform: [{ scale: 1.12 }],
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
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.subtext,
  },
  ambassadorInlineLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroActions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    borderRadius: 999,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  actionButtonGradient: {
    paddingHorizontal: 14,
    paddingVertical: 7,
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
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  actionButtonTextSecondary: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  heroEditControls: {
    gap: 8,
  },
  uploadButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.1),
    alignSelf: 'flex-start',
  },
  uploadButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  colorPicker: {
    gap: 4,
  },
  colorLabel: {
    fontSize: 11,
    color: colors.subtext,
  },
  colorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 110,
    backgroundColor: colors.card,
    fontSize: 12,
    color: colors.text,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.card,
    fontSize: 12,
  },
  headlineInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.card,
    fontSize: 12,
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
  tabUnderline: {
    height: 3,
    borderRadius: 2,
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
  aboutWrap: {
    gap: 12,
  },
  sectionCard: {
    gap: 8,
  },
  sectionHeader: {
    borderBottomWidth: 3,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  aboutInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.card,
    minHeight: 90,
    fontSize: 12,
    color: colors.text,
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
  skillsInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.card,
    fontSize: 12,
    color: colors.text,
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
  replyList: {
    gap: 12,
  },
  replyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
    gap: 8,
  },
  replyMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  replyLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  replyContent: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
});
