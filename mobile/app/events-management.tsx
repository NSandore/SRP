import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { isAdmin, isSuperAdmin } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { apiClient } from '@/lib/api/client';

const STORAGE_KEY = 'managedEvents';
const isWeb = Platform.OS === 'web';

type CommunityOption = {
  id: string;
  name: string;
  tagline?: string;
};

type EventItem = {
  id: string;
  type: 'event' | 'announcement' | 'poll' | string;
  title: string;
  description?: string;
  date?: string;
  location?: string;
  scope?: 'global' | 'community' | string;
  communityId?: string;
  communityName?: string;
  pollOptions?: string[];
  showResults?: boolean;
  zoomMeetingId?: string;
  zoomJoinUrl?: string;
  zoomStartUrl?: string;
  zoomHostEmail?: string;
  zoomDuration?: number;
  createdBy?: string;
  createdAt?: string;
  isRemote?: boolean;
};

type Notice = {
  type: 'success' | 'error' | 'info';
  text: string;
};

const isSecureStoreAvailable = async () => {
  if (isWeb) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

const readStorage = async (key: string) => {
  try {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    const useSecureStore = await isSecureStoreAvailable();
    if (!useSecureStore) return null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const writeStorage = async (key: string, value: string | null) => {
  try {
    if (isWeb) {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
      return;
    }
    const useSecureStore = await isSecureStoreAvailable();
    if (!useSecureStore) return;
    if (value === null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    // ignore storage failures
  }
};

const normalizeEvents = (raw: any): EventItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && (item.id || item.event_id) && item.title)
    .map((item) => ({
      id: String(item.id ?? item.event_id),
      type: item.type || item.event_type || 'event',
      title: String(item.title ?? ''),
      description: item.description || '',
      date: item.date || item.start_at || item.startAt || item.starts_at || '',
      location: item.location || '',
      scope: item.scope || (item.communityId || item.community_id ? 'community' : 'global'),
      communityId: item.communityId ? String(item.communityId) : item.community_id ? String(item.community_id) : '',
      communityName: item.communityName || item.community_name || '',
      pollOptions: Array.isArray(item.pollOptions) ? item.pollOptions : [],
      showResults: Boolean(item.showResults),
      zoomMeetingId: item.zoomMeetingId || '',
      zoomJoinUrl: item.zoomJoinUrl || '',
      zoomStartUrl: item.zoomStartUrl || '',
      zoomHostEmail: item.zoomHostEmail || '',
      zoomDuration: item.zoomDuration ? Number(item.zoomDuration) : 60,
      createdBy: item.createdBy || '',
      createdAt: item.createdAt || '',
    }));
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const toZoomTimestamp = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'announcement':
      return 'Announcement';
    case 'poll':
      return 'Poll';
    default:
      return 'Event / Webinar';
  }
};

const getDatePrefix = (type: string) => {
  switch (type) {
    case 'announcement':
      return 'Publishes';
    case 'poll':
      return 'Closes';
    default:
      return 'Occurs';
  }
};

export default function EventsManagementScreen() {
  const { user } = useSession();
  const params = useLocalSearchParams<{ type?: string }>();
  const filterType = Array.isArray(params?.type) ? params.type[0] : params?.type;
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const roleId = user?.role_id;
  const isSuperAdminUser = isSuperAdmin(roleId);
  const isAdminRole = isAdmin(roleId);
  const isAmbassador = Number(user?.is_ambassador) === 1;
  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(user?.admin_community_ids)) return [];
    return user?.admin_community_ids.map((id) => String(id));
  }, [user?.admin_community_ids]);

  const [ambassadorCommunities, setAmbassadorCommunities] = useState<CommunityOption[]>([]);
  const ambassadorCommunityIds = useMemo(
    () => ambassadorCommunities.map((c) => String(c.id)).filter(Boolean),
    [ambassadorCommunities]
  );
  const isCommunityAdmin = adminCommunityIds.length > 0;
  const canManage =
    isSuperAdminUser || isAdminRole || isCommunityAdmin || ambassadorCommunityIds.length > 0;
  const canUseZoom = isSuperAdminUser || isCommunityAdmin || isAmbassador || isAdminRole;
  const canPublishAllTypes = isCommunityAdmin || isAdminRole;

  const itemTypes = useMemo(
    () =>
      canPublishAllTypes
        ? [
            { value: 'event', label: 'Event / Webinar' },
            { value: 'announcement', label: 'Announcement' },
            { value: 'poll', label: 'Poll' },
          ]
        : [{ value: 'event', label: 'Event / Webinar' }],
    [canPublishAllTypes]
  );

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [message, setMessage] = useState<Notice | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [allCommunities, setAllCommunities] = useState<CommunityOption[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [followedCommunities, setFollowedCommunities] = useState<string[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [remoteAnnouncements, setRemoteAnnouncements] = useState<EventItem[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [zoomStatus, setZoomStatus] = useState({
    loading: false,
    connected: false,
    email: '',
    error: '',
  });
  const [isZoomSaving, setIsZoomSaving] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false);
  const segAnim = useRef(new Animated.Value(0)).current;

  const primaryCommunityId = adminCommunityIds[0] || ambassadorCommunityIds[0] || '';
  const initialForm = useMemo(
    () => ({
      type: 'event',
      title: '',
      description: '',
      date: '',
      location: '',
      scope: isSuperAdminUser ? 'global' : 'community',
      communityId: primaryCommunityId,
      communityName: '',
      pollOptions: '',
      showResults: false,
      useZoom: false,
      zoomMeetingId: '',
      zoomJoinUrl: '',
      zoomStartUrl: '',
      zoomHostEmail: '',
      zoomDuration: 60,
    }),
    [isSuperAdminUser, primaryCommunityId]
  );

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      scope: isSuperAdminUser ? prev.scope : 'community',
      communityId: primaryCommunityId || prev.communityId,
    }));
  }, [isSuperAdminUser, primaryCommunityId]);

  useEffect(() => {
    const index = form.scope === 'global' ? 0 : 1;
    Animated.timing(segAnim, {
      toValue: index,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [form.scope, segAnim]);

  const readLocalEvents = async () => {
    setLoadingEvents(true);
    const raw = await readStorage(STORAGE_KEY);
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      setEvents(normalizeEvents(parsed));
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    readLocalEvents();
    if (!isWeb) return;
    const handleStorage = (e: any) => {
      if (e.key === STORAGE_KEY) readLocalEvents();
    };
    const handleCustomUpdate = (e: any) => {
      if (e?.detail?.key === STORAGE_KEY || !e?.detail) {
        readLocalEvents();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('managedEventsUpdated', handleCustomUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('managedEventsUpdated', handleCustomUpdate);
    };
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    let mounted = true;
    const loadCommunities = async () => {
      setLoadingCommunities(true);
      try {
        const res = await apiClient.get('/fetch_communities.php');
        const payload = Array.isArray(res.data) ? res.data : [];
        const normalized = payload
          .map((c: any) => ({
            id: String(c.id ?? c.community_id ?? ''),
            name: c.name || 'Unnamed community',
            tagline: c.tagline || '',
          }))
          .filter((c: CommunityOption) => c.id);
        if (mounted) {
          setAllCommunities(normalized);
        }
      } catch {
        if (mounted) setAllCommunities([]);
      } finally {
        if (mounted) setLoadingCommunities(false);
      }
    };
    loadCommunities();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadAmbassador = async () => {
      if (!isAmbassador || !user?.user_id) {
        setAmbassadorCommunities([]);
        return;
      }
      try {
        const res = await apiClient.get('/fetch_ambassador_communities.php', {
          params: { user_id: user.user_id },
        });
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray((res.data as any)?.communities)
          ? (res.data as any).communities
          : [];
        const normalized = list
          .map((c: any) => ({
            id: String(c.community_id ?? c.id ?? ''),
            name: c.name || 'Unnamed community',
          }))
          .filter((c: CommunityOption) => c.id);
        if (mounted) setAmbassadorCommunities(normalized);
      } catch {
        if (mounted) setAmbassadorCommunities([]);
      }
    };
    loadAmbassador();
    return () => {
      mounted = false;
    };
  }, [isAmbassador, user?.user_id]);

  useEffect(() => {
    let mounted = true;
    const loadFollowed = async () => {
      if (!user?.user_id) return;
      setLoadingFollowed(true);
      try {
        const res = await apiClient.get('/followed_communities.php', {
          params: { user_id: user.user_id },
        });
        if (mounted) {
          const list = Array.isArray(res.data) ? res.data : [];
          const ids = list.map((c: any) => String(c.community_id ?? c.id ?? '')).filter(Boolean);
          setFollowedCommunities(ids);
        }
      } catch {
        if (mounted) setFollowedCommunities([]);
      } finally {
        if (mounted) setLoadingFollowed(false);
      }
    };
    loadFollowed();
    return () => {
      mounted = false;
    };
  }, [user?.user_id]);

  useEffect(() => {
    let mounted = true;
    const loadAnnouncements = async () => {
      setLoadingAnnouncements(true);
      try {
        const res = await apiClient.get('/fetch_global_announcements.php');
        const list = Array.isArray((res.data as any)?.announcements)
          ? (res.data as any).announcements
          : [];
        const normalized = list
          .map((a: any) => ({
            id: String(a.announcement_id || a.id || ''),
            type: 'announcement',
            title: (a.title || '').trim() || 'Announcement',
            description: (a.body || '').trim(),
            date: a.starts_at || '',
            scope: 'global',
            communityId: '',
            communityName: 'Global',
            pollOptions: [],
            showResults: false,
            createdAt: a.created_at || a.starts_at || '',
            isRemote: true,
          }))
          .filter((a: EventItem) => a.id);
        if (mounted) setRemoteAnnouncements(normalized);
      } catch {
        if (mounted) setRemoteAnnouncements([]);
      } finally {
        if (mounted) setLoadingAnnouncements(false);
      }
    };
    loadAnnouncements();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadZoom = async () => {
      if (!canUseZoom) return;
      setZoomStatus((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const res = await apiClient.get('/zoom_status.php');
        if (!mounted) return;
        if ((res.data as any)?.success) {
          setZoomStatus({
            loading: false,
            connected: Boolean((res.data as any).connected),
            email: (res.data as any).zoom_email || '',
            error: '',
          });
        } else {
          setZoomStatus((prev) => ({
            ...prev,
            loading: false,
            connected: false,
            error: (res.data as any)?.error || 'Unable to load Zoom status.',
          }));
        }
      } catch {
        if (!mounted) return;
        setZoomStatus((prev) => ({
          ...prev,
          loading: false,
          connected: false,
          error: 'Unable to load Zoom status.',
        }));
      }
    };
    loadZoom();
    return () => {
      mounted = false;
    };
  }, [canUseZoom]);

  const permittedCommunities = useMemo(() => {
    if (isAdminRole) return allCommunities;
    const allowed = new Set([...adminCommunityIds, ...ambassadorCommunityIds]);
    return allCommunities.filter((c) => allowed.has(String(c.id)));
  }, [allCommunities, adminCommunityIds, ambassadorCommunityIds, isAdminRole]);

  const filteredCommunities = useMemo(() => {
    const term = communitySearch.trim().toLowerCase();
    if (!term) return [];
    return permittedCommunities.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.tagline || '').toLowerCase().includes(term)
    );
  }, [communitySearch, permittedCommunities]);

  useEffect(() => {
    if (form.scope !== 'community') return;
    const allowedIds = permittedCommunities.map((c) => String(c.id));
    if (allowedIds.length === 0) {
      setForm((prev) => ({ ...prev, communityId: '', communityName: '' }));
      return;
    }
    if (!allowedIds.includes(String(form.communityId))) {
      const fallback = permittedCommunities[0];
      setForm((prev) => ({
        ...prev,
        communityId: fallback.id,
        communityName: fallback.name,
      }));
    }
  }, [form.scope, form.communityId, permittedCommunities]);

  const followsCommunity = (communityId?: string) => {
    if (!communityId) return false;
    if (adminCommunityIds.includes(String(communityId))) return true;
    if (ambassadorCommunityIds.includes(String(communityId))) return true;
    return followedCommunities.includes(String(communityId));
  };

  const isVisibleToUser = (item: EventItem) => {
    if (item.scope === 'global') return true;
    if (isSuperAdminUser || isAdminRole) return true;
    if (adminCommunityIds.includes(String(item.communityId || ''))) return true;
    if (ambassadorCommunityIds.includes(String(item.communityId || ''))) return true;
    return followsCommunity(item.communityId);
  };

  const canManageEvent = (item: EventItem) => {
    if (isSuperAdminUser || isAdminRole) return true;
    if (item.scope !== 'community') return false;
    const allowedIds = new Set([...adminCommunityIds, ...ambassadorCommunityIds]);
    return allowedIds.has(String(item.communityId || ''));
  };

  const manageableEvents = useMemo(() => events.filter((evt) => canManageEvent(evt)), [events, adminCommunityIds, ambassadorCommunityIds, isSuperAdminUser, isAdminRole]);
  const visibleEvents = useMemo(() => events.filter((evt) => isVisibleToUser(evt)), [events, adminCommunityIds, ambassadorCommunityIds, followedCommunities, isSuperAdminUser, isAdminRole]);

  const announcementItems = useMemo(() => {
    const existingIds = new Set(events.map((item) => item.id));
    return remoteAnnouncements.filter((item) => !existingIds.has(item.id));
  }, [remoteAnnouncements, events]);

  const itemsToShow = useMemo(() => {
    const base = canManage ? manageableEvents : visibleEvents;
    return [...announcementItems, ...base];
  }, [announcementItems, manageableEvents, visibleEvents, canManage]);

  const filteredItems = useMemo(() => {
    if (!filterType) return itemsToShow;
    if (filterType === 'poll') return itemsToShow.filter((item) => item.type === 'poll');
    if (filterType === 'announcement') return itemsToShow.filter((item) => item.type === 'announcement');
    if (filterType === 'event') return itemsToShow.filter((item) => item.type === 'event' || !item.type);
    return itemsToShow;
  }, [filterType, itemsToShow]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...initialForm,
      scope: isSuperAdminUser ? initialForm.scope : 'community',
      communityId: primaryCommunityId,
    });
  };

  const startEdit = (event: EventItem) => {
    setEditingId(event.id);
    setForm({
      type: event.type || 'event',
      title: event.title || '',
      description: event.description || '',
      date: event.date || '',
      location: event.location || '',
      scope: event.scope || 'community',
      communityId: event.communityId || '',
      communityName: event.communityName || '',
      pollOptions: Array.isArray(event.pollOptions) ? event.pollOptions.join('\n') : '',
      showResults: Boolean(event.showResults),
      useZoom: Boolean(event.zoomMeetingId || event.zoomJoinUrl),
      zoomMeetingId: event.zoomMeetingId || '',
      zoomJoinUrl: event.zoomJoinUrl || '',
      zoomStartUrl: event.zoomStartUrl || '',
      zoomHostEmail: event.zoomHostEmail || '',
      zoomDuration: Number(event.zoomDuration) || 60,
    });
    setMessage({ type: 'info', text: 'Editing an existing item.' });
  };

  const handleSubmit = async () => {
    if (!canManage) {
      setMessage({ type: 'error', text: 'You need admin or ambassador access to manage items.' });
      return;
    }

    const type = form.type || 'event';
    const scope = isSuperAdminUser ? form.scope : 'community';
    const title = form.title.trim();
    const description = form.description.trim();
    const location = form.location.trim();
    const date = form.date.trim();
    let communityId = scope === 'community' ? String(form.communityId || '').trim() : '';
    let communityName = form.communityName.trim();

    if (!title) {
      setMessage({ type: 'error', text: 'Please add a title for this item.' });
      return;
    }
    if (!canPublishAllTypes && type !== 'event') {
      setMessage({ type: 'error', text: 'Ambassadors can only create events.' });
      return;
    }
    if (type === 'event' && !date) {
      setMessage({ type: 'error', text: 'Please add a date and time for the event/webinar.' });
      return;
    }

    let pollOptions: string[] = [];
    if (type === 'poll') {
      pollOptions = form.pollOptions
        .split('\n')
        .map((opt) => opt.trim())
        .filter(Boolean);
      if (pollOptions.length < 2) {
        setMessage({ type: 'error', text: 'Polls need at least two answer options.' });
        return;
      }
    }

    if (scope === 'community') {
      if (!communityId) {
        setMessage({ type: 'error', text: 'Select which community this item belongs to.' });
        return;
      }
      const allowedCommunityIds = new Set([...adminCommunityIds, ...ambassadorCommunityIds]);
      if (!isAdminRole && !allowedCommunityIds.has(communityId)) {
        setMessage({ type: 'error', text: 'You can only manage items for communities you admin or represent.' });
        return;
      }
      const option = permittedCommunities.find((c) => String(c.id) === communityId);
      if (option) {
        communityName = communityName || option.name;
      }
      communityName = communityName || `Community ${communityId}`;
    }

    let zoomMeetingId = form.zoomMeetingId || '';
    let zoomJoinUrl = form.zoomJoinUrl || '';
    let zoomStartUrl = form.zoomStartUrl || '';
    let zoomHostEmail = form.zoomHostEmail || zoomStatus.email || '';
    let zoomDuration = Number(form.zoomDuration) || 60;

    if (type === 'event' && form.useZoom) {
      if (!zoomStatus.connected) {
        setMessage({ type: 'error', text: 'Connect Zoom in Account Settings before creating meetings.' });
        return;
      }
      setIsZoomSaving(true);
      try {
        const eventTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await apiClient.post('/create_zoom_meeting.php', {
          topic: title,
          agenda: description,
          start_time: toZoomTimestamp(date),
          timezone: eventTimezone,
          duration: zoomDuration,
          meeting_id: zoomMeetingId || undefined,
        });
        if ((res.data as any)?.success && (res.data as any)?.meeting) {
          const meeting = (res.data as any).meeting;
          zoomMeetingId = String(meeting.meeting_id || zoomMeetingId || '');
          zoomJoinUrl = meeting.join_url || zoomJoinUrl || '';
          zoomStartUrl = meeting.start_url || zoomStartUrl || '';
          zoomHostEmail = meeting.host_email || zoomHostEmail || '';
        } else {
          setMessage({ type: 'error', text: (res.data as any)?.error || 'Unable to create Zoom meeting.' });
          return;
        }
      } catch {
        setMessage({ type: 'error', text: 'Unable to create Zoom meeting.' });
        return;
      } finally {
        setIsZoomSaving(false);
      }
    } else if (type !== 'event') {
      zoomMeetingId = '';
      zoomJoinUrl = '';
      zoomStartUrl = '';
      zoomHostEmail = '';
    }

    let eventId = editingId || `${Date.now()}`;
    if (type === 'event') {
      try {
        const eventTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await apiClient.post('/upsert_event.php', {
          event_id: editingId || undefined,
          title,
          description,
          start_at: toZoomTimestamp(date),
          timezone: eventTimezone,
          community_id: scope === 'community' ? communityId : '',
          location,
          meeting_provider: zoomJoinUrl ? 'zoom' : 'other',
          meeting_link: zoomJoinUrl || location || '',
          meeting_id: zoomMeetingId || '',
          duration_minutes: zoomDuration,
        });
        if (!(res.data as any)?.success) {
          setMessage({ type: 'error', text: (res.data as any)?.error || 'Unable to save event.' });
          return;
        }
        eventId = (res.data as any)?.event_id || eventId;
      } catch {
        setMessage({ type: 'error', text: 'Unable to save event.' });
        return;
      }
    }

    const payload: EventItem = {
      id: eventId,
      type,
      title,
      description,
      location,
      date,
      scope,
      communityId: scope === 'community' ? communityId : '',
      communityName: scope === 'community' ? communityName : '',
      pollOptions: type === 'poll' ? pollOptions : [],
      showResults: type === 'poll' ? Boolean(form.showResults) : false,
      zoomMeetingId,
      zoomJoinUrl,
      zoomStartUrl,
      zoomHostEmail,
      zoomDuration,
      createdBy: `${user?.first_name || 'Unknown'} ${user?.last_name || ''}`.trim() || 'Unknown user',
      createdAt: new Date().toISOString(),
    };

    if (type === 'announcement') {
      try {
        const res = await apiClient.post('/create_announcement.php', {
          title,
          body: description,
          announcement_type: 'general',
          scope,
          community_id: scope === 'community' ? communityId : '',
          show_banner: true,
          is_dismissible: true,
          starts_at: date || null,
          ends_at: null,
        });
        const announcementId = (res.data as any)?.announcement_id || payload.id;
        const announcementItem = { ...payload, id: announcementId };
        setEvents((prev) =>
          editingId ? prev.map((evt) => (evt.id === editingId ? announcementItem : evt)) : [announcementItem, ...prev]
        );
        setMessage({
          type: 'success',
          text: editingId ? 'Announcement updated.' : 'Announcement published.',
        });
      } catch {
        setMessage({ type: 'error', text: 'Unable to publish announcement.' });
        return;
      } finally {
        resetForm();
      }
      return;
    }

    setEvents((prev) =>
      editingId ? prev.map((evt) => (evt.id === editingId ? payload : evt)) : [payload, ...prev]
    );
    setMessage({ type: 'success', text: editingId ? 'Item updated.' : 'Item created.' });
    resetForm();
  };

  const handleDelete = async (eventId: string) => {
    const target = events.find((evt) => evt.id === eventId);
    if (target && !canManageEvent(target)) {
      setMessage({ type: 'error', text: 'You do not have permission to delete this item.' });
      return;
    }
    if (target?.type === 'event') {
      try {
        const res = await apiClient.post('/delete_event.php', { event_id: eventId });
        if ((res.data as any)?.success === false && (res.data as any)?.error !== 'Event not found') {
          setMessage({ type: 'error', text: (res.data as any)?.error || 'Unable to delete event.' });
          return;
        }
      } catch {
        setMessage({ type: 'error', text: 'Unable to delete event.' });
        return;
      }
    }
    setEvents((prev) => prev.filter((evt) => evt.id !== eventId));
    if (editingId === eventId) resetForm();
    setMessage({ type: 'success', text: 'Event deleted.' });
  };

  const audienceLabel = (event: EventItem) =>
    event.scope === 'global' ? 'Global' : event.communityName || `Community ${event.communityId}`;

  const isPoll = form.type === 'poll';
  const isEventType = form.type === 'event';
  const dateLabel = isPoll
    ? 'Poll closes at (optional)'
    : form.type === 'announcement'
    ? 'Publish time (optional)'
    : 'Date & time';

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText type="title" style={styles.pageTitle}>Event & content management</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              {canManage
                ? isSuperAdminUser
                  ? 'Super admins can publish announcements, polls, and events for any community or globally.'
                  : isAmbassador && !isCommunityAdmin
                  ? 'Ambassadors can schedule announcements, polls, and events for the communities they represent.'
                  : 'Admins and ambassadors can manage announcements, polls, and events for the communities they oversee.'
                : 'Viewing items from communities you follow. Global items appear for everyone.'}
            </ThemedText>
          </View>
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>
              {canManage
                ? isSuperAdminUser
                  ? 'Super admin'
                  : isCommunityAdmin
                  ? 'Community admin'
                  : isAdminRole
                  ? 'Admin'
                  : 'Ambassador'
                : 'Member'}
            </ThemedText>
          </View>
        </View>

        {message ? (
          <View
            style={[
              styles.alert,
              message.type === 'success' && styles.alertSuccess,
              message.type === 'error' && styles.alertError,
              message.type === 'info' && styles.alertInfo,
            ]}
          >
            <ThemedText style={styles.alertText}>{message.text}</ThemedText>
          </View>
        ) : null}

        <View style={styles.grid}>
          {canManage ? (
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <View style={styles.panelHeadText}>
                  <ThemedText style={styles.panelTitle}>{editingId ? 'Edit item' : 'Create item'}</ThemedText>
                  <ThemedText style={styles.panelSubtitle}>
                    {isSuperAdminUser
                      ? 'Create a global item or target a specific community.'
                      : 'Create items for the communities you manage.'}
                  </ThemedText>
                </View>
                {editingId ? (
                  <Pressable style={styles.ghostButton} onPress={resetForm}>
                    <ThemedText style={styles.ghostButtonText}>Cancel edit</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.form}>
                <View style={styles.field}>
                  <ThemedText style={styles.label}>Item type</ThemedText>
                  {itemTypes.length === 1 ? (
                    <View style={styles.pill}>
                      <ThemedText style={styles.pillText}>{itemTypes[0].label}</ThemedText>
                    </View>
                  ) : (
                    <View>
                      <Pressable style={styles.selectButton} onPress={() => setTypeMenuOpen((prev) => !prev)}>
                        <ThemedText style={styles.selectText}>
                          {itemTypes.find((opt) => opt.value === form.type)?.label || 'Select'}
                        </ThemedText>
                        <MaterialCommunityIcons
                          name={typeMenuOpen ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={colors.subtext}
                        />
                      </Pressable>
                      {typeMenuOpen ? (
                        <View style={styles.selectMenu}>
                          {itemTypes.map((opt) => (
                            <Pressable
                              key={opt.value}
                              style={[
                                styles.selectItem,
                                form.type === opt.value && styles.selectItemActive,
                              ]}
                              onPress={() => {
                                setForm((prev) => ({ ...prev, type: opt.value }));
                                setTypeMenuOpen(false);
                              }}
                            >
                              <ThemedText
                                style={[
                                  styles.selectItemText,
                                  form.type === opt.value && styles.selectItemTextActive,
                                ]}
                              >
                                {opt.label}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>

                <View style={styles.field}>
                  <ThemedText style={styles.label}>Title</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={form.title}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
                    placeholder="Add a concise title"
                    placeholderTextColor={colors.subtext}
                  />
                </View>

                <View style={styles.field}>
                  <ThemedText style={styles.label}>{dateLabel}</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={form.date}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, date: value }))}
                    placeholder="YYYY-MM-DD HH:MM"
                    placeholderTextColor={colors.subtext}
                  />
                </View>

                <View style={styles.field}>
                  <ThemedText style={styles.label}>Location</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={form.location}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, location: value }))}
                    placeholder="Building, room, or virtual link"
                    placeholderTextColor={colors.subtext}
                  />
                </View>

                {isEventType && canUseZoom ? (
                  <View style={[styles.field, styles.zoomBox]}>
                    <ThemedText style={styles.zoomTitle}>Zoom meeting</ThemedText>
                    {zoomStatus.loading ? (
                      <ThemedText style={styles.mutedText}>Checking Zoom connection...</ThemedText>
                    ) : zoomStatus.connected ? (
                      <>
                        <Pressable
                          style={styles.toggle}
                          onPress={() =>
                            setForm((prev) => ({
                              ...prev,
                              useZoom: !prev.useZoom,
                            }))
                          }
                        >
                          <View style={[styles.toggleBox, form.useZoom && styles.toggleBoxActive]}>
                            {form.useZoom ? (
                              <MaterialCommunityIcons name="check" size={12} color="#fff" />
                            ) : null}
                          </View>
                          <ThemedText style={styles.toggleLabel}>Host this event on Zoom</ThemedText>
                        </Pressable>
                        <ThemedText style={styles.mutedText}>
                          Connected as {zoomStatus.email || 'your Zoom account'}.
                        </ThemedText>
                      </>
                    ) : (
                      <ThemedText style={styles.mutedText}>
                        Connect Zoom in Account Settings to generate a meeting link.
                      </ThemedText>
                    )}
                    {zoomStatus.error ? (
                      <ThemedText style={[styles.mutedText, styles.errorText]}>
                        {zoomStatus.error}
                      </ThemedText>
                    ) : null}
                    {form.useZoom && zoomStatus.connected ? (
                      <View style={styles.field}>
                        <ThemedText style={styles.label}>Meeting duration (minutes)</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={String(form.zoomDuration ?? 60)}
                          onChangeText={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              zoomDuration: Number(value || 0),
                            }))
                          }
                          keyboardType="numeric"
                          placeholder="60"
                          placeholderTextColor={colors.subtext}
                        />
                        <ThemedText style={styles.mutedText}>
                          A Zoom meeting link will be created when you save.
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.field}>
                  <ThemedText style={styles.label}>Description</ThemedText>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={form.description}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
                    placeholder="What should attendees know?"
                    placeholderTextColor={colors.subtext}
                    multiline
                  />
                </View>

                {isPoll ? (
                  <View style={styles.field}>
                    <ThemedText style={styles.label}>Poll options</ThemedText>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={form.pollOptions}
                      onChangeText={(value) => setForm((prev) => ({ ...prev, pollOptions: value }))}
                      placeholder="Add one option per line"
                      placeholderTextColor={colors.subtext}
                      multiline
                    />
                    <ThemedText style={styles.mutedText}>Polls need at least two options.</ThemedText>
                    <Pressable
                      style={styles.checkboxRow}
                      onPress={() =>
                        setForm((prev) => ({ ...prev, showResults: !prev.showResults }))
                      }
                    >
                      <View
                        style={[
                          styles.toggleBox,
                          form.showResults && styles.toggleBoxActive,
                        ]}
                      >
                        {form.showResults ? (
                          <MaterialCommunityIcons name="check" size={12} color="#fff" />
                        ) : null}
                      </View>
                      <ThemedText style={styles.checkboxText}>
                        Display results after participants vote
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}

                <View style={styles.field}>
                  <ThemedText style={styles.label}>Audience</ThemedText>
                  {isSuperAdminUser ? (
                    <View style={styles.scopeRow}>
                      <Animated.View
                        style={[
                          styles.scopeIndicator,
                          {
                            width: 110,
                            transform: [
                              {
                                translateX: segAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 118],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      <Pressable
                        style={styles.scopeOption}
                        onPress={() => setForm((prev) => ({ ...prev, scope: 'global' }))}
                      >
                        <ThemedText
                          style={[
                            styles.scopeText,
                            form.scope === 'global' && styles.scopeTextActive,
                          ]}
                        >
                          Global
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={styles.scopeOption}
                        onPress={() => setForm((prev) => ({ ...prev, scope: 'community' }))}
                      >
                        <ThemedText
                          style={[
                            styles.scopeText,
                            form.scope === 'community' && styles.scopeTextActive,
                          ]}
                        >
                          Community
                        </ThemedText>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.pill}>
                      <ThemedText style={styles.pillText}>Community specific</ThemedText>
                    </View>
                  )}
                </View>

                {(form.scope === 'community' || !isSuperAdminUser) ? (
                  <View style={styles.field}>
                    <ThemedText style={styles.label}>Community</ThemedText>
                    <Pressable
                      style={styles.selectButton}
                      onPress={() => setCommunityMenuOpen((prev) => !prev)}
                      disabled={loadingCommunities || permittedCommunities.length === 0}
                    >
                      <ThemedText style={styles.selectText}>
                        {form.communityName ||
                          permittedCommunities.find((c) => c.id === form.communityId)?.name ||
                          'Select a community'}
                      </ThemedText>
                      <MaterialCommunityIcons
                        name={communityMenuOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.subtext}
                      />
                    </Pressable>
                    {communityMenuOpen ? (
                      <>
                        <TextInput
                          style={styles.input}
                          value={communitySearch}
                          onChangeText={setCommunitySearch}
                          placeholder="Search communities..."
                          placeholderTextColor={colors.subtext}
                          editable={!loadingCommunities && permittedCommunities.length > 0}
                        />
                        <View style={styles.communityList}>
                          {loadingCommunities ? (
                            <ThemedText style={styles.mutedText}>Loading communities...</ThemedText>
                          ) : communitySearch.trim().length === 0 ? (
                            <ThemedText style={styles.mutedText}>
                              Type to search communities.
                            </ThemedText>
                          ) : filteredCommunities.length === 0 ? (
                            <ThemedText style={styles.mutedText}>No matching communities</ThemedText>
                          ) : (
                            filteredCommunities.slice(0, 5).map((community) => (
                              <Pressable
                                key={community.id}
                                style={[
                                  styles.communityOption,
                                  form.communityId === community.id && styles.communityOptionActive,
                                ]}
                                onPress={() => {
                                  setForm((prev) => ({
                                    ...prev,
                                    communityId: community.id,
                                    communityName: community.name,
                                  }));
                                  setCommunityMenuOpen(false);
                                }}
                              >
                                <ThemedText
                                  style={[
                                    styles.communityOptionText,
                                    form.communityId === community.id && styles.communityOptionTextActive,
                                  ]}
                                >
                                  {community.name}
                                </ThemedText>
                                {community.tagline ? (
                                  <ThemedText style={styles.communityOptionMeta}>
                                    {community.tagline}
                                  </ThemedText>
                                ) : null}
                              </Pressable>
                            ))
                          )}
                        </View>
                      </>
                    ) : null}
                    <ThemedText style={styles.mutedText}>
                      {isSuperAdminUser
                        ? 'Search any community to target your item, or keep audience as Global.'
                        : 'Admins can only post to communities they manage.'}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.actionsRow}>
                  <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={isZoomSaving}>
                    <ThemedText style={styles.primaryButtonText}>
                      {isZoomSaving ? 'Creating Zoom meeting...' : editingId ? 'Save changes' : 'Create item'}
                    </ThemedText>
                  </Pressable>
                  <Pressable style={styles.ghostButton} onPress={resetForm}>
                    <ThemedText style={styles.ghostButtonText}>Clear</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <View style={styles.panelHeadText}>
                <ThemedText style={styles.panelTitle}>Active items</ThemedText>
                <ThemedText style={styles.panelSubtitle}>
                  {filteredItems.length
                    ? canManage
                      ? 'Edit or remove upcoming items.'
                      : loadingFollowed || loadingAnnouncements
                      ? 'Loading items from your communities...'
                      : 'Showing items from communities you follow.'
                    : canManage
                    ? loadingAnnouncements
                      ? 'Loading announcements...'
                      : 'No items yet. Create one to get started.'
                    : loadingFollowed || loadingAnnouncements
                    ? 'Loading items from your communities...'
                    : 'No items from communities you follow yet.'}
                </ThemedText>
              </View>
            </View>
            <View style={styles.list}>
              {filteredItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyText}>
                    {canManage
                      ? loadingAnnouncements
                        ? 'Loading announcements...'
                        : 'No items to manage yet.'
                      : loadingFollowed || loadingAnnouncements
                      ? 'Loading items from your communities...'
                      : 'Follow more communities or check back later for new items.'}
                  </ThemedText>
                </View>
              ) : null}

              {filteredItems.map((item) => {
                const itemType = item.type || 'event';
                const pollOptions = Array.isArray(item.pollOptions) ? item.pollOptions : [];
                const typePillStyle =
                  itemType === 'announcement'
                    ? styles.eventPill_announcement
                    : itemType === 'poll'
                    ? styles.eventPill_poll
                    : styles.eventPill_event;
                return (
                  <View key={item.id} style={styles.eventCard}>
                    <View style={styles.eventMetaRow}>
                      <View style={styles.pillRow}>
                        <View style={[styles.eventPill, typePillStyle]}>
                          <ThemedText style={styles.eventPillText}>{getTypeLabel(itemType)}</ThemedText>
                        </View>
                        <View style={[styles.eventPill, item.scope === 'global' ? styles.eventPillGlobal : styles.eventPillCommunity]}>
                          <ThemedText style={styles.eventPillText}>
                            {item.scope === 'global' ? 'Global' : 'Community'}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={styles.eventDate}>
                        {item.date ? `${getDatePrefix(itemType)} ${formatDateTime(item.date)}` : 'Date TBD'}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.eventTitle}>{item.title}</ThemedText>
                    <ThemedText style={styles.eventDescription}>
                      {item.description || 'No description provided.'}
                    </ThemedText>
                    {itemType === 'poll' && pollOptions.length > 0 ? (
                      <View style={styles.pollOptions}>
                        {pollOptions.map((opt, idx) => (
                          <ThemedText key={`${item.id}-opt-${idx}`} style={styles.pollOptionText}>
                            • {opt}
                          </ThemedText>
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.eventFooter}>
                      <View style={styles.eventFooterMeta}>
                        <ThemedText style={styles.eventAudience}>{audienceLabel(item)}</ThemedText>
                        {item.location ? (
                          <ThemedText style={styles.eventLocation}>{item.location}</ThemedText>
                        ) : null}
                        {item.zoomJoinUrl ? (
                          <ThemedText style={styles.eventLocation}>Join Zoom: {item.zoomJoinUrl}</ThemedText>
                        ) : null}
                        {item.zoomStartUrl && canManageEvent(item) ? (
                          <ThemedText style={styles.eventLocation}>Start Zoom: {item.zoomStartUrl}</ThemedText>
                        ) : null}
                      </View>
                      {canManage && !item.isRemote ? (
                        <View style={styles.eventActions}>
                          <Pressable style={styles.ghostButtonSmall} onPress={() => startEdit(item)}>
                            <ThemedText style={styles.ghostButtonText}>Edit</ThemedText>
                          </Pressable>
                          <Pressable style={styles.dangerButton} onPress={() => handleDelete(item.id)}>
                            <ThemedText style={styles.dangerButtonText}>Delete</ThemedText>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {loadingEvents ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primaryFrom} />
            <ThemedText style={styles.mutedText}>Syncing event data...</ThemedText>
          </View>
        ) : null}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  pageTitle: {
    fontWeight: '700',
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.subtext,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  alert: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.card,
  },
  alertText: {
    fontSize: 12,
  },
  alertSuccess: {
    borderColor: hexToRgba('#22c55e', 0.45),
    backgroundColor: hexToRgba('#22c55e', 0.12),
  },
  alertError: {
    borderColor: hexToRgba(colors.danger, 0.4),
    backgroundColor: hexToRgba(colors.danger, 0.12),
  },
  alertInfo: {
    borderColor: hexToRgba(colors.primaryFrom, 0.35),
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
  },
  grid: {
    gap: 18,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.card,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  panelHeadText: {
    flex: 1,
    gap: 4,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  panelSubtitle: {
    fontSize: 12,
    color: colors.subtext,
  },
  form: {
    gap: 14,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 13,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  mutedText: {
    fontSize: 11,
    color: colors.subtext,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  selectText: {
    fontSize: 13,
    color: colors.text,
  },
  selectMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  selectItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectItemActive: {
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
  },
  selectItemText: {
    fontSize: 13,
    color: colors.text,
  },
  selectItemTextActive: {
    fontWeight: '700',
    color: colors.primaryFrom,
  },
  zoomBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: hexToRgba(colors.card, 0.6),
  },
  zoomTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: hexToRgba(colors.text, 0.05),
    alignSelf: 'flex-start',
  },
  toggleBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  toggleBoxActive: {
    backgroundColor: colors.primaryFrom,
    borderColor: colors.primaryFrom,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxText: {
    fontSize: 12,
    color: colors.text,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.text, 0.08),
    padding: 3,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  scopeIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 999,
    backgroundColor: colors.primaryFrom,
  },
  scopeOption: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  scopeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  scopeTextActive: {
    color: '#fff',
  },
  communityList: {
    gap: 8,
    marginTop: 8,
  },
  communityOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 4,
    backgroundColor: colors.card,
  },
  communityOptionActive: {
    borderColor: colors.primaryFrom,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
  },
  communityOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  communityOptionTextActive: {
    color: colors.primaryFrom,
  },
  communityOptionMeta: {
    fontSize: 11,
    color: colors.subtext,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primaryFrom,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  ghostButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostButtonSmall: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  dangerButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: hexToRgba(colors.danger, 0.12),
    borderWidth: 1,
    borderColor: hexToRgba(colors.danger, 0.4),
  },
  dangerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  list: {
    gap: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: hexToRgba(colors.card, 0.6),
  },
  emptyState: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 16,
  },
  emptyText: {
    fontSize: 12,
    color: colors.subtext,
  },
  eventCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.card,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
    gap: 6,
  },
  eventMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  eventPillGlobal: {
    backgroundColor: hexToRgba(colors.primaryFrom, 0.12),
  },
  eventPillCommunity: {
    backgroundColor: hexToRgba('#22c55e', 0.12),
  },
  eventPill_event: {
    backgroundColor: hexToRgba('#6366f1', 0.12),
  },
  eventPill_announcement: {
    backgroundColor: hexToRgba('#f59e0b', 0.14),
  },
  eventPill_poll: {
    backgroundColor: hexToRgba('#38bdf8', 0.14),
  },
  eventDate: {
    fontSize: 11,
    color: colors.subtext,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  eventDescription: {
    fontSize: 12,
    color: colors.subtext,
  },
  pollOptions: {
    gap: 4,
  },
  pollOptionText: {
    fontSize: 12,
    color: colors.text,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  eventFooterMeta: {
    flex: 1,
    gap: 4,
  },
  eventAudience: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  eventLocation: {
    fontSize: 11,
    color: colors.subtext,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
