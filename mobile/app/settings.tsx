import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { isAdmin, isModerator, isSuperAdmin } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import useTagOptions from '@/hooks/use-tag-options';
import { apiClient } from '@/lib/api/client';
import { API_BASE_URL } from '@/lib/config';
import { loadStoredAccountSettings, loadStoredDefaultFeed, saveStoredAccountSettings, saveStoredDefaultFeed } from '@/lib/storage';
import { useBrandStyles } from '@/hooks/use-brand-styles';

const createDefaultSettings = () => ({
  profile: {
    profileVisibility: 'network',
    showOnline: true,
    allowMessagesFrom: 'connections',
    showEmail: 'hidden',
    discoverable: 'everyone',
  },
  notifications: {
    inApp: true,
    email: true,
    mentions: true,
    replies: true,
    votes: true,
    messages: true,
    communityAnnouncements: true,
    weeklyDigest: true,
  },
  security: {
    twoFactor: false,
    loginAlerts: true,
    sessionTimeout: '30',
    trustedDevicesOnly: false,
  },
  feed: {
    defaultFeed: 'yourFeed',
    autoplayMedia: false,
    openLinksInNewTab: true,
    filterFollowedCommunities: true,
    includeEvents: true,
  },
  community: {
    autoJoinCampus: true,
    allowInvites: true,
    showAchievements: true,
    hideNSFW: true,
  },
  moderation: {
    escalateReports: true,
    lockThreads: false,
    approveNewMembers: true,
  },
  admin: {
    maintenanceMode: false,
    requireSSO: false,
    enableAnalytics: true,
  },
  ambassador: {
    spotlightInFeed: true,
    dmOfficeHours: true,
    autoReplyTemplates: false,
  },
});

type SettingsState = ReturnType<typeof createDefaultSettings>;

const profileVisibilityOptions = [
  { value: 'network', label: 'Group Members Only' },
  { value: 'followers', label: 'Followers only' },
  { value: 'private', label: 'Private' },
] as const;

const dmOptions = [
  { value: 'connections', label: 'Connections only' },
  { value: 'community', label: 'Community only' },
  { value: 'everyone', label: 'Everyone' },
] as const;

const emailOptions = [
  { value: 'hidden', label: 'Hidden' },
  { value: 'connections', label: 'Connections only' },
  { value: 'everyone', label: 'Everyone' },
] as const;

const discoverOptions = [
  { value: 'no_one', label: 'No one' },
  { value: 'connections', label: 'Connections only' },
  { value: 'everyone', label: 'Everyone' },
] as const;

