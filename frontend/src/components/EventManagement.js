import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { isAdmin, isSuperAdmin } from '../constants/roles';
import ModalOverlay from './ModalOverlay';

function EventManagement({ userData }) {
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get('type');
  const roleId = userData?.role_id;
  const isSuperAdminUser = isSuperAdmin(roleId);
  const isAmbassador = Number(userData?.is_ambassador) === 1;
  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(userData?.admin_community_ids)) return [];
    return userData.admin_community_ids.map((id) => String(id));
  }, [userData]);
  const [ambassadorCommunities, setAmbassadorCommunities] = useState([]);
  const ambassadorCommunityIds = useMemo(
    () =>
      ambassadorCommunities
        .map((c) => String(c.community_id ?? c.id ?? ''))
        .filter(Boolean),
    [ambassadorCommunities]
  );
  const isAdminRole = isAdmin(roleId);
  const isCommunityAdmin = adminCommunityIds.length > 0;
  const canManage = isSuperAdminUser || isAdminRole || isCommunityAdmin || ambassadorCommunityIds.length > 0;
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

  const [loadingCommunities, setLoadingCommunities] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [allCommunities, setAllCommunities] = useState([]);
  const [followedCommunities, setFollowedCommunities] = useState([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [remoteAnnouncements, setRemoteAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [message, setMessage] = useState(null);
  const [zoomStatus, setZoomStatus] = useState({
    loading: false,
    connected: false,
    email: '',
    error: '',
  });
  const [isZoomSaving, setIsZoomSaving] = useState(false);
  const [events, setEvents] = useState(() => {
    try {
      const stored = localStorage.getItem('managedEvents');
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Unable to read events from storage', err);
      return [];
    }
  });
  const [editingId, setEditingId] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [eventView, setEventView] = useState('tiles');
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [searchingInvites, setSearchingInvites] = useState(false);
  const primaryCommunityId = adminCommunityIds[0] || ambassadorCommunityIds[0] || '';
  const initialForm = {
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
    allowedAudiences: ['public', 'members', 'verified', 'ambassadors', 'admins'],
    invitedUsers: [],
    notifyRsvpsDateChange: false,
  };

  const [form, setForm] = useState(initialForm);

  const postWithFallback = async (primaryUrl, fallbackUrl, payload) => {
    try {
      return await axios.post(primaryUrl, payload, { withCredentials: true });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404 && fallbackUrl) {
        return await axios.post(fallbackUrl, payload, { withCredentials: true });
      }
      throw err;
    }
  };

  useEffect(() => {
    const term = inviteSearch.trim();
    if (term.length < 2 || !showEditor) {
      setInviteResults([]);
      setSearchingInvites(false);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchingInvites(true);
      try {
        const res = await axios.get(`/api/search_users.php?term=${encodeURIComponent(term)}`, {
          withCredentials: true,
        });
        if (!cancelled) {
          const selectedIds = new Set(form.invitedUsers.map((user) => String(user.user_id)));
          const users = Array.isArray(res.data?.users) ? res.data.users : [];
          setInviteResults(
            users.filter(
              (user) =>
                String(user.user_id) !== String(userData?.user_id || '')
                && !selectedIds.has(String(user.user_id))
            )
          );
        }
      } catch (error) {
        if (!cancelled) setInviteResults([]);
      } finally {
        if (!cancelled) setSearchingInvites(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inviteSearch, showEditor, form.invitedUsers, userData?.user_id]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      scope: isSuperAdminUser ? prev.scope : 'community',
      communityId: primaryCommunityId,
    }));
  }, [isSuperAdminUser, primaryCommunityId]);

  useEffect(() => {
    let isCancelled = false;
    const loadCommunities = async () => {
      setLoadingCommunities(true);
      try {
        const res = await axios.get('/api/fetch_communities.php');
        const payload = Array.isArray(res.data) ? res.data : [];
        const normalized = payload.map((c) => ({
          id: String(c.id ?? c.community_id ?? ''),
          name: c.name || 'Unnamed community',
          tagline: c.tagline || '',
          parentCommunityId: c.parent_community_id ? String(c.parent_community_id) : '',
        })).filter((c) => c.id);
        if (!isCancelled) {
          setAllCommunities(normalized);
        }
      } catch (error) {
        console.error('Unable to load communities', error);
      } finally {
        if (!isCancelled) {
          setLoadingCommunities(false);
        }
      }
    };

    loadCommunities();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const loadAmbassadorCommunities = async () => {
      if (!isAmbassador || !userData?.user_id) {
        setAmbassadorCommunities([]);
        return;
      }
      try {
        const res = await axios.get(`/api/fetch_ambassador_communities.php?user_id=${userData.user_id}`);
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.communities)
            ? res.data.communities
            : [];
        const normalized = list
          .map((c) => ({
            community_id: String(c.community_id ?? c.id ?? ''),
            name: c.name || 'Unnamed community',
          }))
          .filter((c) => c.community_id);
        if (!isCancelled) {
          setAmbassadorCommunities(normalized);
        }
      } catch (error) {
        console.error('Unable to load ambassador communities', error);
        if (!isCancelled) setAmbassadorCommunities([]);
      }
    };
    loadAmbassadorCommunities();
    return () => {
      isCancelled = true;
    };
  }, [isAmbassador, userData?.user_id]);

  useEffect(() => {
    let isCancelled = false;
    const loadFollowed = async () => {
      if (!userData?.user_id) return;
      setLoadingFollowed(true);
      try {
        const res = await axios.get(`/api/followed_communities.php?user_id=${userData.user_id}`);
        if (!isCancelled) {
          const list = Array.isArray(res.data) ? res.data : [];
          const normalized = list.map((c) => String(c.community_id ?? c.id ?? '')).filter(Boolean);
          setFollowedCommunities(normalized);
        }
      } catch (error) {
        console.error('Unable to load followed communities', error);
        if (!isCancelled) setFollowedCommunities([]);
      } finally {
        if (!isCancelled) setLoadingFollowed(false);
      }
    };
    loadFollowed();
    return () => {
      isCancelled = true;
    };
  }, [userData?.user_id]);

  useEffect(() => {
    let isCancelled = false;
    const loadZoomStatus = async () => {
      if (!canUseZoom) return;
      setZoomStatus((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const res = await axios.get('/api/zoom_status.php', { withCredentials: true });
        if (!isCancelled) {
          if (res.data?.success) {
            setZoomStatus({
              loading: false,
              connected: Boolean(res.data.connected),
              email: res.data.zoom_email || '',
              error: '',
            });
          } else {
            setZoomStatus((prev) => ({
              ...prev,
              loading: false,
              connected: false,
              error: res.data?.error || 'Unable to load Zoom status.',
            }));
          }
        }
      } catch (error) {
        console.error('Unable to load Zoom status', error);
        if (!isCancelled) {
          setZoomStatus((prev) => ({
            ...prev,
            loading: false,
            connected: false,
            error: 'Unable to load Zoom status.',
          }));
        }
      }
    };
    loadZoomStatus();
    return () => {
      isCancelled = true;
    };
  }, [canUseZoom, userData?.user_id]);

  useEffect(() => {
    let isCancelled = false;
    const loadAnnouncements = async () => {
      setLoadingAnnouncements(true);
      try {
        const res = await axios.get('/api/fetch_global_announcements.php');
        if (!isCancelled) {
          const list = Array.isArray(res.data?.announcements) ? res.data.announcements : [];
          const normalized = list
            .map((a) => ({
              id: String(a.announcement_id || a.id || ''),
              title: (a.title || '').trim(),
              body: (a.body || '').trim(),
              starts_at: a.starts_at || '',
              created_at: a.created_at || '',
            }))
            .filter((a) => a.id);
          setRemoteAnnouncements(normalized);
        }
      } catch (error) {
        if (!isCancelled) setRemoteAnnouncements([]);
      } finally {
        if (!isCancelled) setLoadingAnnouncements(false);
      }
    };
    loadAnnouncements();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('managedEvents', JSON.stringify(events));
      window.dispatchEvent(new CustomEvent('managedEventsUpdated', { detail: { key: 'managedEvents' } }));
    } catch (err) {
      console.error('Unable to persist events', err);
    }
  }, [events]);

  const canManageEvent = (event) => {
    if (isSuperAdminUser || isAdminRole) return true;
    if (event.scope !== 'community') return false;
    const allowedIds = new Set([...adminCommunityIds, ...ambassadorCommunityIds]);
    return allowedIds.has(String(event.communityId || ''));
  };

  const manageableEvents = useMemo(
    () => events.filter((evt) => canManageEvent(evt)),
    [events, isSuperAdminUser, isCommunityAdmin, adminCommunityIds, canManageEvent]
  );

  const handleFieldChange = (key) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleZoomToggle = (e) => {
    const checked = e.target.checked;
    setForm((prev) => ({
      ...prev,
      useZoom: checked,
      ...(checked
        ? {}
        : {
            zoomMeetingId: '',
            zoomJoinUrl: '',
            zoomStartUrl: '',
            zoomHostEmail: '',
          }),
    }));
  };

  const handleCommunitySelect = (e) => {
    const newId = e.target.value;
    const option = permittedCommunities.find((c) => String(c.id) === String(newId));
    setForm((prev) => ({
      ...prev,
      communityId: newId,
      communityName: option?.name || prev.communityName,
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setCommunitySearch('');
    setInviteSearch('');
    setInviteResults([]);
    setForm({
      ...initialForm,
      scope: isSuperAdminUser ? 'global' : 'community',
      communityId: primaryCommunityId,
    });
    setShowEditor(false);
  };

  const openCreateEvent = () => {
    resetForm();
    setForm((prev) => ({ ...prev, type: 'event' }));
    setShowEditor(true);
  };

  const formatDateTime = (value) => {
    if (!value) return 'Date TBD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  };

  const getAudienceLabel = (event) => {
    if (event.scope === 'global') return 'Global';
    const community = event.communityName || `Community ${event.communityId}`;
    return event.subCommunityName
      ? `${community} · Sub-community: ${event.subCommunityName}`
      : community;
  };

  const permittedCommunities = useMemo(() => {
    if (isAdminRole) return allCommunities;
    const allowed = new Set([...adminCommunityIds, ...ambassadorCommunityIds]);
    return allCommunities.filter((c) => allowed.has(String(c.id)));
  }, [allCommunities, adminCommunityIds, ambassadorCommunityIds, isAdminRole]);

  const filteredCommunities = useMemo(() => {
    const term = communitySearch.trim().toLowerCase();
    if (!term) return permittedCommunities;
    return permittedCommunities.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.tagline.toLowerCase().includes(term)
    );
  }, [communitySearch, permittedCommunities]);

  const announcementItems = useMemo(
    () =>
      remoteAnnouncements.map((a) => ({
        id: a.id,
        type: 'announcement',
        title: a.title || 'Announcement',
        description: a.body || '',
        date: a.starts_at || '',
        location: '',
        scope: 'global',
        communityId: '',
        communityName: 'Global',
        pollOptions: [],
        showResults: false,
        createdBy: 'System',
        createdAt: a.created_at || a.starts_at || '',
        isRemote: true,
      })),
    [remoteAnnouncements]
  );

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

  const followsCommunity = (communityId) => {
    if (!communityId) return false;
    if (adminCommunityIds.includes(String(communityId))) return true;
    if (ambassadorCommunityIds.includes(String(communityId))) return true;
    return followedCommunities.includes(String(communityId));
  };

  const isVisibleToUser = (item) => {
    if (item.scope === 'global') return true;
    if (isSuperAdminUser || isAdminRole) return true;
    if (adminCommunityIds.includes(String(item.communityId || ''))) return true;
    if (ambassadorCommunityIds.includes(String(item.communityId || ''))) return true;
    return followsCommunity(item.communityId);
  };

  const visibleItems = useMemo(
    () => events.filter((evt) => isVisibleToUser(evt)),
    [events, isSuperAdminUser, adminCommunityIds, followedCommunities, isVisibleToUser]
  );

  const getTypeLabel = (type) => {
    switch (type) {
      case 'announcement':
        return 'Announcement';
      case 'poll':
        return 'Poll';
      default:
        return 'Event / Webinar';
    }
  };

  const getDatePrefix = (type) => {
    switch (type) {
      case 'announcement':
        return 'Publishes';
      case 'poll':
        return 'Closes';
      default:
        return 'Occurs';
    }
  };

  const toZoomTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString();
  };

  const startEdit = (event) => {
    setEditingId(event.id);
    setForm({
      type: event.type || 'event',
      title: event.title,
      description: event.description,
      date: event.date,
      location: event.location,
      scope: event.scope,
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
      allowedAudiences: Array.isArray(event.allowedAudiences) && event.allowedAudiences.length
        ? event.allowedAudiences
        : ['public', 'members', 'verified', 'ambassadors', 'admins'],
      invitedUsers: [],
      notifyRsvpsDateChange: false,
    });
    setMessage({ type: 'info', text: 'Editing an existing item.' });
    setShowEditor(true);
  };

  const handleDelete = async (eventId) => {
    const target = events.find((evt) => evt.id === eventId);
    if (target && !canManageEvent(target)) {
      setMessage({ type: 'error', text: 'You do not have permission to delete this item.' });
      return;
    }
    if (target?.type === 'event') {
      try {
        const res = await postWithFallback('/api/delete_event.php', '/delete_event.php', { event_id: eventId });
        if (!res.data?.success && res.data?.error !== 'Event not found') {
          setMessage({ type: 'error', text: res.data?.error || 'Unable to delete event.' });
          return;
        }
      } catch (err) {
        console.error('Error deleting event', err);
        setMessage({ type: 'error', text: 'Unable to delete event.' });
        return;
      }
    }
    setEvents((prev) => prev.filter((evt) => evt.id !== eventId));
    if (editingId === eventId) {
      resetForm();
    }
    setMessage({ type: 'success', text: 'Event deleted.' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) {
      setMessage({ type: 'error', text: 'You need admin or ambassador access to manage items.' });
      return;
    }

    const type = form.type || 'event';
    const scope = isSuperAdminUser ? form.scope : 'community';
    const title = form.title.trim();
    const description = form.description.trim();
    const location = form.location.trim();
    const date = form.date;
    let communityId = scope === 'community' ? String(form.communityId || '').trim() : '';
    let communityName = form.communityName.trim();
    let subCommunityId = '';
    let subCommunityName = '';

    if (!title) {
      setMessage({ type: 'error', text: 'Please add a title for this item.' });
      return;
    }
    if (!canPublishAllTypes && type !== 'event') {
      setMessage({ type: 'error', text: 'Ambassadors can only create events.' });
      return;
    }
    const requiresDate = type === 'event';
    if (requiresDate && !date) {
      setMessage({ type: 'error', text: 'Please add a date and time for the event/webinar.' });
      return;
    }

    let pollOptions = [];
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
        if (option.parentCommunityId) {
          const parent = allCommunities.find(
            (community) => String(community.id) === String(option.parentCommunityId)
          );
          communityName = parent?.name || `Community ${option.parentCommunityId}`;
          subCommunityId = option.id;
          subCommunityName = option.name;
        } else {
          communityName = option.name;
        }
      }
      communityName = communityName || `Community ${communityId}`;
    }

    const wantsZoomMeeting = type === 'event' && form.useZoom;
    let zoomMeetingId = form.zoomMeetingId || '';
    let zoomJoinUrl = form.zoomJoinUrl || '';
    let zoomStartUrl = form.zoomStartUrl || '';
    let zoomHostEmail = form.zoomHostEmail || zoomStatus.email || '';
    let zoomDuration = Number(form.zoomDuration) || 60;

    const eventTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (wantsZoomMeeting) {
      if (!zoomStatus.connected) {
        setMessage({ type: 'error', text: 'Connect Zoom in Account Settings before creating meetings.' });
        return;
      }
      setIsZoomSaving(true);
      try {
        const res = await axios.post(
          '/api/create_zoom_meeting.php',
          {
            topic: title,
            agenda: description,
            start_time: toZoomTimestamp(date),
            timezone: eventTimezone,
            duration: zoomDuration,
            meeting_id: zoomMeetingId || undefined,
          },
          { withCredentials: true }
        );
        if (res.data?.success && res.data?.meeting) {
          const meeting = res.data.meeting;
          zoomMeetingId = String(meeting.meeting_id || zoomMeetingId || '');
          zoomJoinUrl = meeting.join_url || zoomJoinUrl || '';
          zoomStartUrl = meeting.start_url || zoomStartUrl || '';
          zoomHostEmail = meeting.host_email || zoomHostEmail || '';
        } else {
          setMessage({ type: 'error', text: res.data?.error || 'Unable to create Zoom meeting.' });
          return;
        }
      } catch (err) {
        console.error('Error creating Zoom meeting:', err);
        setMessage({ type: 'error', text: 'Unable to create Zoom meeting.' });
        return;
      } finally {
        setIsZoomSaving(false);
      }
    } else {
      zoomMeetingId = '';
      zoomJoinUrl = '';
      zoomStartUrl = '';
      zoomHostEmail = '';
    }

    let eventId = editingId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    if (type === 'event' || type === 'poll') {
      if (!form.allowedAudiences.length) {
        setMessage({ type: 'error', text: `Select at least one access level for this ${type}.` });
        return;
      }
    }
    if (type === 'event') {
      try {
        const res = await postWithFallback(
          '/api/upsert_event.php',
          '/upsert_event.php',
          {
            event_id: editingId || undefined,
            title,
            description,
            start_at: toZoomTimestamp(date),
            timezone: eventTimezone,
            community_id: scope === 'community' ? communityId : '',
            location,
            meeting_provider: zoomJoinUrl ? 'zoom' : 'other',
            meeting_link: zoomJoinUrl || '',
            meeting_id: zoomMeetingId || '',
            duration_minutes: zoomDuration,
            allowed_audiences: form.allowedAudiences,
            invite_user_ids: form.invitedUsers.map((user) => user.user_id),
            notify_rsvps_date_change: Boolean(form.notifyRsvpsDateChange),
          }
        );
        if (!res.data?.success) {
          setMessage({ type: 'error', text: res.data?.error || 'Unable to save event.' });
          return;
        }
        eventId = res.data.event_id || eventId;
      } catch (err) {
        console.error('Error saving event', err);
        setMessage({ type: 'error', text: 'Unable to save event.' });
        return;
      }
    }

    const payload = {
      id: eventId,
      type,
      title,
      description,
      location,
      date,
      scope,
      communityId: scope === 'community' ? communityId : '',
      communityName: scope === 'community' ? communityName : '',
      subCommunityId: scope === 'community' ? subCommunityId : '',
      subCommunityName: scope === 'community' ? subCommunityName : '',
      pollOptions: type === 'poll' ? pollOptions : [],
      showResults: type === 'poll' ? Boolean(form.showResults) : false,
      zoomMeetingId,
      zoomJoinUrl,
      zoomStartUrl,
      zoomHostEmail,
      zoomDuration,
      allowedAudiences: type === 'announcement' ? [] : form.allowedAudiences,
      invitedUsers: type === 'event' ? form.invitedUsers : [],
      createdBy: `${userData?.first_name || 'Unknown'} ${userData?.last_name || ''}`.trim() || 'Unknown user',
      createdById: String(userData?.user_id || ''),
      createdAt: new Date().toISOString(),
    };

    if (type === 'announcement') {
      try {
        const res = await axios.post(
          '/api/create_announcement.php',
          {
            title,
            body: description,
            announcement_type: 'general',
            scope,
            community_id: scope === 'community' ? communityId : '',
            show_banner: true,
            is_dismissible: true,
            starts_at: date || null,
            ends_at: null
          },
          { withCredentials: true }
        );
        const announcementId = res?.data?.announcement_id || payload.id;
        const announcementItem = { ...payload, id: announcementId };
        setEvents((prev) =>
          editingId ? prev.map((evt) => (evt.id === editingId ? announcementItem : evt)) : [announcementItem, ...prev]
        );
        setMessage({ type: 'success', text: editingId ? 'Announcement updated.' : 'Announcement published.' });
      } catch (err) {
        console.error('Error creating announcement:', err);
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

  const isPoll = form.type === 'poll';
  const isEventType = form.type === 'event';
  const hasAudienceControls = form.type === 'event' || form.type === 'poll';
  const dateLabel = isPoll
    ? 'Poll closes at (optional)'
    : form.type === 'announcement'
      ? 'Publish time (optional)'
      : 'Date & time';

  const localItems = canManage ? manageableEvents : visibleItems;
  const itemsToShow = useMemo(() => {
    const existingIds = new Set(localItems.map((item) => item.id));
    const mergedAnnouncements = announcementItems.filter((item) => !existingIds.has(item.id));
    return [...mergedAnnouncements, ...localItems];
  }, [announcementItems, localItems]);
  const filteredItems = useMemo(() => {
    if (!filterType) return itemsToShow;
    if (filterType === 'poll') return itemsToShow.filter((item) => item.type === 'poll');
    if (filterType === 'announcement') return itemsToShow.filter((item) => item.type === 'announcement');
    if (filterType === 'event') {
      return itemsToShow.filter((item) => item.type === 'event' || !item.type);
    }
    return itemsToShow;
  }, [filterType, itemsToShow]);

  const eventPageItems = useMemo(
    () =>
      canManage
        ? filteredItems
        : filteredItems.filter((item) => (item.type || 'event') === 'event'),
    [canManage, filteredItems]
  );

  const calendarItems = useMemo(() => {
    if (eventView === 'tiles') return eventPageItems;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return eventPageItems
      .filter((item) => item.date)
      .filter((item) => {
        const date = new Date(item.date);
        if (Number.isNaN(date.getTime())) return false;
        if (eventView === 'week') return date >= startOfWeek && date < endOfWeek;
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [eventView, eventPageItems]);

  const calendarGroups = useMemo(
    () =>
      calendarItems.reduce((groups, item) => {
        const date = new Date(item.date);
        const key = date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
        return groups;
      }, {}),
    [calendarItems]
  );

  return (
    <div className="feed-container">
      <div className="event-management">
        <div className="reported-items__header event-management__header">
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              {canManage ? 'Event Management' : 'Events'}
            </h2>
            <p className="report-subtitle muted-text">
              {canManage
                ? isSuperAdminUser
                  ? 'Super admins can publish announcements, polls, and events for any community or globally.'
                  : isAmbassador && !isCommunityAdmin
                    ? 'Ambassadors can schedule announcements, polls, and events for the communities they represent.'
                    : 'Admins and ambassadors can manage announcements, polls, and events for the communities they oversee.'
                : 'Viewing items from communities you follow. Global items appear for everyone.'}
            </p>
            {canManage && (
              <div className="event-management__badge">
                {isSuperAdminUser
                  ? 'Super admin'
                  : isCommunityAdmin
                    ? 'Community admin'
                    : isAdminRole
                      ? 'Admin'
                      : 'Ambassador'}
              </div>
            )}
          </div>
          <div className="event-management__header-actions">
            {canManage && (
              <button type="button" className="primary-button" onClick={openCreateEvent}>
                Create Event
              </button>
            )}
            {!canManage && <div className="event-management__badge">Member</div>}
          </div>
        </div>

      {message && (
        <div className={`event-management__alert ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="event-management__grid report-grid">
        {canManage && showEditor && (
          <ModalOverlay isOpen={showEditor} onClose={resetForm} contentClassName="event-editor-overlay">
          <section className="event-management__panel event-management__panel--composer event-editor-dialog">
            <div className="event-management__panel-head">
              <div>
                <h3>{editingId ? 'Edit item' : 'Create event'}</h3>
                <p className="muted-text">
                  {isSuperAdminUser
                    ? 'Create a global item or target a specific community.'
                    : 'Create items for the communities you manage.'}
                </p>
              </div>
              {editingId && (
                <button type="button" className="ghost-button" onClick={resetForm}>
                  Cancel edit
                </button>
              )}
            </div>
            {message && (
              <div className={`event-management__alert ${message.type}`} role="status">
                {message.text}
              </div>
            )}
            <form className="event-management__form" onSubmit={handleSubmit}>
              <div className="event-management__field">
                <label htmlFor="item-type">Item type</label>
                <select
                  id="item-type"
                  value={form.type}
                  onChange={handleFieldChange('type')}
                >
                  {itemTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="event-management__field">
                <label htmlFor="event-title">Title</label>
                <input
                  id="event-title"
                  type="text"
                  value={form.title}
                  onChange={handleFieldChange('title')}
                  placeholder="Add a concise title"
                  required
                />
              </div>
              <div className="event-management__field">
                <label htmlFor="event-date">{dateLabel}</label>
                <input
                  id="event-date"
                  type="datetime-local"
                  value={form.date}
                  onChange={handleFieldChange('date')}
                  required={isEventType}
                />
              </div>
              <div className="event-management__field">
                <label htmlFor="event-location">Location</label>
                <input
                  id="event-location"
                  type="text"
                  value={form.location}
                  onChange={handleFieldChange('location')}
                  placeholder="Building, room, or virtual link"
                />
              </div>
              {isEventType && canUseZoom && (
                <>
                  <div className="event-management__field event-management__field--wide event-management__zoom">
                    <label className="event-management__zoom-title">Zoom meeting</label>
                    {zoomStatus.loading ? (
                      <p className="muted-text small-text">Checking Zoom connection...</p>
                    ) : zoomStatus.connected ? (
                      <>
                        <label className="event-management__toggle">
                          <input
                            type="checkbox"
                            className="event-management__toggle-input"
                            checked={form.useZoom}
                            onChange={handleZoomToggle}
                            disabled={!zoomStatus.connected && !form.useZoom}
                          />
                          <span className="event-management__toggle-label">Host this event on Zoom</span>
                        </label>
                        <p className="muted-text small-text event-management__zoom-meta">
                          Connected as {zoomStatus.email || 'your Zoom account'}.
                        </p>
                      </>
                    ) : (
                      <p className="muted-text small-text">
                        Connect Zoom in <a href="/settings?tab=integrations">Account Settings</a> to generate a meeting link.
                      </p>
                    )}
                    {zoomStatus.error && (
                      <p className="muted-text small-text" style={{ color: '#b91c1c' }}>
                        {zoomStatus.error}
                      </p>
                    )}
                  </div>
                  {form.useZoom && zoomStatus.connected && (
                    <div className="event-management__field event-management__field--wide">
                      <label htmlFor="zoom-duration">Meeting duration (minutes)</label>
                      <input
                        id="zoom-duration"
                        type="number"
                        min="15"
                        value={form.zoomDuration}
                        onChange={(e) => setForm((prev) => ({ ...prev, zoomDuration: e.target.value }))}
                        placeholder="60"
                      />
                      <p className="muted-text small-text">A Zoom meeting link will be created when you save.</p>
                    </div>
                  )}
                  {form.useZoom && (form.zoomJoinUrl || form.zoomStartUrl) && (
                    <div className="event-management__field event-management__field--wide">
                      <label>Current Zoom links</label>
                      <div className="muted-text small-text" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {form.zoomJoinUrl && (
                          <a href={form.zoomJoinUrl} target="_blank" rel="noreferrer">
                            Join link
                          </a>
                        )}
                        {form.zoomStartUrl && (
                          <a href={form.zoomStartUrl} target="_blank" rel="noreferrer">
                            Host link
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="event-management__field event-management__field--wide">
                <label htmlFor="event-description">Description</label>
                <textarea
                  id="event-description"
                  rows={4}
                  value={form.description}
                  onChange={handleFieldChange('description')}
                  placeholder="What should attendees know?"
                />
              </div>
            {isPoll && (
              <div className="event-management__field event-management__field--wide">
                <label htmlFor="poll-options">Poll options</label>
                <textarea
                  id="poll-options"
                    rows={3}
                    value={form.pollOptions}
                    onChange={handleFieldChange('pollOptions')}
                    placeholder="Add one option per line"
                    required
                />
                <p className="muted-text small-text">Polls need at least two options.</p>
                <label className="small-text" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    checked={form.showResults}
                    onChange={(e) => setForm((prev) => ({ ...prev, showResults: e.target.checked }))}
                  />
                  Display results after participants vote
                </label>
              </div>
            )}
              <div className="event-management__field">
                <label>Audience</label>
                {isSuperAdminUser ? (
                  <select
                    value={form.scope}
                    onChange={handleFieldChange('scope')}
                  >
                    <option value="global">Global</option>
                    <option value="community">Community specific</option>
                  </select>
                ) : (
                  <div className="event-management__pill">Community specific</div>
                )}
              </div>
              {(form.scope === 'community' || !isSuperAdminUser) && (
                <div className="event-management__field event-management__field--wide">
                  <label htmlFor="event-community">Community</label>
                  <input
                    type="text"
                    value={communitySearch}
                    onChange={(e) => setCommunitySearch(e.target.value)}
                    placeholder="Search communities..."
                    className="event-management__search"
                    disabled={loadingCommunities || permittedCommunities.length === 0}
                  />
                  <select
                    id="event-community"
                    value={form.communityId}
                    onChange={handleCommunitySelect}
                    disabled={loadingCommunities || permittedCommunities.length === 0}
                  >
                    {loadingCommunities && <option>Loading communities...</option>}
                    {!loadingCommunities && filteredCommunities.length === 0 && (
                      <option value="">No matching communities</option>
                    )}
                    {!loadingCommunities &&
                      filteredCommunities.map((community) => (
                        <option key={community.id} value={community.id}>
                          {community.name}
                        </option>
                      ))}
                  </select>
                  <p className="muted-text small-text">
                    {isSuperAdminUser
                      ? 'Search any community to target your item, or keep audience as Global.'
                      : 'Admins can only post to communities they manage.'}
                  </p>
                </div>
              )}
              {hasAudienceControls && (
                <div className="event-management__field event-management__field--wide event-access-field">
                  <label>{form.type === 'poll' ? 'Poll' : 'Event'} access</label>
                  <p className="muted-text small-text">
                    Only selected access levels can discover this {form.type === 'poll' ? 'poll' : 'event'}.
                  </p>
                  <div className="event-access-options">
                    {[
                      ['public', 'All platform members'],
                      ['members', 'Community members'],
                      ['verified', 'Verified community members'],
                      ['ambassadors', 'Ambassadors'],
                      ['admins', 'Administrators'],
                    ].map(([value, label]) => (
                      <label key={value} className="event-access-option">
                        <input
                          type="checkbox"
                          checked={form.allowedAudiences.includes(value)}
                          onChange={(event) => {
                            setForm((prev) => ({
                              ...prev,
                              allowedAudiences: event.target.checked
                                ? [...prev.allowedAudiences, value]
                                : prev.allowedAudiences.filter((audience) => audience !== value),
                            }));
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {isEventType && (
                <div className="event-management__field event-management__field--wide event-invite-field">
                  <label htmlFor="event-invite-search">Invite people</label>
                  <input
                    id="event-invite-search"
                    type="search"
                    value={inviteSearch}
                    onChange={(event) => setInviteSearch(event.target.value)}
                    placeholder="Search by name or email"
                  />
                  {form.invitedUsers.length > 0 && (
                    <div className="event-invite-selected">
                      {form.invitedUsers.map((user) => (
                        <button
                          key={user.user_id}
                          type="button"
                          onClick={() => setForm((prev) => ({
                            ...prev,
                            invitedUsers: prev.invitedUsers.filter(
                              (selected) => String(selected.user_id) !== String(user.user_id)
                            ),
                          }))}
                          aria-label={`Remove ${user.first_name} ${user.last_name}`}
                        >
                          {user.first_name} {user.last_name} <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {inviteSearch.trim().length >= 2 && (
                    <div className="event-invite-results">
                      {searchingInvites && <span className="muted-text small-text">Searching…</span>}
                      {!searchingInvites && inviteResults.map((user) => (
                        <button
                          key={user.user_id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              invitedUsers: [...prev.invitedUsers, user],
                            }));
                            setInviteSearch('');
                          }}
                        >
                          <span>{user.first_name} {user.last_name}</span>
                          <small>{user.email}</small>
                        </button>
                      ))}
                      {!searchingInvites && inviteResults.length === 0 && (
                        <span className="muted-text small-text">No matching people.</span>
                      )}
                    </div>
                  )}
                  <p className="muted-text small-text">
                    Invited people receive a platform notification and can access the event regardless of level.
                  </p>
                </div>
              )}
              {isEventType && editingId && (
                <div className="event-management__field event-management__field--wide">
                  <label className="event-management__toggle">
                    <input
                      type="checkbox"
                      className="event-management__toggle-input"
                      checked={form.notifyRsvpsDateChange}
                      onChange={(event) => setForm((prev) => ({
                        ...prev,
                        notifyRsvpsDateChange: event.target.checked,
                      }))}
                    />
                    <span className="event-management__toggle-label">
                      Notify RSVP’d attendees if the date or time changed
                    </span>
                  </label>
                </div>
              )}
              <div className="event-management__actions">
                <button type="submit" className="primary-button" disabled={isZoomSaving}>
                  {isZoomSaving
                    ? 'Creating Zoom meeting...'
                    : editingId
                      ? 'Save changes'
                      : form.type === 'announcement'
                        ? 'Publish announcement'
                        : form.type === 'poll'
                          ? 'Create poll'
                          : 'Create event'}
                </button>
                <button type="button" className="ghost-button" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
          </ModalOverlay>
        )}

        <section className="event-management__panel event-management__panel--queue report-card card-lift">
          <div className="event-management__panel-head">
            <div>
              <h3>{canManage ? 'Active items' : 'Upcoming events'}</h3>
              <p className="muted-text">
                {eventPageItems.length
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
              </p>
            </div>
            {!canManage && (
              <div className="event-view-switcher" aria-label="Event view">
                {[
                  { value: 'tiles', label: 'Tiles' },
                  { value: 'month', label: 'Month' },
                  { value: 'week', label: 'Week' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={eventView === option.value ? 'active' : ''}
                    onClick={() => setEventView(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="event-management__list">
            {(eventView === 'tiles' ? eventPageItems : calendarItems).length === 0 && (
              <div className="event-management__empty">
                <p>
                  {canManage
                    ? loadingAnnouncements
                      ? 'Loading announcements...'
                      : 'No items to manage yet.'
                    : loadingFollowed || loadingAnnouncements
                      ? 'Loading items from your communities...'
                      : 'Follow more communities or check back later for new items.'}
                </p>
              </div>
            )}
            {!canManage && eventView !== 'tiles' ? (
              <div className={`event-management__calendar event-management__calendar--${eventView}`}>
                {Object.entries(calendarGroups).map(([dateLabel, items]) => (
                  <section key={dateLabel} className="event-calendar__day">
                    <h4>{dateLabel}</h4>
                    <div className="event-calendar__entries">
                      {items.map((event) => (
                        <article key={event.id} className="event-calendar__entry">
                          <time>
                            {new Date(event.date).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                              hourCycle: 'h23',
                            })}
                          </time>
                          <div>
                            <strong>{event.title}</strong>
                            <span>{getAudienceLabel(event)}</span>
                            {event.location && <span>{event.location}</span>}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : eventPageItems.map((event) => {
              const itemType = event.type || 'event';
              const typeLabel = getTypeLabel(itemType);
              const datePrefix = getDatePrefix(itemType);
              const pollOptions = Array.isArray(event.pollOptions) ? event.pollOptions : [];

              return (
                <article key={event.id} className="event-card">
                  <div className="event-card__meta">
                    <div className="event-card__pill-row">
                      <span className={`event-card__pill type-${itemType}`}>{typeLabel}</span>
                      <span className={`event-card__pill ${event.scope === 'global' ? 'global' : 'community'}`}>
                        {event.scope === 'global' ? 'Global' : 'Community'}
                      </span>
                    </div>
                    <span className="event-card__date">
                      {event.date ? `${datePrefix} ${formatDateTime(event.date)}` : 'Date TBD'}
                    </span>
                  </div>
                  <h4>{event.title}</h4>
                  <p className="muted-text">{event.description || 'No description provided.'}</p>
                  {itemType === 'poll' && pollOptions.length > 0 && (
                    <ul className="event-card__poll-options">
                      {pollOptions.map((opt, idx) => (
                        <li key={idx}>{opt}</li>
                      ))}
                    </ul>
                  )}
                  <div className="event-card__footer">
                    <div>
                      <div className="event-card__audience">{getAudienceLabel(event)}</div>
                      {event.location && <div className="event-card__location">{event.location}</div>}
                      {event.zoomJoinUrl && (
                        <div className="event-card__location">
                          <a href={event.zoomJoinUrl} target="_blank" rel="noreferrer">
                            Join Zoom
                          </a>
                        </div>
                      )}
                      {event.zoomStartUrl && canManageEvent(event) && (
                        <div className="event-card__location">
                          <a href={event.zoomStartUrl} target="_blank" rel="noreferrer">
                            Start Zoom
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="event-card__actions">
                      {canManage && !event.isRemote && (
                        <>
                          <button type="button" className="ghost-button" onClick={() => startEdit(event)}>
                            Edit
                          </button>
                          <button type="button" className="danger-button" onClick={() => handleDelete(event.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
    </div>
  );
}

export default EventManagement;
