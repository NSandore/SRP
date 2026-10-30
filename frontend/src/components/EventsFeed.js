import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers3,
  List,
  MapPin,
  Users,
} from 'lucide-react';
import { isAdmin, isSuperAdmin } from '../constants/roles';
import EventJoinButton from './EventJoinButton';

const STORAGE_KEY = 'managedEvents';
const RSVP_KEY = 'managedEventRsvps';
const ALL_COMMUNITIES = 'all';
const EVENT_COMMUNITY_COLORS = [
  '#69A8F7',
  '#7656D9',
  '#456b8c',
  '#8a6a2f',
  '#6e5a88',
  '#3f7a78',
  '#9a4f68',
  '#66733d',
];

const eventCommunityKey = (item) => {
  if (item.scope === 'global') return 'global';
  return String(item.sourceCommunityId || item.subCommunityId || item.communityId || 'community');
};

const eventCommunityLabel = (item) => {
  if (item.scope === 'global') return 'Global events';
  return item.subCommunityName || item.communityName || 'Community event';
};

const validBrandColor = (value) => {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) || /^#[0-9a-f]{3}$/i.test(color)
    ? color
    : '';
};

const eventCommunityColor = (itemOrKey) => {
  if (typeof itemOrKey === 'object' && itemOrKey !== null) {
    const brandColor = validBrandColor(itemOrKey.communityPrimaryColor);
    if (brandColor) return brandColor;
  }
  const key = typeof itemOrKey === 'string' ? itemOrKey : eventCommunityKey(itemOrKey);
  if (key === 'global') return '#6f6552';
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(index);
    hash |= 0;
  }
  return EVENT_COMMUNITY_COLORS[Math.abs(hash) % EVENT_COMMUNITY_COLORS.length];
};

const sampleDate = (daysFromNow, hour) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const SAMPLE_EVENTS = [
  {
    id: 'sample-event-research-roundtable',
    type: 'event',
    title: 'Research Methods Roundtable',
    description: 'A cross-disciplinary conversation about building credible questions, choosing methods, and documenting sources.',
    date: sampleDate(3, 16),
    location: 'Library Seminar Room 2',
    scope: 'global',
    communityName: 'Academic Commons',
    zoomDuration: 75,
    sample: true,
  },
  {
    id: 'sample-event-funding-clinic',
    type: 'event',
    title: 'Graduate Funding Clinic',
    description: 'Bring a draft budget or funding question for a practical review with student ambassadors and recent applicants.',
    date: sampleDate(7, 13),
    location: 'Online session',
    scope: 'global',
    communityName: 'Funding & Fellowships',
    zoomDuration: 60,
    sample: true,
  },
  {
    id: 'sample-event-reading-group',
    type: 'event',
    title: 'Public Scholarship Reading Group',
    description: 'A close reading and discussion of how academic work can be made useful beyond the university.',
    date: sampleDate(12, 18),
    location: 'Humanities Commons',
    scope: 'global',
    communityName: 'Public Humanities',
    zoomDuration: 90,
    sample: true,
  },
];

const normalizeLocalItems = (raw) => {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.id && item.title)
      .map((item) => ({
        ...item,
        id: String(item.id),
        scope: item.scope || 'community',
        communityId: item.communityId ? String(item.communityId) : '',
        zoomDuration: item.zoomDuration ? Number(item.zoomDuration) : undefined,
        allowedAudiences: Array.isArray(item.allowedAudiences)
          ? item.allowedAudiences
          : ['public', 'members', 'ambassadors', 'admins'],
      }));
  } catch {
    return [];
  }
};