const sessionTimeoutOptions = [
  { value: '10', label: '10 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '240', label: '4 hours' },
  { value: '1440', label: '24 hours' },
] as const;

const defaultFeedOptions = [
  { value: 'yourFeed', label: 'Your Feed' },
  { value: 'explore', label: 'Explore' },
  { value: 'info', label: 'Info Board' },
] as const;

const roleLabel = (roleId?: number | string) => {
  const value = Number(roleId || 0);
  if (value >= 5) return 'Super Admin';
  if (value >= 4) return 'Admin';
  if (value >= 3) return 'Moderator';
  return 'Member';
};

const parseUserAgent = (ua?: string) => {
  if (!ua) return { os: 'Unknown OS', browser: 'Unknown browser' };
  let os = 'Unknown OS';
  if (/Mac OS X ([0-9_\.]+)/i.test(ua)) {
    os = `Mac OS X ${RegExp.$1.replace(/_/g, '.')}`;
  } else if (/Windows NT ([0-9\.]+)/i.test(ua)) {
    os = `Windows ${RegExp.$1}`;
  } else if (/Android ([0-9\.]+)/i.test(ua)) {
    os = `Android ${RegExp.$1}`;
  } else if (/iPhone OS ([0-9_]+)/i.test(ua)) {
    os = `iOS ${RegExp.$1.replace(/_/g, '.')}`;
  }

  let browser = 'Browser';
  if (/Firefox\/([\d\.]+)/i.test(ua)) {
    browser = `Firefox/${RegExp.$1}`;
  } else if (/Edg\/([\d\.]+)/i.test(ua)) {
    browser = `Edge/${RegExp.$1}`;
  } else if (/Chrome\/([\d\.]+)/i.test(ua) && !/Edg\//i.test(ua)) {
    browser = `Chrome/${RegExp.$1}`;
  } else if (/Version\/([\d\.]+).*Safari/i.test(ua)) {
    browser = `Safari/${RegExp.$1}`;
  }

  return { os, browser };
};

export default function AccountSettingsScreen() {
  const { user, isLoading: sessionLoading, signOut } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; zoom?: string; reason?: string }>();
  const { tags: tagOptions, loading: tagsLoading } = useTagOptions();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [settings, setSettings] = useState<SettingsState>(() => createDefaultSettings());
  const [status, setStatus] = useState('');
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [tagInterests, setTagInterests] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [zoomStatus, setZoomStatus] = useState({
    loading: false,
    connected: false,
    email: '',
    error: '',
  });
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState('');

  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAmbassador = Number(user?.is_ambassador) === 1;
  const isModeratorUser = isModerator(user?.role_id);
  const isAdminUser = isAdmin(user?.role_id);
  const isSuperAdminUser = isSuperAdmin(user?.role_id);
  const canConnectZoom = isAmbassador || isAdminUser || isSuperAdminUser;

  const tabs = useMemo(() => {
    const list = [
      { id: 'profile', label: 'Profile', icon: 'account-cog' },
      { id: 'notifications', label: 'Notifications', icon: 'bell' },
      { id: 'security', label: 'Security', icon: 'shield-check' },
      { id: 'feed', label: 'Feed', icon: 'rss' },
      { id: 'community', label: 'Community', icon: 'school' },
      canConnectZoom ? { id: 'integrations', label: 'Integrations', icon: 'plug' } : null,
      isModeratorUser ? { id: 'moderation', label: 'Moderation', icon: 'bullhorn' } : null,
      isAmbassador ? { id: 'ambassador', label: 'Ambassador', icon: 'account-star' } : null,
      isAdminUser ? { id: 'admin', label: 'Admin', icon: 'shield-lock' } : null,
      { id: 'sessions', label: 'Sessions', icon: 'devices' },
      { id: 'data', label: 'Data', icon: 'database' },
    ];
    return list.filter(Boolean) as Array<{ id: string; label: string; icon: string }>;
  }, [isAmbassador, isAdminUser, isModeratorUser, canConnectZoom]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'profile');

  const flashStatus = (message: string) => {
    setStatus(message);
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = setTimeout(() => setStatus(''), 1800);
  };

  useEffect(() => {
    if (!sessionLoading && !user?.user_id) {
      openLockedFeature('Account Settings');
    }
  }, [sessionLoading, user?.user_id, openLockedFeature]);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (!params?.tab) return;
    if (tabs.some((tab) => tab.id === params.tab)) {
      setActiveTab(params.tab);
    }
  }, [params?.tab, tabs]);

  useEffect(() => {
    if (!params?.zoom) return;
    if (params.zoom === 'connected') {
      flashStatus('Zoom connected.');
    }
    if (params.zoom === 'error') {
      const reasonMap: Record<string, string> = {
        missing_config: 'Zoom OAuth is not configured.',
        access_denied: 'Only ambassadors and admins can connect Zoom.',
        user_not_found: 'Unable to confirm your account.',
        db_error: 'Unable to start Zoom connection.',
      };
      flashStatus(reasonMap[String(params.reason)] || 'Zoom connection failed.');
    }
  }, [params?.zoom, params?.reason]);

  useEffect(() => {
    loadStoredAccountSettings().then((stored) => {
      if (!stored) return;
      const next = {
        ...createDefaultSettings(),
        ...(stored as SettingsState),
      };
      setSettings(next);
    });
    loadStoredDefaultFeed().then((value) => {
      if (!value) return;
      setSettings((prev) => ({
        ...prev,
        feed: {
          ...prev.feed,
          defaultFeed: value,
        },
      }));
    });
  }, []);

  useEffect(() => {
    if (!user?.user_id) return;
    let mounted = true;
    setIsLoadingSettings(true);
    apiClient
      .get('/fetch_user.php', { params: { user_id: user.user_id } })
      .then((res) => {
        if (!mounted) return;
        if ((res.data as any)?.success && (res.data as any)?.user) {
          const data = (res.data as any).user;
          setSettings((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              profileVisibility: data.profile_visibility || prev.profile.profileVisibility,
              allowMessagesFrom: data.allow_messages_from || prev.profile.allowMessagesFrom,
              showOnline: typeof data.show_online !== 'undefined' ? Boolean(Number(data.show_online)) : prev.profile.showOnline,
              showEmail:
                typeof data.show_email !== 'undefined'
                  ? Number(data.show_email) === 2
                    ? 'everyone'
                    : Number(data.show_email) === 1
                    ? 'connections'
                    : 'hidden'
                  : prev.profile.showEmail,
              discoverable:
                typeof data.discoverable !== 'undefined'
                  ? Number(data.discoverable) === 2
                    ? 'everyone'
                    : Number(data.discoverable) === 1
                    ? 'connections'
                    : 'no_one'
                  : prev.profile.discoverable,
            },
            notifications: {
              ...prev.notifications,
              votes:
                typeof data.notify_votes !== 'undefined'
                  ? Boolean(Number(data.notify_votes))
                  : prev.notifications.votes,
              replies:
                typeof data.notify_replies !== 'undefined'
                  ? Boolean(Number(data.notify_replies))
                  : prev.notifications.replies,
            },
            security: {
              ...prev.security,
              twoFactor:
                typeof data.two_factor_enabled !== 'undefined'
                  ? Boolean(Number(data.two_factor_enabled))
                  : prev.security.twoFactor,
              sessionTimeout:
                typeof data.session_timeout_minutes !== 'undefined'
                  ? String(data.session_timeout_minutes)
                  : prev.security.sessionTimeout,
            },
            feed: {
              ...prev.feed,
              defaultFeed: data.default_feed || prev.feed.defaultFeed,
            },
            community: {
              ...prev.community,
              autoJoinCampus:
                typeof data.auto_join_campus !== 'undefined'
                  ? Boolean(Number(data.auto_join_campus))
                  : prev.community.autoJoinCampus,
            },
          }));
          if (data.default_feed) {
            saveStoredDefaultFeed(String(data.default_feed));
          }
        }
      })
      .catch(() => {
        // ignore load errors
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoadingSettings(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.user_id]);

  useEffect(() => {
    if (!user?.user_id) return;
    setIsLoadingTags(true);
    apiClient
      .get('/fetch_tag_interests.php', { params: { user_id: user.user_id } })
      .then((res) => {
        if ((res.data as any)?.success) {
          const tags = Array.isArray((res.data as any)?.tags) ? (res.data as any).tags : [];
          setTagInterests(tags);
        }
      })
      .catch(() => {
        setTagInterests([]);
      })
      .finally(() => setIsLoadingTags(false));
  }, [user?.user_id]);

  useEffect(() => {
    if (activeTab !== 'sessions' || !user?.user_id) return;
    setLoadingSessions(true);
    setSessionsError('');
    apiClient
      .get('/fetch_sessions.php')
      .then((res) => {
        if ((res.data as any)?.success) {
          setSessions((res.data as any).sessions || []);
        } else {
          setSessionsError((res.data as any)?.error || 'Unable to load sessions.');
        }
      })
      .catch(() => setSessionsError('Unable to load sessions.'))
      .finally(() => setLoadingSessions(false));
  }, [activeTab, user?.user_id]);

  useEffect(() => {
    if (!canConnectZoom || !user?.user_id) return;
    setZoomStatus((prev) => ({ ...prev, loading: true, error: '' }));
    apiClient
      .get('/zoom_status.php')
      .then((res) => {
        if ((res.data as any)?.success) {
          setZoomStatus({
            loading: false,
            connected: Boolean((res.data as any)?.connected),
            email: (res.data as any)?.zoom_email || '',
            error: '',
          });
        } else {
          setZoomStatus((prev) => ({
            ...prev,
            loading: false,
            error: (res.data as any)?.error || 'Unable to load Zoom status.',
          }));
        }
      })
      .catch(() =>
        setZoomStatus((prev) => ({ ...prev, loading: false, error: 'Unable to load Zoom status.' }))
      );
  }, [canConnectZoom, user?.user_id]);

  const persistSetting = async (payload: Record<string, any>) => {
    if (!user?.user_id) return;
    try {
      await apiClient.post('/update_account_settings.php', {
        user_id: user.user_id,
        ...payload,
      });
    } catch {
      // non-blocking
    }
  };

  const updateSetting = (section: keyof SettingsState, key: string, value: any) => {
    if (section === 'profile' && key === 'profileVisibility' && value === 'network' && !isAmbassador) {
      flashStatus('This option is only available for group ambassadors');
      return;
    }
    setSettings((prev) => {
      const next = {
        ...prev,
        [section]: {
          ...(prev[section] as Record<string, unknown>),
          [key]: value,
        },
      } as SettingsState;
      saveStoredAccountSettings(next as unknown as Record<string, unknown>);
      return next;
    });

    if (section === 'profile' && key === 'profileVisibility') {
      persistSetting({ profile_visibility: value });
    }
    if (section === 'profile' && key === 'showOnline') {
      persistSetting({ show_online: value });
    }
    if (section === 'profile' && key === 'allowMessagesFrom') {
      persistSetting({ allow_messages_from: value });
    }
    if (section === 'profile' && key === 'showEmail') {
      persistSetting({ show_email: value });
    }
    if (section === 'profile' && key === 'discoverable') {
      const map = { no_one: 0, connections: 1, everyone: 2 };
      persistSetting({ discoverable: map[value as keyof typeof map] ?? 0 });
    }
    if (section === 'notifications' && key === 'votes') {
      persistSetting({ notify_votes: value });
    }
    if (section === 'notifications' && key === 'replies') {
      persistSetting({ notify_replies: value });
    }
    if (section === 'security' && key === 'sessionTimeout') {
      persistSetting({ session_timeout_minutes: Number(value) });
    }
    if (section === 'security' && key === 'twoFactor') {
      persistSetting({ two_factor_enabled: value });
    }
    if (section === 'community' && key === 'autoJoinCampus') {
      persistSetting({ auto_join_campus: value });
    }
    if (section === 'feed' && key === 'defaultFeed') {
      saveStoredDefaultFeed(String(value));
      persistSetting({ default_feed: value });
    }
    flashStatus('Saved');
  };

  const toggleTag = (slug: string) => {
    setTagInterests((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((t) => t !== slug);
      }
      if (prev.length >= 8) {
        flashStatus('Select up to 8 tags');
        return prev;
      }
      return [...prev, slug];
    });
  };

  const saveInterests = async () => {
    if (!user?.user_id || isSavingTags) return;
    setIsSavingTags(true);
    try {
      const res = await apiClient.post('/update_tag_interests.php', {
        user_id: user.user_id,
        tags: tagInterests,
      });
      if ((res.data as any)?.success) {
        flashStatus('Interests updated');
      } else {
        flashStatus((res.data as any)?.error || 'Unable to update interests.');
      }
    } catch {
      flashStatus('Unable to update interests.');
    } finally {
      setIsSavingTags(false);
    }
  };

  const sendTestEmail = async () => {
    if (isSendingTestEmail) return;
    setIsSendingTestEmail(true);
    try {
      const res = await apiClient.post('/send_test_email.php', {});
      if ((res.data as any)?.success) {
        flashStatus((res.data as any)?.message || 'Test email sent.');
      } else {
        flashStatus((res.data as any)?.error || 'Unable to send test email.');
      }
    } catch {
      flashStatus('Unable to send test email.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleExportData = () => {
    flashStatus('Data exports are currently on-hold.');
  };

  const handleDeactivateAccount = () => {
    Alert.alert(
      'Deactivate account?',
      'This will temporarily hide your profile and content.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () => flashStatus('Deactivation is currently on-hold.'),
        },
      ]
    );
  };

  const handleResetDefaults = async () => {
    const defaults = createDefaultSettings();
    setSettings(defaults);
    saveStoredAccountSettings(defaults);
    saveStoredDefaultFeed(defaults.feed.defaultFeed);
    setShowResetModal(false);

    if (user?.user_id) {
      const showEmailMap: Record<string, number> = {
        hidden: 0,
        connections: 1,
        everyone: 2,
      };
      const discoverMap: Record<string, number> = {
        no_one: 0,
        connections: 1,
        everyone: 2,
      };
      try {
        await apiClient.post('/update_account_settings.php', {
          user_id: user.user_id,
          profile_visibility: defaults.profile.profileVisibility,
          show_online: defaults.profile.showOnline,
          allow_messages_from: defaults.profile.allowMessagesFrom,
          show_email: showEmailMap[defaults.profile.showEmail],
          discoverable: discoverMap[defaults.profile.discoverable],
          session_timeout_minutes: Number(defaults.security.sessionTimeout),
          notify_votes: defaults.notifications.votes,
          notify_replies: defaults.notifications.replies,
          two_factor_enabled: defaults.security.twoFactor,
          auto_join_campus: defaults.community.autoJoinCampus,
          default_feed: defaults.feed.defaultFeed,
        });
      } catch {
        // non-blocking
      }
    }

    flashStatus('Reset to defaults');
  };

  const handleZoomConnect = () => {
    const returnTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/settings`
        : '';
    const baseUrl = `${API_BASE_URL}/api/zoom_oauth_start.php`;
    const url = returnTo ? `${baseUrl}?return_to=${encodeURIComponent(returnTo)}` : baseUrl;
    Linking.openURL(url).catch(() => {});
  };

  const handleZoomDisconnect = async () => {
    if (zoomStatus.loading) return;
    setZoomStatus((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await apiClient.post('/zoom_disconnect.php');
      if ((res.data as any)?.success) {
        setZoomStatus({ loading: false, connected: false, email: '', error: '' });
      } else {
        setZoomStatus((prev) => ({
          ...prev,
          loading: false,
          error: (res.data as any)?.error || 'Unable to disconnect Zoom.',
        }));
      }
    } catch {
      setZoomStatus((prev) => ({ ...prev, loading: false, error: 'Unable to disconnect Zoom.' }));
    }
  };

  const revokeSession = async (sessionId: string, isCurrent: boolean) => {
    try {
      const res = await apiClient.post('/revoke_session.php', { session_id: sessionId });
      if ((res.data as any)?.success) {
        if (isCurrent) {
          await signOut();
          router.replace('/login');
        } else {
          setSessions((prev) =>
            prev.map((session) =>
              session.session_id === sessionId ? { ...session, revoked_at: new Date().toISOString() } : session
            )
          );
        }
      } else {
        flashStatus((res.data as any)?.error || 'Unable to sign out that session.');
      }
    } catch {
      flashStatus('Unable to sign out that session.');
    }
  };

  const filteredSessions = useMemo(() => {
    const deduped: any[] = [];
    const seen = new Map<string, number>();
    sessions.forEach((session) => {
      const { browser } = parseUserAgent(session.user_agent || '');
      const base = browser.split('/')[0] || browser;
      const browserKey = (base || 'unknown').toLowerCase();
      const ipKey = (session.ip_address || '').trim().toLowerCase() || 'unknown';
      const key = `${browserKey}::${ipKey}`;
      if (!seen.has(key)) {
        seen.set(key, deduped.length);
        deduped.push(session);
        return;
      }
      if (session.current) {
        const index = seen.get(key);
        if (index !== undefined && !deduped[index]?.current) {
          deduped[index] = session;
        }
      }
    });
    return deduped;
  }, [sessions]);

  if (!user?.user_id) {
    return (
      <AppShell>
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyTitle}>Sign in to manage your settings</ThemedText>
          <ThemedText style={styles.emptyText}>
            Your account preferences are saved when you are logged in.
          </ThemedText>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
            <ThemedText style={styles.primaryButtonText}>Sign in</ThemedText>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText style={styles.kicker}>Account</ThemedText>
            <ThemedText style={styles.title}>Account settings</ThemedText>
            <View style={styles.badgeRow}>
              {user.email ? (
                <View style={styles.badge}>
                  <ThemedText style={styles.badgeText}>{user.email}</ThemedText>
                </View>
              ) : null}
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>Access: {roleLabel(user.role_id)}</ThemedText>
              </View>
              {isAmbassador ? (
                <View style={[styles.badge, styles.badgePositive]}>
                  <ThemedText style={[styles.badgeText, styles.badgePositiveText]}>Ambassador</ThemedText>
                </View>
              ) : null}
            </View>
            <Pressable style={[styles.pillButton, styles.pillSecondary]} onPress={() => router.push('/feed')}>
              <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>← Back to home</ThemedText>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.pillButton} onPress={() => flashStatus('Saved')}>
              <ThemedText style={styles.pillText}>Save changes</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.pillButton, styles.pillSecondary]}
              onPress={() => setShowResetModal(true)}
            >
              <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>Reset defaults</ThemedText>
            </Pressable>
          </View>
        </View>

        {status ? (
          <View style={styles.status}>
            <ThemedText style={styles.statusText}>{status}</ThemedText>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Pressable
                key={tab.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <MaterialCommunityIcons name={tab.icon as any} size={16} color={active ? colors.primaryFrom : colors.text} />
                <ThemedText style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoadingSettings ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primaryFrom} />
            <ThemedText style={styles.loadingText}>Loading settings…</ThemedText>
          </View>
        ) : null}

        <View style={styles.grid}>
          {activeTab === 'profile' ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeading}>
                  <View style={styles.cardEyebrow}>
                    <MaterialCommunityIcons name="account-cog" size={16} color={colors.text} />
                    <ThemedText style={styles.cardEyebrowText}>Profile & identity</ThemedText>
                  </View>
                  <ThemedText style={styles.cardHelp}>
                    How you appear across forums and threads.
                  </ThemedText>
                </View>
                <View style={styles.settingRow}>
                  <View style={styles.settingText}>
                    <ThemedText style={styles.settingLabel}>
                      Profile visibility <ThemedText style={styles.liveBadge}>Live</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.settingHelp}>
                      Limit profile details to your campus network or followers.
                    </ThemedText>
                  </View>
                  <View style={styles.selectWrap}>
                    <Pressable
                      style={styles.selectButton}
                      onPress={() =>
                        setOpenSelect(openSelect === 'profileVisibility' ? null : 'profileVisibility')
                      }
                    >
                      <ThemedText style={styles.selectButtonText}>
                        {profileVisibilityOptions.find((opt) => opt.value === settings.profile.profileVisibility)?.label ||
                          'Select'}
                      </ThemedText>
                      <MaterialCommunityIcons name="chevron-down" size={16} color={colors.subtext} />
                    </Pressable>
                    {openSelect === 'profileVisibility' ? (
                      <View style={styles.selectMenu}>
                        {profileVisibilityOptions.map((opt) => {
                          const disabled = opt.value === 'network' && !isAmbassador;
                          return (
                            <Pressable
                              key={opt.value}
                              style={[styles.selectItem, disabled && styles.selectItemDisabled]}
                              onPress={() => {
                                if (disabled) {
                                  flashStatus('This option is only available for group ambassadors');
                                  return;
                                }
                                setOpenSelect(null);
                                updateSetting('profile', 'profileVisibility', opt.value);
                              }}
                            >
                              <ThemedText
                                style={[
                                  styles.selectItemText,
                                  disabled && styles.selectItemTextDisabled,
                                ]}
                              >
                                {opt.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingText}>
                    <ThemedText style={styles.settingLabel}>
                      Direct messages <ThemedText style={styles.liveBadge}>Live</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.settingHelp}>
                      Choose who can start conversations with you.
                    </ThemedText>
                  </View>
                  <View style={styles.selectWrap}>
                    <Pressable
                      style={styles.selectButton}
                      onPress={() =>
                        setOpenSelect(openSelect === 'allowMessages' ? null : 'allowMessages')
                      }
                    >
                      <ThemedText style={styles.selectButtonText}>
                        {dmOptions.find((opt) => opt.value === settings.profile.allowMessagesFrom)?.label ||
                          'Select'}
                      </ThemedText>
                      <MaterialCommunityIcons name="chevron-down" size={16} color={colors.subtext} />
                    </Pressable>
                    {openSelect === 'allowMessages' ? (
                      <View style={styles.selectMenu}>
                        {dmOptions.map((opt) => (
                          <Pressable
                            key={opt.value}
                            style={styles.selectItem}
                            onPress={() => {
                              setOpenSelect(null);
                              updateSetting('profile', 'allowMessagesFrom', opt.value);
                            }}
                          >
                            <ThemedText style={styles.selectItemText}>{opt.label}</ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingText}>
                    <ThemedText style={styles.settingLabel}>
                      Contact visibility <ThemedText style={styles.liveBadge}>Live</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.settingHelp}>
                      Choose who can see your email on your profile.
                    </ThemedText>
                  </View>
                  <View style={styles.selectWrap}>
                    <Pressable
                      style={styles.selectButton}
                      onPress={() => setOpenSelect(openSelect === 'showEmail' ? null : 'showEmail')}
                    >
                      <ThemedText style={styles.selectButtonText}>
                        {emailOptions.find((opt) => opt.value === settings.profile.showEmail)?.label ||
                          'Select'}
                      </ThemedText>
                      <MaterialCommunityIcons name="chevron-down" size={16} color={colors.subtext} />
                    </Pressable>
                    {openSelect === 'showEmail' ? (
                      <View style={styles.selectMenu}>
                        {emailOptions.map((opt) => (
                          <Pressable
                            key={opt.value}
                            style={styles.selectItem}
                            onPress={() => {
                              setOpenSelect(null);
                              updateSetting('profile', 'showEmail', opt.value);
                            }}
                          >
                            <ThemedText style={styles.selectItemText}>{opt.label}</ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={[styles.settingRow, styles.settingRowLast]}>
                  <View style={styles.settingText}>
                    <ThemedText style={styles.settingLabel}>
                      Discoverability <ThemedText style={styles.liveBadge}>Live</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.settingHelp}>
                      Allow others to find you in search and recommendations.
                    </ThemedText>
                  </View>
                  <View style={styles.selectWrap}>
                    <Pressable
                      style={styles.selectButton}
                      onPress={() =>
                        setOpenSelect(openSelect === 'discoverable' ? null : 'discoverable')
                      }
                    >
                      <ThemedText style={styles.selectButtonText}>
                        {discoverOptions.find((opt) => opt.value === settings.profile.discoverable)?.label ||
                          'Select'}
                      </ThemedText>
                      <MaterialCommunityIcons name="chevron-down" size={16} color={colors.subtext} />
                    </Pressable>
                    {openSelect === 'discoverable' ? (
                      <View style={styles.selectMenu}>
                        {discoverOptions.map((opt) => (
                          <Pressable
                            key={opt.value}
                            style={styles.selectItem}
                            onPress={() => {
                              setOpenSelect(null);
                              updateSetting('profile', 'discoverable', opt.value);
                            }}
                          >
                            <ThemedText style={styles.selectItemText}>{opt.label}</ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeading}>
                  <View style={styles.cardEyebrow}>
                    <MaterialCommunityIcons name="tag" size={16} color={colors.text} />
                    <ThemedText style={styles.cardEyebrowText}>Tag interests</ThemedText>
                  </View>
                  <ThemedText style={styles.cardHelp}>
                    Update the topics that shape your feed recommendations.
                  </ThemedText>
                </View>
                {isLoadingTags || tagsLoading ? (
                  <ThemedText style={styles.mutedText}>Loading interests…</ThemedText>
                ) : (
                  <View style={styles.tagGrid}>
                    {tagOptions.map((tag) => {
                      const selected = tagInterests.includes(tag.slug);
                      return (
                        <Pressable
                          key={tag.slug}
                          onPress={() => toggleTag(tag.slug)}
                          style={[styles.tagChip, selected && styles.tagChipSelected]}
                        >
                          <ThemedText style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                            {tag.name}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.pillButton, styles.pillSecondary]}
                    onPress={saveInterests}
                    disabled={isSavingTags || tagsLoading || isLoadingTags}
                  >
                    <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>
                      {isSavingTags ? 'Saving…' : 'Save interests'}
                    </ThemedText>
                  </Pressable>
                  <ThemedText style={styles.helperText}>Select up to 8 tags.</ThemedText>
                </View>
              </View>
            </>
          ) : null}

          {activeTab === 'notifications' ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="bell" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Notifications</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>
                  Stay on top of replies, messages, and campus news.
                </ThemedText>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>
                    Email updates <ThemedText style={styles.badgeSubtle}>On-hold</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Security alerts and activity summaries.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.notifications.email && styles.toggleActive]}
                  onPress={() => updateSetting('notifications', 'email', !settings.notifications.email)}
                >
                  <View style={[styles.toggleThumb, settings.notifications.email && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Send test email</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Confirm MailerSend can reach your inbox.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.pillButton, styles.pillSecondary]}
                  onPress={sendTestEmail}
                  disabled={isSendingTestEmail}
                >
                  <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>
                    {isSendingTestEmail ? 'Sending…' : 'Send Test Email'}
                  </ThemedText>
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>
                    Replies <ThemedText style={styles.liveBadge}>Live</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Notify me when my posts get replies.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.notifications.replies && styles.toggleActive]}
                  onPress={() => updateSetting('notifications', 'replies', !settings.notifications.replies)}
                >
                  <View style={[styles.toggleThumb, settings.notifications.replies && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>
                    Votes <ThemedText style={styles.liveBadge}>Live</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Notify me when my posts get upvotes or downvotes.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.notifications.votes && styles.toggleActive]}
                  onPress={() => updateSetting('notifications', 'votes', !settings.notifications.votes)}
                >
                  <View style={[styles.toggleThumb, settings.notifications.votes && styles.toggleThumbActive]} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === 'security' ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="shield-check" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Security</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>Protect your account and control sign-ins.</ThemedText>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>
                    Two-factor auth <ThemedText style={styles.liveBadge}>Live</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Add a code when signing in from new devices.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.security.twoFactor && styles.toggleActive]}
                  onPress={() => updateSetting('security', 'twoFactor', !settings.security.twoFactor)}
                >
                  <View style={[styles.toggleThumb, settings.security.twoFactor && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Login alerts <ThemedText style={styles.badgeSubtle}>On-hold</ThemedText></ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Email alerts when a new device signs in.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.security.loginAlerts && styles.toggleActive]}
                  onPress={() => updateSetting('security', 'loginAlerts', !settings.security.loginAlerts)}
                >
                  <View style={[styles.toggleThumb, settings.security.loginAlerts && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>
                    Session timeout <ThemedText style={styles.liveBadge}>Live</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Choose how long to stay signed in without activity.
                  </ThemedText>
                </View>
                <View style={styles.selectWrap}>
                  <Pressable
                    style={styles.selectButton}
                    onPress={() =>
                      setOpenSelect(openSelect === 'sessionTimeout' ? null : 'sessionTimeout')
                    }
                  >
                    <ThemedText style={styles.selectButtonText}>
                      {sessionTimeoutOptions.find((opt) => opt.value === settings.security.sessionTimeout)?.label ||
                        'Select'}
                    </ThemedText>
                    <MaterialCommunityIcons name="chevron-down" size={16} color={colors.subtext} />
                  </Pressable>
                  {openSelect === 'sessionTimeout' ? (
                    <View style={styles.selectMenu}>
                      {sessionTimeoutOptions.map((opt) => (
                        <Pressable
                          key={opt.value}
                          style={styles.selectItem}
                          onPress={() => {
                            setOpenSelect(null);
                            updateSetting('security', 'sessionTimeout', opt.value);
                          }}
                        >
                          <ThemedText style={styles.selectItemText}>{opt.label}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {activeTab === 'feed' ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="rss" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Feed preferences</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>
                  Customize the default feed you see after login.
                </ThemedText>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>
                    Default feed <ThemedText style={styles.liveBadge}>Live</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Choose which feed opens first.
                  </ThemedText>
                </View>
                <View style={styles.selectWrap}>
                  <Pressable
                    style={styles.selectButton}
                    onPress={() =>
                      setOpenSelect(openSelect === 'defaultFeed' ? null : 'defaultFeed')
                    }
                  >
                    <ThemedText style={styles.selectButtonText}>
                      {defaultFeedOptions.find((opt) => opt.value === settings.feed.defaultFeed)?.label ||
                        'Select'}
                    </ThemedText>
                    <MaterialCommunityIcons name="chevron-down" size={16} color={colors.subtext} />
                  </Pressable>
                  {openSelect === 'defaultFeed' ? (
                    <View style={styles.selectMenu}>
                      {defaultFeedOptions.map((opt) => (
                        <Pressable
                          key={opt.value}
                          style={styles.selectItem}
                          onPress={() => {
                            setOpenSelect(null);
                            updateSetting('feed', 'defaultFeed', opt.value);
                          }}
                        >
                          <ThemedText style={styles.selectItemText}>{opt.label}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Autoplay media</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Automatically play videos in feed cards.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.feed.autoplayMedia && styles.toggleActive]}
                  onPress={() => updateSetting('feed', 'autoplayMedia', !settings.feed.autoplayMedia)}
                >
                  <View style={[styles.toggleThumb, settings.feed.autoplayMedia && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Open links in new tab</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Keep your session open while browsing resources.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.feed.openLinksInNewTab && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('feed', 'openLinksInNewTab', !settings.feed.openLinksInNewTab)
                  }
                >
                  <View style={[styles.toggleThumb, settings.feed.openLinksInNewTab && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Filter followed communities</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Prioritize posts from communities you follow.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.feed.filterFollowedCommunities && styles.toggleActive]}
                  onPress={() =>
                    updateSetting(
                      'feed',
                      'filterFollowedCommunities',
                      !settings.feed.filterFollowedCommunities
                    )
                  }
                >
                  <View style={[styles.toggleThumb, settings.feed.filterFollowedCommunities && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Include events</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Surface upcoming events in feed recommendations.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.feed.includeEvents && styles.toggleActive]}
                  onPress={() => updateSetting('feed', 'includeEvents', !settings.feed.includeEvents)}
                >
                  <View style={[styles.toggleThumb, settings.feed.includeEvents && styles.toggleThumbActive]} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === 'community' ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="school" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Community</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>
                  Decide how you connect with campus communities.
                </ThemedText>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>
                    Auto-join campus groups <ThemedText style={styles.badgeSubtle}>In testing</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Automatically accept invites from your university teams.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.community.autoJoinCampus && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('community', 'autoJoinCampus', !settings.community.autoJoinCampus)
                  }
                >
                  <View style={[styles.toggleThumb, settings.community.autoJoinCampus && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Allow invites</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Enable peers to invite you to private groups.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.community.allowInvites && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('community', 'allowInvites', !settings.community.allowInvites)
                  }
                >
                  <View style={[styles.toggleThumb, settings.community.allowInvites && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Show achievements</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Display badges and milestones on your profile.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.community.showAchievements && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('community', 'showAchievements', !settings.community.showAchievements)
                  }
                >
                  <View style={[styles.toggleThumb, settings.community.showAchievements && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Hide NSFW content</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Filter content flagged as sensitive.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.community.hideNSFW && styles.toggleActive]}
                  onPress={() => updateSetting('community', 'hideNSFW', !settings.community.hideNSFW)}
                >
                  <View style={[styles.toggleThumb, settings.community.hideNSFW && styles.toggleThumbActive]} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === 'integrations' && canConnectZoom ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="power-plug" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Integrations</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>
                  Connect tools you use to host events and sessions.
                </ThemedText>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Zoom</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Link Zoom to schedule meeting links for events you host.
                  </ThemedText>
                </View>
                <View style={styles.inlineActions}>
                  {zoomStatus.loading ? (
                    <View style={styles.badge}>
                      <ThemedText style={styles.badgeText}>Checking…</ThemedText>
                    </View>
                  ) : zoomStatus.connected ? (
                    <>
                      <View style={[styles.badge, styles.badgePositive]}>
                        <ThemedText style={[styles.badgeText, styles.badgePositiveText]}>
                          {zoomStatus.email ? `Connected as ${zoomStatus.email}` : 'Connected'}
                        </ThemedText>
                      </View>
                      <Pressable style={[styles.pillButton, styles.pillSecondary]} onPress={handleZoomDisconnect}>
                        <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>Disconnect</ThemedText>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable style={styles.pillButton} onPress={handleZoomConnect}>
                      <ThemedText style={styles.pillText}>Connect Zoom</ThemedText>
                    </Pressable>
                  )}
                </View>
              </View>
              {zoomStatus.error ? (
                <View style={styles.settingRow}>
                  <ThemedText style={styles.errorText}>{zoomStatus.error}</ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          {activeTab === 'moderation' && isModeratorUser ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="bullhorn" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Moderation tools</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>
                  Surface the controls you need while moderating forums.
                </ThemedText>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Escalate new reports</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Send report digests to your inbox for forums you manage.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.moderation.escalateReports && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('moderation', 'escalateReports', !settings.moderation.escalateReports)
                  }
                >
                  <View style={[styles.toggleThumb, settings.moderation.escalateReports && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Lock quiet threads</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Auto-lock threads after 7 days of inactivity.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.moderation.lockThreads && styles.toggleActive]}
                  onPress={() => updateSetting('moderation', 'lockThreads', !settings.moderation.lockThreads)}
                >
                  <View style={[styles.toggleThumb, settings.moderation.lockThreads && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Approve new members</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Require approval for new joins to private forums.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.moderation.approveNewMembers && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('moderation', 'approveNewMembers', !settings.moderation.approveNewMembers)
                  }
                >
                  <View style={[styles.toggleThumb, settings.moderation.approveNewMembers && styles.toggleThumbActive]} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === 'ambassador' && isAmbassador ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="account-star" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Ambassador tools</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>
                  Control how you appear to prospective students and partners.
                </ThemedText>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Spotlight in feed</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Feature ambassador posts in campus-wide feeds.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.ambassador.spotlightInFeed && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('ambassador', 'spotlightInFeed', !settings.ambassador.spotlightInFeed)
                  }
                >
                  <View style={[styles.toggleThumb, settings.ambassador.spotlightInFeed && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>DM office hours</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Allow students to book office-hour style chats.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.ambassador.dmOfficeHours && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('ambassador', 'dmOfficeHours', !settings.ambassador.dmOfficeHours)
                  }
                >
                  <View style={[styles.toggleThumb, settings.ambassador.dmOfficeHours && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Enable reply templates</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Use saved replies for common admissions questions.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.ambassador.autoReplyTemplates && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('ambassador', 'autoReplyTemplates', !settings.ambassador.autoReplyTemplates)
                  }
                >
                  <View style={[styles.toggleThumb, settings.ambassador.autoReplyTemplates && styles.toggleThumbActive]} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === 'admin' && isAdminUser ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="shield-lock" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Admin & compliance</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>High-trust controls for platform safety.</ThemedText>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Maintenance mode</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Show a banner before scheduled downtime.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.admin.maintenanceMode && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('admin', 'maintenanceMode', !settings.admin.maintenanceMode)
                  }
                >
                  <View style={[styles.toggleThumb, settings.admin.maintenanceMode && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Verification submissions</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Review student and staff proof uploads.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.pillButton, styles.pillSecondary]}
                  onPress={() => router.push('/verifications')}
                >
                  <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>Open review queue</ThemedText>
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Require SSO</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Limit sign-in to verified university single sign-on.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.admin.requireSSO && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('admin', 'requireSSO', !settings.admin.requireSSO)
                  }
                >
                  <View style={[styles.toggleThumb, settings.admin.requireSSO && styles.toggleThumbActive]} />
                </Pressable>
              </View>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Analytics</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Enable anonymized engagement metrics.
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.toggle, settings.admin.enableAnalytics && styles.toggleActive]}
                  onPress={() =>
                    updateSetting('admin', 'enableAnalytics', !settings.admin.enableAnalytics)
                  }
                >
                  <View style={[styles.toggleThumb, settings.admin.enableAnalytics && styles.toggleThumbActive]} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === 'sessions' ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="shield-check" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Sessions and devices</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>
                  Sign out devices you do not recognize.
                </ThemedText>
              </View>
              {loadingSessions ? <ThemedText style={styles.mutedText}>Loading sessions…</ThemedText> : null}
              {sessionsError ? <ThemedText style={styles.errorText}>{sessionsError}</ThemedText> : null}
              {!loadingSessions && !sessionsError && filteredSessions.length === 0 ? (
                <ThemedText style={styles.mutedText}>No active sessions found.</ThemedText>
              ) : null}
              <View style={styles.sessionList}>
                {filteredSessions.map((session) => {
                  const meta = parseUserAgent(session.user_agent || '');
                  const lastActive = session.last_active_at
                    ? new Date(session.last_active_at).toLocaleString()
                    : 'Unknown';
                  return (
                    <View
                      key={session.session_id}
                      style={[styles.sessionItem, session.current && styles.sessionItemCurrent]}
                    >
                      <View style={styles.sessionMeta}>
                        <ThemedText style={styles.settingLabel}>
                          {meta.os} · {meta.browser}
                        </ThemedText>
                        <ThemedText style={styles.settingHelp}>
                          {session.location || session.ip_address || 'Location unavailable'}
                        </ThemedText>
                        <ThemedText style={styles.settingHelp}>Last active {lastActive}</ThemedText>
                      </View>
                      <View style={styles.sessionActions}>
                        {session.current ? (
                          <View style={[styles.badge, styles.badgePositive]}>
                            <ThemedText style={[styles.badgeText, styles.badgePositiveText]}>This device</ThemedText>
                          </View>
                        ) : (
                          <Pressable
                            style={[styles.pillButton, styles.pillSecondary]}
                            onPress={() => revokeSession(session.session_id, false)}
                          >
                            <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>Sign out</ThemedText>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {activeTab === 'data' ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardEyebrow}>
                  <MaterialCommunityIcons name="database" size={16} color={colors.text} />
                  <ThemedText style={styles.cardEyebrowText}>Data and controls</ThemedText>
                </View>
                <ThemedText style={styles.cardHelp}>Export or pause your account.</ThemedText>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>
                    Download data <ThemedText style={styles.badgeSubtle}>On-hold</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Export posts, messages, and connections as a zip.
                  </ThemedText>
                </View>
                <Pressable style={[styles.pillButton, styles.pillSecondary]} onPress={handleExportData}>
                  <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>Generate export</ThemedText>
                </Pressable>
              </View>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingLabel}>Deactivate account</ThemedText>
                  <ThemedText style={styles.settingHelp}>
                    Temporarily hide your profile and content.
                  </ThemedText>
                </View>
                <Pressable style={[styles.pillButton, styles.pillDanger]} onPress={handleDeactivateAccount}>
                  <ThemedText style={[styles.pillText, styles.pillDangerText]}>Deactivate</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <ThemedText style={styles.footnote}>
          Profile visibility and online status save to your account; remaining toggles are local-only for now.
        </ThemedText>
      </ScrollView>

      <Modal transparent visible={showResetModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Reset settings?</ThemedText>
            <ThemedText style={styles.modalBody}>
              Are you sure you want to reset your settings to the defaults?
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.pillButton, styles.pillSecondary]}
                onPress={() => setShowResetModal(false)}
              >
                <ThemedText style={[styles.pillText, styles.pillSecondaryText]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.pillButton, styles.pillDanger]}
                onPress={handleResetDefaults}
              >
                <ThemedText style={[styles.pillText, styles.pillDangerText]}>Reset defaults</ThemedText>
              </Pressable>
            </View>
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
      paddingTop: Brand.spacing.lg,
      paddingBottom: 32,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerText: {
      gap: 6,
      flex: 1,
      minWidth: 240,
    },
    kicker: {
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      fontSize: 11,
      fontWeight: '700',
      color: colors.subtext,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    badge: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 11,
      color: colors.text,
    },
    badgePositive: {
      borderColor: hexToRgba(colors.primaryFrom, 0.5),
      backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
    },
    badgePositiveText: {
      color: colors.primaryFrom,
      fontWeight: '700',
    },
    badgeSubtle: {
      color: colors.subtext,
      fontSize: 10,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    status: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: hexToRgba(colors.primaryFrom, 0.35),
      backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    statusText: {
      fontSize: 12,
      color: colors.primaryFrom,
      fontWeight: '600',
    },
    tabs: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 8,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: 'transparent',
      marginRight: 8,
    },
    tabActive: {
      borderColor: colors.primaryFrom,
      backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
      shadowColor: colors.primaryFrom,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    tabText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '600',
    },
    tabTextActive: {
      color: colors.primaryFrom,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    loadingText: {
      fontSize: 12,
      color: colors.subtext,
    },
    grid: {
      gap: 14,
    },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 14,
      gap: 12,
      shadowColor: '#0f172a',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 2,
    },
    cardHeading: {
      gap: 6,
    },
    cardEyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardEyebrowText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    cardHelp: {
      fontSize: 12,
      color: colors.subtext,
    },
    settingRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 10,
    },
    settingRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    settingText: {
      flex: 1,
      minWidth: 200,
      gap: 4,
    },
    settingLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    settingHelp: {
      fontSize: 11,
      color: colors.subtext,
    },
    liveBadge: {
      backgroundColor: colors.primaryFrom,
      color: '#fff',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      fontSize: 9,
      fontWeight: '700',
    },
    selectWrap: {
      minWidth: 180,
      alignSelf: 'flex-start',
      gap: 6,
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.card,
    },
    selectButtonText: {
      fontSize: 12,
      color: colors.text,
    },
    selectMenu: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    selectItem: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    selectItemDisabled: {
      opacity: 0.5,
    },
    selectItemText: {
      fontSize: 12,
      color: colors.text,
    },
    selectItemTextDisabled: {
      color: colors.subtext,
    },
    toggle: {
      width: 46,
      height: 26,
      borderRadius: 999,
      backgroundColor: colors.border,
      padding: 3,
      justifyContent: 'center',
    },
    toggleActive: {
      backgroundColor: colors.primaryFrom,
    },
    toggleThumb: {
      width: 20,
      height: 20,
      borderRadius: 999,
      backgroundColor: colors.card,
      transform: [{ translateX: 0 }],
    },
    toggleThumbActive: {
      transform: [{ translateX: 18 }],
    },
    tagGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tagChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: hexToRgba(colors.text, 0.04),
    },
    tagChipSelected: {
      borderColor: colors.primaryFrom,
      backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
    },
    tagChipText: {
      fontSize: 11,
      color: colors.text,
    },
    tagChipTextSelected: {
      color: colors.primaryFrom,
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },
    helperText: {
      fontSize: 11,
      color: colors.subtext,
    },
    mutedText: {
      fontSize: 12,
      color: colors.subtext,
    },
    errorText: {
      fontSize: 12,
      color: colors.danger,
    },
    inlineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    sessionList: {
      gap: 10,
    },
    sessionItem: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 8,
      backgroundColor: colors.card,
    },
    sessionItemCurrent: {
      borderColor: hexToRgba(colors.primaryFrom, 0.4),
      backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
    },
    sessionMeta: {
      gap: 4,
    },
    sessionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pillButton: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.primaryFrom,
    },
    pillSecondary: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillDanger: {
      backgroundColor: hexToRgba(colors.danger, 0.15),
      borderWidth: 1,
      borderColor: hexToRgba(colors.danger, 0.4),
    },
    pillText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#fff',
    },
    pillSecondaryText: {
      color: colors.text,
    },
    pillDangerText: {
      color: colors.danger,
    },
    primaryButton: {
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primaryFrom,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
      backgroundColor: colors.page,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 12,
      color: colors.subtext,
      textAlign: 'center',
    },
    footnote: {
      fontSize: 11,
      color: colors.subtext,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 12,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    modalBody: {
      fontSize: 12,
      color: colors.subtext,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      flexWrap: 'wrap',
    },
  });
