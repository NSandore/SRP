import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { isSuperAdmin } from '../constants/roles';

const STORAGE_KEY = 'managedEvents';
const RSVP_KEY = 'managedEventRsvps';

const datePrefix = (type) => {
  if (type === 'poll') return 'Closes';
  if (type === 'announcement') return 'Publishes';
  return 'Occurs';
};

function EventsFeed({ userData }) {
  const isSuperAdminUser = isSuperAdmin(userData?.role_id);
  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(userData?.admin_community_ids)) return [];
    return userData.admin_community_ids.map((id) => String(id));
  }, [userData]);

  const [items, setItems] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [rsvps, setRsvps] = useState(() => {
    try {
      const raw = localStorage.getItem(RSVP_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const [rsvpMessages, setRsvpMessages] = useState({});

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
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    readLocalItems();
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) readLocalItems();
    };
    const handleCustomUpdate = (e) => {
      if (e.detail?.key === STORAGE_KEY || !e.detail) {
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
      if (!userData?.user_id) {
        setFollowed([]);
        return;
      }
      setLoadingFollowed(true);
      try {
        const res = await axios.get(`/api/followed_communities.php?user_id=${userData.user_id}`);
        if (!isCancelled) {
          const list = Array.isArray(res.data) ? res.data : [];
          const ids = list.map((c) => String(c.community_id ?? c.id ?? '')).filter(Boolean);
          setFollowed(ids);
        }
      } catch (err) {
        console.error('Unable to fetch followed communities', err);
        if (!isCancelled) setFollowed([]);
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
    try {
      localStorage.setItem(RSVP_KEY, JSON.stringify(rsvps));
    } catch {
      // ignore storage errors
    }
  }, [rsvps]);

  const followsCommunity = (communityId) => {
    if (!communityId) return false;
    if (adminCommunityIds.includes(String(communityId))) return true;
    return followed.includes(String(communityId));
  };

  const isVisible = (item) => {
    if (item.scope === 'global') return true;
    if (!item.communityId) return false;
    if (isSuperAdminUser) return true;
    if (adminCommunityIds.includes(String(item.communityId))) return true;
    return followsCommunity(item.communityId);
  };

  const visibleItems = useMemo(
    () => items.filter((i) => isVisible(i)),
    [items, adminCommunityIds, followed, isSuperAdminUser]
  );

  const sortedEvents = useMemo(() => {
    const isUpcomingEvent = (item) => {
      if (item.type === 'announcement') return true;
      const date = item.date || item.createdAt;
      if (!date) return true;
      const start = Date.parse(date);
      if (Number.isNaN(start)) return true;
      const durationMinutes = item.zoomDuration ? Number(item.zoomDuration) : 60;
      const end = start + Math.max(durationMinutes, 0) * 60 * 1000;
      return end > now;
    };
    const rank = (item) => {
      const date = item.date || item.createdAt;
      if (date) {
        const t = Date.parse(date);
        if (!Number.isNaN(t)) return t;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    return visibleItems
      .filter((i) => i.type !== 'poll')
      .filter((i) => isUpcomingEvent(i))
      .sort((a, b) => rank(a) - rank(b));
  }, [visibleItems, now]);

  const scopeLabel = (item) =>
    item.scope === 'global'
      ? 'Global'
      : item.communityName || (item.communityId ? `Community ${item.communityId}` : 'Community item');

  const renderItemMeta = (item) => {
    const dateText = item.date ? `${datePrefix(item.type)} ${new Date(item.date).toLocaleString()}` : '';
    const baseType = item.type === 'announcement' ? 'Announcement' : 'Event';
    return `${baseType} · ${scopeLabel(item)}${dateText ? ` · ${dateText}` : ''}`;
  };

  const userId = userData?.user_id ? String(userData.user_id) : '';
  const toggleRsvp = async (eventId) => {
    if (!userId) {
      setRsvpMessages((prev) => ({ ...prev, [eventId]: 'Log in or sign up to RSVP.' }));
      return;
    }
    const currentList = rsvps[eventId] || [];
    const hasRsvped = currentList.includes(userId);
    try {
      await postWithFallback(
        '/api/rsvp_event.php',
        '/rsvp_event.php',
        { event_id: eventId, action: hasRsvped ? 'cancel' : 'register' }
      );
    } catch (err) {
      console.error('Unable to update RSVP', err);
      setRsvpMessages((prev) => ({ ...prev, [eventId]: 'Unable to update RSVP right now.' }));
      return;
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

  return (
    <div className="feed-container">
      <div className="events-page">
        <div className="events-page__header">
          <h2>Upcoming Events</h2>
          <p className="muted-text">
            {loadingFollowed ? 'Loading upcoming events...' : 'Events and announcements from your communities.'}
          </p>
        </div>
        <section className="widget-card events-feed-card" aria-labelledby="events-feed-header">
          <div
            id="events-feed-header"
            className="widget-header"
            style={{ backgroundColor: '#2563EB' }}
          >
            <h3 className="widget-title">Upcoming Events</h3>
          </div>
          <div className="widget-body">
            {!sortedEvents.length && (
              <div className="widget-item-meta">
                {loadingFollowed ? 'Loading your upcoming events...' : 'No upcoming events yet.'}
              </div>
            )}
            <ul className="widget-list" aria-label="Upcoming events">
              {sortedEvents.map((item) => {
                const rsvpList = rsvps[item.id] || [];
                const rsvpCount = rsvpList.length;
                const hasRsvped = Boolean(userId && rsvpList.includes(userId));
                const rsvpMessage = rsvpMessages[item.id];
                const isEvent = item.type !== 'announcement' && item.type !== 'poll';
                return (
                  <li
                    key={item.id}
                    className="widget-list-item"
                    style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '8px' }}
                  >
                    <div className="widget-item-title">{item.title}</div>
                    <div className="widget-item-meta">{renderItemMeta(item)}</div>
                    {item.description && (
                      <div className="widget-item-meta" style={{ color: 'var(--text-color)' }}>
                        {item.description.length > 180 ? `${item.description.slice(0, 180)}…` : item.description}
                      </div>
                    )}
                    {isEvent && (
                      <div className="widget-item-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`widget-cta${hasRsvped ? ' selected' : ''}`}
                          onClick={() => toggleRsvp(item.id)}
                        >
                          {hasRsvped ? 'Going' : 'RSVP'}
                        </button>
                        {item.zoomJoinUrl && (
                          <a
                            href={item.zoomJoinUrl}
                            className="widget-cta secondary"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Join Zoom
                          </a>
                        )}
                      </div>
                    )}
                    {isEvent && rsvpCount > 0 && (
                      <div className="widget-item-meta">{rsvpCount} going</div>
                    )}
                    {isEvent && rsvpMessage && (
                      <div className="widget-item-meta">{rsvpMessage}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

export default EventsFeed;