function EventsFeed({ userData }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedEventId = searchParams.get('event') || '';
  const linkedEventSource = searchParams.get('from') || '';
  const linkedCommunityId = searchParams.get('community') || '';
  const linkedEventRef = useRef('');
  const focusedScrollRef = useRef('');
  const roleId = Number(userData?.role_id || 0);
  const isSuperAdminUser = isSuperAdmin(roleId);
  const isAdminUser = isAdmin(roleId);
  const isAmbassador = Number(userData?.is_ambassador) === 1;
  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(userData?.admin_community_ids)) return [];
    return userData.admin_community_ids.map((id) => String(id));
  }, [userData]);

  const [items, setItems] = useState(() => normalizeLocalItems(localStorage.getItem(STORAGE_KEY)));
  const [remoteEvents, setRemoteEvents] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState('agenda');
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [expandedEventId, setExpandedEventId] = useState(linkedEventId);
  const [communityFilter, setCommunityFilter] = useState(linkedCommunityId || ALL_COMMUNITIES);
  const [rsvps, setRsvps] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(RSVP_KEY) || '{}');
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const [rsvpMessages, setRsvpMessages] = useState({});

  const loadRemoteEvents = useCallback(async () => {
    setLoadingRemote(true);
    try {
      const res = await axios.get('/api/fetch_events.php', { withCredentials: true });
      setRemoteEvents(Array.isArray(res.data?.events) ? res.data.events : []);
    } catch (error) {
      console.error('Unable to load events', error);
      setRemoteEvents([]);
    } finally {
      setLoadingRemote(false);
    }
  }, []);

  useEffect(() => {
    loadRemoteEvents();
  }, [loadRemoteEvents, userData?.user_id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const readLocalItems = () => setItems(normalizeLocalItems(localStorage.getItem(STORAGE_KEY)));
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEY) readLocalItems();
    };
    const handleCustomUpdate = (event) => {
      if (event.detail?.key === STORAGE_KEY || !event.detail) readLocalItems();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('managedEventsUpdated', handleCustomUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('managedEventsUpdated', handleCustomUpdate);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadFollowed = async () => {
      if (!userData?.user_id) {
        setFollowed([]);
        return;
      }
      setLoadingFollowed(true);
      try {
        const res = await axios.get(`/api/followed_communities.php?user_id=${userData.user_id}`);
        if (!cancelled) {
          const list = Array.isArray(res.data) ? res.data : [];
          setFollowed(list.map((community) => String(community.community_id ?? community.id ?? '')).filter(Boolean));
        }
      } catch (error) {
        if (!cancelled) setFollowed([]);
      } finally {
        if (!cancelled) setLoadingFollowed(false);
      }
    };
    loadFollowed();
    return () => {
      cancelled = true;
    };
  }, [userData?.user_id]);

  useEffect(() => {
    localStorage.setItem(RSVP_KEY, JSON.stringify(rsvps));
  }, [rsvps]);

  const isVisible = useCallback((item) => {
    if (item.isRemote) return true;
    const viewerId = String(userData?.user_id || '');
    if (viewerId && String(item.createdById || '') === viewerId) return true;
    if (viewerId && item.invitedUsers?.some((user) => String(user.user_id || '') === viewerId)) return true;
    const audiences = Array.isArray(item.allowedAudiences) && item.allowedAudiences.length
      ? item.allowedAudiences
      : ['public', 'members', 'ambassadors', 'admins'];
    const levelAllowed = audiences.includes('public')
      || (isAdminUser && audiences.includes('admins'))
      || (isAmbassador && audiences.includes('ambassadors'))
      || (!isAdminUser && !isAmbassador && audiences.includes('members'));
    if (!levelAllowed && !isSuperAdminUser) return false;
    if (item.scope === 'global') return true;
    const communityId = String(item.communityId || '');
    return isSuperAdminUser
      || adminCommunityIds.includes(communityId)
      || followed.includes(communityId);
  }, [adminCommunityIds, followed, isAdminUser, isAmbassador, isSuperAdminUser, userData?.user_id]);

  const mergedEvents = useMemo(() => {
    const merged = new Map();
    items.forEach((item) => merged.set(String(item.id), item));
    remoteEvents.forEach((item) => merged.set(String(item.id), item));
    return Array.from(merged.values()).filter(isVisible);
  }, [items, remoteEvents, isVisible]);

  const sortedEvents = useMemo(() => {
    const rank = (item) => {
      const timestamp = Date.parse(item.date || item.createdAt || '');
      return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
    };
    return mergedEvents
      .filter((item) => item.type !== 'poll' && item.type !== 'announcement')
      .filter((item) => {
        const start = Date.parse(item.date || item.createdAt || '');
        if (Number.isNaN(start)) return true;
        const duration = Math.max(Number(item.zoomDuration) || 60, 0) * 60 * 1000;
        return start + duration > now;
      })
      .sort((a, b) => rank(a) - rank(b));
  }, [mergedEvents, now]);

  const availableEvents = sortedEvents.length ? sortedEvents : SAMPLE_EVENTS;
  const communityOptions = useMemo(() => {
    const options = new Map();
    availableEvents.forEach((item) => {
      const key = eventCommunityKey(item);
      if (!options.has(key)) {
        options.set(key, {
          id: key,
          label: eventCommunityLabel(item),
          color: eventCommunityColor(item),
        });
      }
    });
    return Array.from(options.values()).sort((a, b) => {
      if (a.id === 'global') return -1;
      if (b.id === 'global') return 1;
      return a.label.localeCompare(b.label);
    });
  }, [availableEvents]);
  const displayEvents = useMemo(
    () => (
      communityFilter === ALL_COMMUNITIES
        ? availableEvents
        : availableEvents.filter((item) => eventCommunityKey(item) === communityFilter)
    ),
    [availableEvents, communityFilter]
  );
  const isLoading = loadingFollowed || loadingRemote;
  const communityName = (item) =>
    item.communityName || (item.communityId ? `Community ${item.communityId}` : 'Community event');
  const userId = userData?.user_id ? String(userData.user_id) : '';

  const hasRsvpedTo = (item) =>
    Boolean(item.viewerRsvped || (userId && (rsvps[item.id] || []).includes(userId)));

  const toggleRsvp = async (item) => {
    if (!userId) {
      setRsvpMessages((prev) => ({ ...prev, [item.id]: 'Log in or sign up to RSVP.' }));
      return;
    }
    const hasRsvped = hasRsvpedTo(item);
    if (!String(item.id).startsWith('sample-')) {
      try {
        const res = await axios.post(
          '/api/rsvp_event.php',
          { event_id: item.id, action: hasRsvped ? 'cancel' : 'register' },
          { withCredentials: true }
        );
        if (!res.data?.success) throw new Error(res.data?.error || 'Unable to update RSVP');
        await loadRemoteEvents();
      } catch (error) {
        console.error('Unable to update RSVP', error);
        setRsvpMessages((prev) => ({ ...prev, [item.id]: 'Unable to update RSVP right now.' }));
        return;
      }
    }
    setRsvps((prev) => {
      const current = prev[item.id] || [];
      return {
        ...prev,
        [item.id]: hasRsvped
          ? current.filter((id) => id !== userId)
          : Array.from(new Set([...current, userId])),
      };
    });
    setRsvpMessages((prev) => ({
      ...prev,
      [item.id]: hasRsvped ? 'RSVP removed.' : 'RSVP confirmed.',
    }));
  };

  const openEvent = useCallback((eventId, source = '', sourceCommunityId = '') => {
    setExpandedEventId(eventId);
    setView('agenda');
    const activeCommunity = sourceCommunityId
      || (communityFilter !== ALL_COMMUNITIES ? communityFilter : '');
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (eventId) next.set('event', eventId);
      else next.delete('event');
      if (source) next.set('from', source);
      else next.delete('from');
      if (activeCommunity) next.set('community', activeCommunity);
      else next.delete('community');
      return next;
    });
  }, [communityFilter, setSearchParams]);

  const handleCommunityFilterChange = (event) => {
    const nextCommunity = event.target.value;
    setCommunityFilter(nextCommunity);
    setExpandedEventId('');
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('event');
      next.delete('from');
      if (nextCommunity === ALL_COMMUNITIES) next.delete('community');
      else next.set('community', nextCommunity);
      return next;
    });
  };

  useEffect(() => {
    setCommunityFilter(linkedCommunityId || ALL_COMMUNITIES);
  }, [linkedCommunityId]);

  useEffect(() => {
    if (!linkedEventId) {
      linkedEventRef.current = '';
      return;
    }
    const linkedEventKey = `${linkedEventId}:${linkedEventSource}:${linkedCommunityId}`;
    if (linkedEventRef.current === linkedEventKey) return;
    linkedEventRef.current = linkedEventKey;
    openEvent(linkedEventId, linkedEventSource, linkedCommunityId);
  }, [linkedCommunityId, linkedEventId, linkedEventSource, displayEvents.length, openEvent]);

  useEffect(() => {
    if (!linkedEventId || view !== 'agenda') {
      focusedScrollRef.current = '';
      return undefined;
    }
    const focusKey = `${linkedEventId}:${linkedEventSource}:${linkedCommunityId}`;
    if (focusedScrollRef.current === focusKey) return undefined;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(`event-${linkedEventId}`);
      if (!target) return;
      focusedScrollRef.current = focusKey;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [displayEvents, linkedCommunityId, linkedEventId, linkedEventSource, view]);

  const monthCells = useMemo(() => {
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dayEvents = displayEvents.filter((item) => {
        if (!item.date) return false;
        const eventDate = new Date(item.date);
        return eventDate.getFullYear() === date.getFullYear()
          && eventDate.getMonth() === date.getMonth()
          && eventDate.getDate() === date.getDate();
      });
      return { date, events: dayEvents };
    });
  }, [calendarCursor, displayEvents]);

  const changeMonth = (amount) => {
    setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <div className="feed-container events-page-shell">
      <div className="events-page">
        <header className="events-page__header">
          <div className="events-page__intro">
            <p className="scholarly-page-kicker">Community agenda</p>
            <h1>Upcoming Events</h1>
            <p className="muted-text">
              {isLoading ? 'Loading upcoming events…' : 'Lectures, workshops, and gatherings from your communities.'}
            </p>
          </div>
          <div className="events-page__header-tools">
            <div className="events-view-toggle" aria-label="Event view">
              <button
                type="button"
                className={view === 'agenda' ? 'active' : ''}
                onClick={() => setView('agenda')}
              >
                <List size={15} /> Agenda
              </button>
              <button
                type="button"
                className={view === 'calendar' ? 'active' : ''}
                onClick={() => setView('calendar')}
              >
                <CalendarRange size={15} /> Calendar
              </button>
            </div>
            <div className="events-page__count">
              <strong>{displayEvents.length}</strong>
              <span>upcoming</span>
            </div>
          </div>
        </header>

        {!sortedEvents.length && !isLoading && (
          <div className="sample-data-note">
            Showing sample events until your communities publish an event.
          </div>
        )}

        <div className="events-page__controls filter-toolbar filter-toolbar--filter-first">
          <label className="events-community-filter">
            <span>Community</span>
            <select value={communityFilter} onChange={handleCommunityFilterChange}>
              <option value={ALL_COMMUNITIES}>All communities</option>
              {communityOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="events-community-key" aria-label="Community color key">
            {(communityFilter === ALL_COMMUNITIES
              ? communityOptions
              : communityOptions.filter((option) => option.id === communityFilter)
            ).map((option) => (
              <span key={option.id}>
                <i style={{ '--event-community-color': option.color }} aria-hidden="true" />
                {option.label}
              </span>
            ))}
          </div>
        </div>

        {view === 'calendar' ? (
          <section className="events-calendar" aria-label="Events calendar">
            <div className="events-calendar__toolbar">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={17} />
              </button>
              <h2>{calendarCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
                <ChevronRight size={17} />
              </button>
            </div>
            <div className="events-calendar__weekdays" aria-hidden="true">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="events-calendar__grid">
              {monthCells.map(({ date, events: dayEvents }) => {
                const outsideMonth = date.getMonth() !== calendarCursor.getMonth();
                const isToday = new Date().toDateString() === date.toDateString();
                return (
                  <div
                    key={date.toISOString()}
                    className={`events-calendar__day${outsideMonth ? ' is-outside' : ''}${isToday ? ' is-today' : ''}`}
                  >
                    <time dateTime={date.toISOString()}>{date.getDate()}</time>
                    <div>
                      {dayEvents.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="events-calendar__event"
                          style={{ '--event-community-color': eventCommunityColor(item) }}
                          onClick={() => openEvent(item.id, 'calendar')}
                          aria-label={`${item.title}, ${eventCommunityLabel(item)}`}
                        >
                          <span className="events-calendar__event-time">
                            {new Date(item.date).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                              hourCycle: 'h23',
                            })}
                          </span>
                          <span className="events-calendar__event-title">{item.title}</span>
                          <span className="events-calendar__preview" role="tooltip">
                            <strong>{item.title}</strong>
                            <span>{eventCommunityLabel(item)}</span>
                            <span>{new Date(item.date).toLocaleString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hourCycle: 'h23',
                            })}</span>
                            {item.location && <span>{item.location}</span>}
                            {item.description && <small>{item.description}</small>}
                          </span>
                        </button>
                      ))}
                      {dayEvents.length > 3 && <small>+{dayEvents.length - 3} more</small>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="events-agenda" aria-label="Upcoming events">
            {displayEvents.map((item) => {
              const hasRsvped = hasRsvpedTo(item);
              const localRsvpCount = (rsvps[item.id] || []).length;
              const rsvpCount = Math.max(Number(item.rsvpCount) || 0, localRsvpCount);
              const eventDate = item.date ? new Date(item.date) : null;
              const isExpanded = expandedEventId === item.id;
              const isFocused = linkedEventId === item.id;
              const focusLabel = linkedEventSource === 'rail'
                ? 'Opened from Upcoming Events'
                : linkedEventSource === 'community'
                  ? `Opened from ${eventCommunityLabel(item)}`
                : linkedEventSource === 'calendar'
                  ? 'Opened from calendar'
                  : 'Selected event';
              return (
                <article
                  id={`event-${item.id}`}
                  key={item.id}
                  className={`event-agenda-card${isExpanded ? ' is-expanded' : ''}${isFocused ? ' is-focused' : ''}`}
                  aria-current={isFocused ? 'true' : undefined}
                  style={{ '--event-community-color': eventCommunityColor(item) }}
                >
                  <div className="event-agenda-card__date" aria-hidden="true">
                    <span>{eventDate ? eventDate.toLocaleDateString(undefined, { month: 'short' }) : 'TBD'}</span>
                    <strong>{eventDate ? eventDate.getDate() : '—'}</strong>
                  </div>
                  <div className="event-agenda-card__body">
                    <button
                      type="button"
                      className="event-agenda-card__summary"
                      onClick={() => {
                        const nextId = isExpanded ? '' : item.id;
                        openEvent(nextId, nextId ? 'agenda' : '');
                      }}
                      aria-expanded={isExpanded}
                    >
                      <span>
                        <span className="event-agenda-card__eyebrow">
                          <span>Event</span>
                          {item.sample && <span>Sample</span>}
                          <span className="event-community-pill">
                            <i aria-hidden="true" />
                            {eventCommunityLabel(item)}
                          </span>
                          {isFocused && <span className="event-agenda-card__focus-pill">{focusLabel}</span>}
                        </span>
                        <strong>{item.title}</strong>
                      </span>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <div className="event-agenda-card__meta">
                      <span><CalendarDays size={14} /> {eventDate ? eventDate.toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23',
                      }) : 'Date to be announced'}</span>
                      {item.scope === 'global' ? (
                        <span><Users size={14} /> Global event</span>
                      ) : (
                        <>
                          <span><Users size={14} /> Community: {communityName(item)}</span>
                          {item.subCommunityName && (
                            <span><Layers3 size={14} /> Sub-community: {item.subCommunityName}</span>
                          )}
                        </>
                      )}
                      {item.location && <span><MapPin size={14} /> {item.location}</span>}
                    </div>
                    {isExpanded && (
                      <div className="event-agenda-card__details">
                        {item.description && <p>{item.description}</p>}
                        {item.createdBy && <span>Hosted by {item.createdBy}</span>}
                      </div>
                    )}
                    {rsvpCount > 0 && <span className="event-agenda-card__attendance">{rsvpCount} going</span>}
                    {rsvpMessages[item.id] && (
                      <span className="event-agenda-card__message">{rsvpMessages[item.id]}</span>
                    )}
                  </div>
                  <div className="event-agenda-card__actions">
                    <button
                      type="button"
                      className={`event-agenda-card__rsvp${hasRsvped ? ' selected' : ''}`}
                      onClick={() => toggleRsvp(item)}
                    >
                      {hasRsvped ? 'Going' : 'RSVP'}
                    </button>
                    {hasRsvped && (
                      <EventJoinButton
                        event={item}
                        now={now}
                        className="event-agenda-card__join"
                        label="Join"
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

export default EventsFeed;
