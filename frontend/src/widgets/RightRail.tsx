import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { isAdmin, isSuperAdmin } from '../constants/roles';
import { buildAvatarSrc } from '../utils/avatar';

type ManagedItem = {
  id: string;
  type?: 'event' | 'announcement' | 'poll' | string;
  title: string;
  description?: string;
  date?: string;
  timezone?: string;
  location?: string;
  scope?: 'global' | 'community';
  communityId?: string;
  communityName?: string;
  subCommunityId?: string;
  subCommunityName?: string;
  sourceCommunityId?: string;
  pollOptions?: string[];
  createdAt?: string;
  showResults?: boolean;
  zoomMeetingId?: string;
  zoomJoinUrl?: string;
  zoomStartUrl?: string;
  zoomHostEmail?: string;
  zoomDuration?: number;
  rsvpCount?: number;
  viewerRsvped?: boolean;
  isRemote?: boolean;
  createdById?: string;
  allowedAudiences?: string[];
  invitedUsers?: Array<{ user_id?: string }>;
};

type RightRailProps = {
  userData?: any;
  communityContext?: {
    id: string;
    type: 'university' | 'group' | string;
  } | null;
  section?: 'all' | 'ambassadors' | 'contact' | 'events' | 'polls';
  embedded?: boolean;
  hideGenericWidgets?: boolean;
};

type CommunitySummary = {
  id?: string;
  name?: string;
  community_type?: string;
  parent_community_id?: string;
  website?: string;
  phone?: string;
  phone_number?: string;
  telephone?: string;
  contact_email?: string;
  email?: string;
};

const STORAGE_KEY = 'managedEvents';
const POLL_RESPONSES_KEY = 'managedPollResponses';
const POLL_RESULTS_KEY = 'managedPollTallies';
const RSVP_KEY = 'managedEventRsvps';

const railSampleDate = (daysFromNow: number, hour = 16) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const SAMPLE_RAIL_EVENTS: ManagedItem[] = [
  {
    id: 'sample-event-research-roundtable',
    type: 'event',
    title: 'Research Methods Roundtable',
    description: 'A practical cross-disciplinary discussion.',
    date: railSampleDate(3),
    location: 'Library Seminar Room 2',
    scope: 'global',
    communityName: 'Academic Commons',
  },
];

const SAMPLE_RAIL_POLLS: ManagedItem[] = [
  {
    id: 'sample-rail-reading-format',
    type: 'poll',
    title: 'Which reading-group format works best?',
    date: railSampleDate(6, 17),
    scope: 'global',
    communityName: 'Academic Commons',
    pollOptions: ['One monthly session', 'Two shorter sessions', 'Asynchronous notes'],
    showResults: true,
  },
];

const UHART_COMMUNITY_ID = 'c8c95ee34ea174266';
const SAMPLE_UHART_POLLS: ManagedItem[] = [
  {
    id: 'sample-uhart-study-space',
    type: 'poll',
    title: 'Which campus study setting helps you focus?',
    description: 'Help shape future peer recommendations for productive study spaces.',
    date: railSampleDate(8, 21),
    scope: 'community',
    communityId: UHART_COMMUNITY_ID,
    sourceCommunityId: UHART_COMMUNITY_ID,
    communityName: 'University of Hartford',
    pollOptions: ['Quiet library floor', 'Reserveable study room', 'Student center table', 'Outdoor campus space'],
    showResults: true,
    allowedAudiences: ['public', 'members', 'verified', 'ambassadors', 'admins'],
  },
  {
    id: 'sample-uhart-community-programming',
    type: 'poll',
    title: 'What should the next UHart community session focus on?',
    description: 'Choose the practical topic that would be most useful this month.',
    date: railSampleDate(13, 21),
    scope: 'community',
    communityId: UHART_COMMUNITY_ID,
    sourceCommunityId: UHART_COMMUNITY_ID,
    communityName: 'University of Hartford',
    pollOptions: ['Academic planning', 'Campus resources', 'Career preparation', 'Arts and performances'],
    showResults: true,
    allowedAudiences: ['public', 'members', 'verified', 'ambassadors', 'admins'],
  },
];

const datePrefix = (type?: string) => {
  if (type === 'poll') return 'Closes';
  if (type === 'announcement') return 'Publishes';
  return 'Occurs';
};

const formatRailDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
};

