import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

function EventManagement({ userData }) {
  const isSuperAdmin = Number(userData?.role_id) === 1;
  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(userData?.admin_community_ids)) return [];
    return userData.admin_community_ids.map((id) => String(id));
  }, [userData]);
  const isCommunityAdmin = adminCommunityIds.length > 0;
  const canManage = isSuperAdmin || isCommunityAdmin;
  const itemTypes = [
    { value: 'event', label: 'Event / Webinar' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'poll', label: 'Poll' },
  ];

  const [loadingCommunities, setLoadingCommunities] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [allCommunities, setAllCommunities] = useState([]);
  const [followedCommunities, setFollowedCommunities] = useState([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [remoteAnnouncements, setRemoteAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [message, setMessage] = useState(null);
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
  const initialForm = {
    type: 'event',
    title: '',
    description: '',
    date: '',
    location: '',
    scope: isSuperAdmin ? 'global' : 'community',
    communityId: adminCommunityIds[0] || '',
    communityName: '',
    pollOptions: '',
    showResults: false,
  };

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      scope: isSuperAdmin ? prev.scope : 'community',
      communityId: adminCommunityIds[0] || '',
    }));
  }, [isSuperAdmin, adminCommunityIds]);

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
    if (isSuperAdmin) return true;
    if (!isCommunityAdmin) return false;
    return event.scope === 'community' && adminCommunityIds.includes(String(event.communityId || ''));
  };

  const manageableEvents = useMemo(() => events.filter((evt) => canManageEvent(evt)), [events, isSuperAdmin, isCommunityAdmin, adminCommunityIds, canManageEvent]);

  const handleFieldChange = (key) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [key]: value }));
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
    setForm({
      ...initialForm,
      scope: isSuperAdmin ? 'global' : 'community',
      communityId: adminCommunityIds[0] || '',
    });
  };

  const formatDateTime = (value) => {
    if (!value) return 'Date TBD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const getAudienceLabel = (event) => {
    if (event.scope === 'global') return 'Global';
    return event.communityName || `Community ${event.communityId}`;
  };

  const permittedCommunities = useMemo(() => {
    if (isSuperAdmin) return allCommunities;
    return allCommunities.filter((c) => adminCommunityIds.includes(String(c.id)));
  }, [allCommunities, adminCommunityIds, isSuperAdmin]);

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
    return followedCommunities.includes(String(communityId));
  };

  const isVisibleToUser = (item) => {
    if (item.scope === 'global') return true;
    if (isSuperAdmin) return true;
    if (adminCommunityIds.includes(String(item.communityId || ''))) return true;
    return followsCommunity(item.communityId);
  };

  const visibleItems = useMemo(
    () => events.filter((evt) => isVisibleToUser(evt)),
    [events, isSuperAdmin, adminCommunityIds, followedCommunities, isVisibleToUser]
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
    });
    setMessage({ type: 'info', text: 'Editing an existing item.' });
  };

  const handleDelete = (eventId) => {
    const target = events.find((evt) => evt.id === eventId);
    if (target && !canManageEvent(target)) {
      setMessage({ type: 'error', text: 'You do not have permission to delete this item.' });
      return;
    }
    setEvents((prev) => prev.filter((evt) => evt.id !== eventId));
    if (editingId === eventId) {
      resetForm();
    }
    setMessage({ type: 'success', text: 'Event deleted.' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin && !isCommunityAdmin) {
      setMessage({ type: 'error', text: 'You need admin access to manage items.' });
      return;
    }

    const type = form.type || 'event';
    const scope = isSuperAdmin ? form.scope : 'community';
    const title = form.title.trim();
    const description = form.description.trim();
    const location = form.location.trim();
    const date = form.date;
    let communityId = scope === 'community' ? String(form.communityId || '').trim() : '';
    let communityName = form.communityName.trim();

    if (!title) {
      setMessage({ type: 'error', text: 'Please add a title for this item.' });
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
      if (!isSuperAdmin && !adminCommunityIds.includes(communityId)) {
        setMessage({ type: 'error', text: 'You can only manage items for communities you admin.' });
        return;
      }
      const option = permittedCommunities.find((c) => String(c.id) === communityId);
      if (option) {
        communityName = communityName || option.name;
      }
      communityName = communityName || `Community ${communityId}`;
    }

    const payload = {
      id: editingId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
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
      createdBy: `${userData?.first_name || 'Unknown'} ${userData?.last_name || ''}`.trim() || 'Unknown user',
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
  return (
    <div className="event-management">
      <div className="event-management__header">
        <div>
          <h2>Event & content management</h2>
          <p className="muted-text">
            {canManage
              ? isSuperAdmin
                ? 'Super admins can publish announcements, polls, and events for any community or globally.'
                : 'Admins can manage announcements, polls, and events for the communities they oversee.'
              : 'Viewing items from communities you follow. Global items appear for everyone.'}
          </p>
        </div>
        <div className="event-management__badge">
          {canManage ? (isSuperAdmin ? 'Super admin' : 'Community admin') : 'Member'}
        </div>
      </div>

      {message && (
        <div className={`event-management__alert ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="event-management__grid">
        {canManage && (
          <section className="event-management__panel">
            <div className="event-management__panel-head">
              <div>
                <h3>{editingId ? 'Edit item' : 'Create item'}</h3>
                <p className="muted-text">
                  {isSuperAdmin
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
              <div className="event-management__field">
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
              <div className="event-management__field">
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
                {isSuperAdmin ? (
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
              {(form.scope === 'community' || !isSuperAdmin) && (
                <div className="event-management__field">
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
                    {isSuperAdmin
                      ? 'Search any community to target your item, or keep audience as Global.'
                      : 'Admins can only post to communities they manage.'}
                  </p>
                </div>
              )}
              <div className="event-management__actions">
                <button type="submit" className="primary-button">
                  {editingId ? 'Save changes' : 'Create item'}
                </button>
                <button type="button" className="ghost-button" onClick={resetForm}>
                  Clear
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="event-management__panel">
          <div className="event-management__panel-head">
            <div>
              <h3>Active items</h3>
              <p className="muted-text">
                {itemsToShow.length
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
          </div>
          <div className="event-management__list">
            {itemsToShow.length === 0 && (
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
            {itemsToShow.map((event) => {
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
  );
}

export default EventManagement;