const formatCalendarDate = (value?: string, timeZone?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const options = timeZone ? { timeZone } : {};
  try {
    return {
      iso: date.toISOString(),
      month: date.toLocaleDateString(undefined, { ...options, month: 'short' }).toUpperCase(),
      day: date.toLocaleDateString(undefined, { ...options, day: '2-digit' }),
      weekday: date.toLocaleDateString(undefined, { ...options, weekday: 'short' }).toUpperCase(),
    };
  } catch {
    return {
      iso: date.toISOString(),
      month: date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
      day: date.toLocaleDateString(undefined, { day: '2-digit' }),
      weekday: date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
    };
  }
};

export default function RightRail({
  userData,
  communityContext = null,
  section = 'all',
  embedded = false,
  hideGenericWidgets = false,
}: RightRailProps) {
  const navigate = useNavigate();
  const isSuperAdminUser = isSuperAdmin(userData?.role_id);
  const isAdminUser = isAdmin(userData?.role_id);
  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(userData?.admin_community_ids)) return [];
    return userData.admin_community_ids.map((id: any) => String(id));
  }, [userData]);

  const [items, setItems] = useState<ManagedItem[]>([]);
  const [remoteEvents, setRemoteEvents] = useState<ManagedItem[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [community, setCommunity] = useState<CommunitySummary | null>(null);
  const [communityAmbassadors, setCommunityAmbassadors] = useState<any[]>([]);
  const [eventIndex, setEventIndex] = useState(0);
  const [pollIndex, setPollIndex] = useState(0);
  const [pollResponses, setPollResponses] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(POLL_RESPONSES_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const [pollTallies, setPollTallies] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const raw = localStorage.getItem(POLL_RESULTS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const [pollMessage, setPollMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [rsvps, setRsvps] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem(RSVP_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const [rsvpMessages, setRsvpMessages] = useState<Record<string, string>>({});
  const postWithFallback = async (primaryUrl: string, fallbackUrl: string, payload: Record<string, unknown>) => {
    try {
      return await axios.post(primaryUrl, payload, { withCredentials: true });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 && fallbackUrl) {
        return await axios.post(fallbackUrl, payload, { withCredentials: true });
      }
      throw err;
    }
  };

  const readLocalItems = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        setItems([]);
        return;
      }
      const normalized = parsed
        .filter((i) => i && i.id && i.title)
        .map((i) => ({
          ...i,
          id: String(i.id),
          scope: i.scope || 'community',
          communityId: i.communityId ? String(i.communityId) : '',
          pollOptions: Array.isArray(i.pollOptions) ? i.pollOptions : [],
          showResults: Boolean(i.showResults),
          zoomMeetingId: i.zoomMeetingId ? String(i.zoomMeetingId) : '',
          zoomJoinUrl: i.zoomJoinUrl || '',
          zoomStartUrl: i.zoomStartUrl || '',
          zoomHostEmail: i.zoomHostEmail || '',
          zoomDuration: i.zoomDuration ? Number(i.zoomDuration) : undefined,
        }));
      setItems(normalized);
    } catch (err) {
      console.error('Unable to read managed events', err);
      setItems([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      try {
        const res = await axios.get('/api/fetch_events.php', { withCredentials: true });
        if (!cancelled) {
          setRemoteEvents(Array.isArray(res.data?.events) ? res.data.events : []);
        }
      } catch {
        if (!cancelled) setRemoteEvents([]);
      }
    };
    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [userData?.user_id]);

  useEffect(() => {
    let cancelled = false;
    if (!communityContext?.id) {
      setCommunity(null);
      setCommunityAmbassadors([]);
      return undefined;
    }

    const loadCommunityRail = async () => {
      const [communityResult, ambassadorsResult] = await Promise.allSettled([
        axios.get(`/api/fetch_community.php?community_id=${encodeURIComponent(communityContext.id)}`),
        axios.get(`/api/fetch_ambassador_list.php?community_id=${encodeURIComponent(communityContext.id)}`),
      ]);
      if (cancelled) return;

      if (
        communityResult.status === 'fulfilled'
        && communityResult.value.data?.success
      ) {
        setCommunity(communityResult.value.data.community || null);
      } else {
        setCommunity(null);
      }

      if (
        ambassadorsResult.status === 'fulfilled'
        && ambassadorsResult.value.data?.success
      ) {
        setCommunityAmbassadors(
          Array.isArray(ambassadorsResult.value.data.ambassadors)
            ? ambassadorsResult.value.data.ambassadors
            : []
        );
      } else {
        setCommunityAmbassadors([]);
      }
    };

    loadCommunityRail();
    return () => {
      cancelled = true;
    };
  }, [communityContext?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    readLocalItems();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) readLocalItems();
    };
    const handleCustomUpdate = (e: Event) => {
      if ((e as CustomEvent).detail?.key === STORAGE_KEY || !(e as CustomEvent).detail) {
        readLocalItems();
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
    let isCancelled = false;
    const loadFollowed = async () => {
      if (!userData?.user_id) return;
      try {
        const res = await axios.get(`/api/followed_communities.php?user_id=${userData.user_id}`);
        if (!isCancelled) {
          const list = Array.isArray(res.data) ? res.data : [];
          const ids = list.map((c: any) => String(c.community_id ?? c.id ?? '')).filter(Boolean);
          setFollowed(ids);
        }
      } catch (err) {
        console.error('Unable to fetch followed communities', err);
        if (!isCancelled) setFollowed([]);
      }
    };
    loadFollowed();
    return () => {
      isCancelled = true;
    };
  }, [userData?.user_id]);

  const isVisible = useCallback((item: ManagedItem) => {
    const userId = String(userData?.user_id || '');
    if (userId && String(item.createdById || '') === userId) return true;
    if (userId && item.invitedUsers?.some((user) => String(user.user_id || '') === userId)) return true;
    const audiences = Array.isArray(item.allowedAudiences) && item.allowedAudiences.length
      ? item.allowedAudiences
      : ['public', 'members', 'verified', 'ambassadors', 'admins'];
    if (item.scope === 'global') {
      return audiences.includes('public')
        || (Boolean(userId) && audiences.includes('members'))
        || (isAdminUser && audiences.includes('admins'))
        || (Number(userData?.is_ambassador) === 1 && audiences.includes('ambassadors'))
        || (Number(userData?.verified) === 1 && audiences.includes('verified'));
    }
    const sourceCommunityId = String(item.subCommunityId || item.communityId || '');
    if (!sourceCommunityId) return false;
    if (isSuperAdminUser) return true;

    const ambassadorCommunityIds = Array.isArray(userData?.ambassador_communities)
      ? userData.ambassador_communities
          .map((entry: any) => String(entry?.community_id ?? entry?.id ?? entry ?? ''))
          .filter(Boolean)
      : [];
    const verifiedCommunityId = String(userData?.verified_community_id || '');
    const isVerifiedForCommunity =
      Number(userData?.verified) === 1
      && (
        verifiedCommunityId === sourceCommunityId
        || (
          String(communityContext?.id || '') === sourceCommunityId
          && verifiedCommunityId === String(community?.parent_community_id || '')
        )
      );

    return audiences.includes('public')
      || (
        audiences.includes('admins')
        && (isAdminUser || adminCommunityIds.includes(sourceCommunityId))
      )
      || (
        audiences.includes('ambassadors')
        && ambassadorCommunityIds.includes(sourceCommunityId)
      )
      || (
        audiences.includes('verified')
        && isVerifiedForCommunity
      )
      || (
        audiences.includes('members')
        && followed.includes(sourceCommunityId)
      );
  }, [
    adminCommunityIds,
    community?.parent_community_id,
    communityContext?.id,
    followed,
    isAdminUser,
    isSuperAdminUser,
    userData?.ambassador_communities,
    userData?.is_ambassador,
    userData?.user_id,
    userData?.verified,
    userData?.verified_community_id,
  ]);

  const visibleItems = useMemo(() => {
    const merged = new Map<string, ManagedItem>();
    items.forEach((item) => merged.set(String(item.id), item));
    remoteEvents.forEach((item) => merged.set(String(item.id), item));
    const accessible = Array.from(merged.values()).filter((item) => item.isRemote || isVisible(item));
    if (!communityContext?.id) return accessible;
    return accessible.filter((item) => {
      const sourceCommunityId = String(
        item.sourceCommunityId || item.subCommunityId || item.communityId || ''
      );
      return sourceCommunityId === String(communityContext.id);
    });
  }, [communityContext?.id, items, remoteEvents, isVisible]);

  const sortedEvents = useMemo(() => {
    const isUpcomingEvent = (item: ManagedItem) => {
      if (item.type === 'announcement') return true;
      const date = item.date || item.createdAt;
      if (!date) return true;
      const start = Date.parse(date);
      if (Number.isNaN(start)) return true;
      const durationMinutes = item.zoomDuration ? Number(item.zoomDuration) : 60;
      const end = start + Math.max(durationMinutes, 0) * 60 * 1000;
      return end > now;
    };
    const rank = (item: ManagedItem) => {
      const date = item.date || item.createdAt;
      if (date) {
        const t = Date.parse(date);
        if (!Number.isNaN(t)) return t;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    return visibleItems
      .filter((i) => i.type !== 'poll' && i.type !== 'announcement')
      .filter((i) => isUpcomingEvent(i))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 8);
  }, [visibleItems, now]);

  const polls = useMemo(
    () => visibleItems.filter((i) => i.type === 'poll').slice(0, 5),
    [visibleItems]
  );
  const communityKind = community?.parent_community_id
    ? 'Sub-Group'
    : communityContext?.type === 'university'
      ? 'University'
      : communityContext?.type === 'group'
        ? 'Group'
        : 'Community';
  const displayEvents = communityContext
    ? sortedEvents
    : sortedEvents.length
      ? sortedEvents
      : SAMPLE_RAIL_EVENTS;
  const displayPolls = communityContext
    ? (
        polls.length
          ? polls
          : String(communityContext.id) === UHART_COMMUNITY_ID
            ? SAMPLE_UHART_POLLS
            : []
      )
    : polls.length
      ? polls
      : SAMPLE_RAIL_POLLS;

  useEffect(() => {
    setEventIndex((idx) => {
      if (displayEvents.length === 0) return 0;
      return Math.min(idx, displayEvents.length - 1);
    });
  }, [displayEvents.length]);

  useEffect(() => {
    setPollIndex((idx) => {
      if (displayPolls.length === 0) return 0;
      return Math.min(idx, displayPolls.length - 1);
    });
  }, [displayPolls.length]);

  useEffect(() => {
    try {
      localStorage.setItem(POLL_RESPONSES_KEY, JSON.stringify(pollResponses));
    } catch {
      // ignore storage errors
    }
  }, [pollResponses]);

  useEffect(() => {
    try {
      localStorage.setItem(POLL_RESULTS_KEY, JSON.stringify(pollTallies));
    } catch {
      // ignore storage errors
    }
  }, [pollTallies]);

  useEffect(() => {
    try {
      localStorage.setItem(RSVP_KEY, JSON.stringify(rsvps));
    } catch {
      // ignore storage errors
    }
  }, [rsvps]);

  const scopeLabel = (item: ManagedItem) =>
    item.scope === 'global'
      ? 'Global'
      : [
          `Community: ${item.communityName || (item.communityId ? `Community ${item.communityId}` : 'Community item')}`,
          item.subCommunityName ? `Sub-community: ${item.subCommunityName}` : '',
        ].filter(Boolean).join(' · ');

  const renderItemMeta = (item: ManagedItem) => {
    const formattedDate = formatRailDateTime(item.date);
    const dateText = formattedDate ? `${datePrefix(item.type)} ${formattedDate}` : '';
    const baseType = item.type === 'announcement' ? 'Announcement' : 'Event';
    return `${baseType} · ${scopeLabel(item)}${dateText ? ` · ${dateText}` : ''}`;
  };

  const renderPollMeta = (item: ManagedItem) => {
    const formattedDate = formatRailDateTime(item.date);
    const dateText = formattedDate ? `${datePrefix(item.type)} ${formattedDate}` : '';
    return `Poll · ${scopeLabel(item)}${dateText ? ` · ${dateText}` : ''}`;
  };

  const currentPoll = displayPolls[pollIndex];
  const currentEvent = displayEvents[eventIndex];

  const handleVote = (option: string) => {
    if (!currentPoll) return;
    if (!userData?.user_id) {
      setPollMessage('Log in or sign up to vote in polls.');
      return;
    }

    const prevChoice = pollResponses[currentPoll.id];
    if (prevChoice) {
      setPollMessage('Your response is final for this poll.');
      return;
    }

    setPollResponses((prev) => ({ ...prev, [currentPoll.id]: option }));
    setPollTallies((prev) => {
      const next = { ...prev };
      const pollTotals = { ...(next[currentPoll.id] || {}) };
      pollTotals[option] = (pollTotals[option] || 0) + 1;
      next[currentPoll.id] = pollTotals;
      return next;
    });
    setPollMessage('Thanks for voting!');
  };

  const goNextPoll = () => {
    if (!displayPolls.length) return;
    setPollIndex((prev) => (prev + 1) % displayPolls.length);
    setPollMessage('');
  };

  const goPrevPoll = () => {
    if (!displayPolls.length) return;
    setPollIndex((prev) => (prev - 1 + displayPolls.length) % displayPolls.length);
    setPollMessage('');
  };

  useEffect(() => {
    setPollMessage('');
  }, [pollIndex]);

  const goNextEvent = () => {
    if (!displayEvents.length) return;
    setEventIndex((prev) => (prev + 1) % displayEvents.length);
  };

  const goPrevEvent = () => {
    if (!displayEvents.length) return;
    setEventIndex((prev) => (prev - 1 + displayEvents.length) % displayEvents.length);
  };

  const userId = userData?.user_id ? String(userData.user_id) : '';
  const toggleRsvp = async (item: ManagedItem) => {
    const eventId = item.id;
    if (!userId) {
      setRsvpMessages((prev) => ({ ...prev, [eventId]: 'Log in or sign up to RSVP.' }));
      return;
    }
    const currentList = rsvps[eventId] || [];
    const hasRsvped = Boolean(item.viewerRsvped || currentList.includes(userId));
    if (!eventId.startsWith('sample-')) {
      try {
        await postWithFallback(
          '/api/rsvp_event.php',
          '/rsvp_event.php',
          { event_id: eventId, action: hasRsvped ? 'cancel' : 'register' }
        );
        setRemoteEvents((prev) => prev.map((event) => (
          event.id === eventId
            ? {
                ...event,
                viewerRsvped: !hasRsvped,
                rsvpCount: Math.max(0, Number(event.rsvpCount || 0) + (hasRsvped ? -1 : 1)),
              }
            : event
        )));
        try {
          const refreshed = await axios.get('/api/fetch_events.php', { withCredentials: true });
          if (Array.isArray(refreshed.data?.events)) {
            setRemoteEvents(refreshed.data.events);
          }
        } catch {
          // The RSVP succeeded; keep the optimistic rail state if refresh fails.
        }
      } catch (err) {
        console.error('Unable to update RSVP', err);
        setRsvpMessages((prev) => ({ ...prev, [eventId]: 'Unable to update RSVP right now.' }));
        return;
      }
    }
    setRsvps((prev) => {
      const next = { ...prev };
      const nextList = hasRsvped
        ? currentList.filter((id) => id !== userId)
        : [...currentList, userId];
      next[eventId] = nextList;
      return next;
    });
    setRsvpMessages((prev) => ({
      ...prev,
      [eventId]: hasRsvped ? 'RSVP removed.' : 'RSVP confirmed!',
    }));
  };

  const communityPhone = community?.phone || community?.phone_number || community?.telephone || '';
  const communityEmail = community?.contact_email || community?.email || '';
  const showSection = (candidate: RightRailProps['section']) => section === 'all' || section === candidate;
  const idPrefix = embedded ? `community-mobile-${section}` : 'community-rail';

  return (
    <div
      className={`right-rail-stack${communityContext ? ' community-context-rail' : ''}${embedded ? ' community-context-rail--embedded' : ''}`}
    >
      {communityContext && showSection('ambassadors') && (
        <section className="widget-card community-ambassadors-widget" aria-labelledby={`${idPrefix}-ambassadors-header`}>
          <div id={`${idPrefix}-ambassadors-header`} className="widget-header compact-widget-header">
            <h3 className="widget-title">Ambassadors</h3>
            <span>{communityAmbassadors.length}</span>
          </div>
          <div className="widget-body">
            {communityAmbassadors.length ? (
              <ul className="community-rail-ambassadors" aria-label={`${community?.name || communityKind} ambassadors`}>
                {communityAmbassadors.slice(0, 5).map((ambassador) => (
                  <li key={ambassador.user_id || ambassador.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/user/${ambassador.user_id || ambassador.id}`)}
                    >
                      <img
                        src={buildAvatarSrc(ambassador.avatar_path)}
                        alt=""
                        aria-hidden="true"
                      />
                      <span>
                        <strong>{ambassador.first_name} {ambassador.last_name}</strong>
                        <small>{ambassador.headline || ambassador.community_role || 'Community ambassador'}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="community-rail-empty">No current ambassadors.</p>
            )}
            {userData?.user_id && (
              <button
                type="button"
                className="widget-cta community-rail-view-all"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openCommunityAmbassadors', {
                    detail: { communityId: communityContext.id },
                  }));
                }}
              >
                View all
              </button>
            )}
          </div>
        </section>
      )}

      {communityContext && showSection('contact') && (
        <section className="widget-card community-contact-widget" aria-labelledby={`${idPrefix}-contact-header`}>
          <div id={`${idPrefix}-contact-header`} className="widget-header compact-widget-header">
            <h3 className="widget-title">Contact</h3>
          </div>
          <div className="widget-body community-contact-list">
            {community?.website && (
              <a href={community.website} target="_blank" rel="noopener noreferrer">
                Visit website
              </a>
            )}
            {communityPhone && (
              <a href={`tel:${communityPhone}`} aria-label={`Call ${communityPhone}`}>
                <span>Phone</span>
                <strong>{communityPhone}</strong>
              </a>
            )}
            {communityEmail && (
              <a href={`mailto:${communityEmail}`}>
                <span>Email</span>
                <strong>{communityEmail}</strong>
              </a>
            )}
            {!community?.website && !communityPhone && !communityEmail && (
              <p className="community-rail-empty">No contact information provided.</p>
            )}
          </div>
        </section>
      )}

      {showSection('events') && !(hideGenericWidgets && !communityContext) && (
      <section className="widget-card compact-agenda-widget" aria-labelledby={`${idPrefix}-events-header`}>
        <div
          id={`${idPrefix}-events-header`}
          className="widget-header compact-widget-header"
        >
          <h3 className="widget-title">
            {communityContext ? `${communityKind} Events` : 'Upcoming Events'}
          </h3>
          <span>{displayEvents.length}</span>
        </div>
        <div className="widget-body">
          <ul className="widget-list" aria-label={communityContext ? `${communityKind} events` : 'Upcoming events'}>
            {currentEvent && [currentEvent].map((item) => {
              const rsvpList = rsvps[item.id] || [];
              const rsvpCount = Math.max(Number(item.rsvpCount) || 0, rsvpList.length);
              const hasRsvped = Boolean(item.viewerRsvped || (userId && rsvpList.includes(userId)));
              const rsvpMessage = rsvpMessages[item.id];
              const isEvent = item.type !== 'announcement' && item.type !== 'poll';
              const calendarDate = formatCalendarDate(item.date, item.timezone);
              const eventParams = new URLSearchParams({
                event: String(item.id),
                from: communityContext ? 'community' : 'rail',
              });
              if (communityContext?.id) {
                eventParams.set('community', String(communityContext.id));
              }
              const eventDestination = `/events-feed?${eventParams.toString()}`;
              return (
                <li
                  key={item.id}
                  className="widget-list-item compact-event-item"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(eventDestination)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      navigate(eventDestination);
                    }
                  }}
                >
                  <div className="community-event-card-layout">
                    {calendarDate && (
                      <time className="community-event-date" dateTime={calendarDate.iso}>
                        <span>{calendarDate.month}</span>
                        <strong>{calendarDate.day}</strong>
                        <small>{calendarDate.weekday}</small>
                      </time>
                    )}
                    <div className="community-event-card-copy">
                      <div className="widget-item-title">{item.title}</div>
                      <div className="widget-item-meta">{renderItemMeta(item)}</div>
                      {item.description && (
                        <div className="community-event-description">
                          {item.description.length > 180 ? `${item.description.slice(0, 180)}…` : item.description}
                        </div>
                      )}
                      {isEvent && (
                        <div className="widget-item-actions community-event-actions">
                          <button
                            type="button"
                            className={`widget-cta${hasRsvped ? ' selected' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleRsvp(item);
                            }}
                          >
                            {hasRsvped ? 'Going' : 'RSVP'}
                          </button>
                          {item.zoomJoinUrl && (
                            <a
                              href={item.zoomJoinUrl}
                              className="widget-cta secondary"
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Join Zoom
                            </a>
                          )}
                          {rsvpCount > 0 && (
                            <span className="community-event-rsvp-count">{rsvpCount} going</span>
                          )}
                        </div>
                      )}
                      {isEvent && rsvpMessage && (
                        <div className="widget-item-meta">{rsvpMessage}</div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!currentEvent && (
            <p className="community-rail-empty">No viewable events for this {communityKind.toLowerCase()}.</p>
          )}
          {displayEvents.length > 0 && (
          <div className="poll-nav rail-event-nav">
            <button type="button" onClick={goPrevEvent} disabled={displayEvents.length <= 1} aria-label="Previous event">
              ‹
            </button>
            <div className="poll-dots" aria-label="Event pagination">
              {displayEvents.map((_, idx) => (
                <span key={idx} className={`poll-dot${idx === eventIndex ? ' active' : ''}`} aria-hidden="true" />
              ))}
            </div>
            <button type="button" onClick={goNextEvent} disabled={displayEvents.length <= 1} aria-label="Next event">
              ›
            </button>
          </div>
          )}
        </div>
      </section>
      )}

      {showSection('polls') && !(hideGenericWidgets && !communityContext) && (
      <section className="widget-card compact-poll-widget" aria-labelledby={`${idPrefix}-polls-header`}>
        <div
          id={`${idPrefix}-polls-header`}
          className="widget-header compact-widget-header"
        >
          <h3 className="widget-title">
            {communityContext ? `${communityKind} Polls` : 'Polls'}
          </h3>
          <span>{displayPolls.length}</span>
        </div>
        <div className="widget-body">
          {displayPolls.length > 0 && currentPoll && (
            <div
              className="widget-list poll-slide"
              aria-label="Community polls"
              style={{ gap: '10px' }}
              key={currentPoll.id}
            >
              <div
                className="widget-list-item"
                style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '8px' }}
              >
                <div className="widget-item-title">{currentPoll.title}</div>
                <div className="widget-item-meta">{renderPollMeta(currentPoll)}</div>
                {!userData?.user_id && (
                  <div className="widget-item-meta" style={{ color: '#b91c1c' }}>
                    Log in or sign up to vote in polls.
                  </div>
                )}
                {!pollResponses[currentPoll.id] && currentPoll.pollOptions && currentPoll.pollOptions.length > 0 ? (
                  <div className="widget-poll-options" role="group" aria-label="Poll options">
                    {currentPoll.pollOptions.map((opt, idx) => {
                      return (
                        <button
                          key={idx}
                          type="button"
                          className="poll-option-button"
                          onClick={() => handleVote(opt)}
                          disabled={!userData?.user_id}
                          style={{ width: '100%', textAlign: 'left', justifyContent: 'space-between' }}
                        >
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : !pollResponses[currentPoll.id] ? (
                  <div className="widget-item-meta">This poll has no options configured.</div>
                ) : null}
                {pollMessage && <div className="widget-item-meta">{pollMessage}</div>}
                {pollResponses[currentPoll.id] && (
                  <div className="poll-results">
                    {(currentPoll.pollOptions || []).map((opt, idx) => {
                      const pollTotal = pollTallies[currentPoll.id] || {};
                      const votes = pollTotal[opt] || 0;
                      const totalVotes = Object.values(pollTotal).reduce((sum, n) => sum + n, 0);
                      const percent = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                      return (
                        <div key={idx} className="poll-result-row">
                          <div className="poll-result-label">{opt}</div>
                          <div className="poll-result-bar">
                            <div className="poll-result-fill" style={{ width: `${percent}%` }} />
                          </div>
                          <div className="poll-result-meta">{votes} vote{votes === 1 ? '' : 's'} • {percent}%</div>
                        </div>
                      );
                    })}
                    {!Object.values(pollTallies[currentPoll.id] || {}).length && (
                      <div className="widget-item-meta">No votes recorded yet.</div>
                    )}
                  </div>
                )}
                <div className="poll-nav" style={{ alignSelf: 'center' }}>
                  <button type="button" onClick={goPrevPoll} disabled={displayPolls.length <= 1} aria-label="Previous poll">
                    ‹
                  </button>
                  <div className="poll-dots" aria-label="Poll pagination">
                    {displayPolls.map((_, idx) => (
                      <span
                        key={idx}
                        className={`poll-dot${idx === pollIndex ? ' active' : ''}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <button type="button" onClick={goNextPoll} disabled={displayPolls.length <= 1} aria-label="Next poll">
                    ›
                  </button>
                </div>
              </div>
            </div>
          )}
          {!currentPoll && (
            <p className="community-rail-empty">No viewable polls for this {communityKind.toLowerCase()}.</p>
          )}
        </div>
      </section>
      )}

    </div>
  );
}
