import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import './Connections.css';
import { FaEllipsisV } from 'react-icons/fa';
import useOnClickOutside from '../hooks/useOnClickOutside';
import { buildAvatarSrc } from '../utils/avatar';

function UserConnections({ userData }) {
  const [activeTab, setActiveTab] = useState('connections');
  const [search, setSearch] = useState('');
  const [connections, setConnections] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [userDetails, setUserDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const filterSegmentRef = useRef(null);
  useOnClickOutside(menuRef, () => setOpenMenuId(null));

  useEffect(() => {
    if (!userData?.user_id) return;
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [connectionResponse, requestResponse] = await Promise.all([
          axios.get(`/api/fetch_user_connections.php?user_id=${userData.user_id}`),
          axios.get(`/api/fetch_connection_requests.php?user_id=${userData.user_id}`),
        ]);
        const connectionIds = connectionResponse.data?.success
          ? connectionResponse.data.connections || []
          : [];
        const incomingRequests = requestResponse.data?.success
          ? requestResponse.data.incoming || []
          : [];
        const outgoingRequests = requestResponse.data?.success
          ? requestResponse.data.outgoing || []
          : [];
        if (cancelled) return;
        setConnections(connectionIds);
        setIncoming(incomingRequests);
        setOutgoing(outgoingRequests);

        const ids = Array.from(new Set([
          ...connectionIds,
          ...incomingRequests.map((request) => request.user_id),
          ...outgoingRequests.map((request) => request.user_id),
        ].map(String)));
        const responses = await Promise.all(ids.map(async (userId) => {
          try {
            const response = await axios.get(`/api/fetch_user.php?user_id=${userId}`);
            return response.data?.success ? [userId, response.data.user] : null;
          } catch {
            return null;
          }
        }));
        if (!cancelled) {
          setUserDetails(Object.fromEntries(responses.filter(Boolean)));
        }
      } catch (error) {
        console.error('Error fetching connections:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [userData?.user_id]);

  const acceptRequest = async (connectionId) => {
    try {
      await axios.post('/api/accept_connection.php', { connection_id: connectionId }, { withCredentials: true });
      const request = incoming.find((item) => item.connection_id === connectionId);
      setIncoming((prev) => prev.filter((item) => item.connection_id !== connectionId));
      if (request) setConnections((prev) => [...prev, request.user_id]);
      window.dispatchEvent(new CustomEvent('sidebarCountsUpdated'));
    } catch (error) {
      console.error('Error accepting connection:', error);
    }
  };

  const cancelRequest = async (connectionId, isOutgoing = false) => {
    try {
      await axios.post('/api/cancel_connection.php', { connection_id: connectionId }, { withCredentials: true });
      if (isOutgoing) {
        setOutgoing((prev) => prev.filter((item) => item.connection_id !== connectionId));
      } else {
        setIncoming((prev) => prev.filter((item) => item.connection_id !== connectionId));
        window.dispatchEvent(new CustomEvent('sidebarCountsUpdated'));
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
    }
  };

  const removeConnection = async (userId) => {
    try {
      await axios.post(
        '/api/remove_connection.php',
        { user_id1: userData.user_id, user_id2: userId },
        { withCredentials: true }
      );
      setConnections((prev) => prev.filter((id) => String(id) !== String(userId)));
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error removing connection:', error);
    }
  };

  const tabs = [
    { id: 'connections', label: 'Connections', count: connections.length },
    { id: 'incoming', label: 'Incoming', count: incoming.length },
    { id: 'outgoing', label: 'Pending', count: outgoing.length },
  ];

  const activeRecords = useMemo(() => {
    if (activeTab === 'connections') {
      return connections.map((userId) => ({ key: String(userId), userId: String(userId) }));
    }
    const source = activeTab === 'incoming' ? incoming : outgoing;
    return source.map((request) => ({
      key: String(request.connection_id),
      userId: String(request.user_id),
      connectionId: request.connection_id,
    }));
  }, [activeTab, connections, incoming, outgoing]);

  const visibleRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activeRecords;
    return activeRecords.filter((record) => {
      const user = userDetails[record.userId] || {};
      return `${user.first_name || ''} ${user.last_name || ''} ${user.headline || ''}`
        .toLowerCase()
        .includes(term);
    });
  }, [activeRecords, search, userDetails]);

  const emptyCopy = search.trim()
    ? 'No people match this search.'
    : activeTab === 'connections'
      ? 'No connections yet.'
      : activeTab === 'incoming'
        ? 'No incoming requests.'
        : 'No pending requests.';
  const countLabel = activeTab === 'connections'
    ? 'connections in view'
    : activeTab === 'incoming'
      ? 'incoming requests'
      : 'pending requests';

  const updateSegmentIndicator = useCallback(() => {
    const container = filterSegmentRef.current;
    if (!container) return;
    const activeChip = container.querySelector('.chip.active');
    if (!activeChip) return;
    const containerRect = container.getBoundingClientRect();
    const chipRect = activeChip.getBoundingClientRect();
    container.style.setProperty('--seg-left', `${Math.max(chipRect.left - containerRect.left, 0)}px`);
    container.style.setProperty('--seg-width', `${chipRect.width}px`);
  }, []);

  useEffect(() => {
    const run = () => updateSegmentIndicator();
    const raf1 = requestAnimationFrame(run);
    const raf2 = requestAnimationFrame(run);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeTab, connections.length, incoming.length, outgoing.length, updateSegmentIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateSegmentIndicator);
    updateSegmentIndicator();
    return () => window.removeEventListener('resize', updateSegmentIndicator);
  }, [updateSegmentIndicator]);

  return (
    <main className="scholarly-page scholarly-connections-page">
      <div className="feed-container scholarly-page-panel connections-page-panel">
        <header className="scholarly-page-header connections-directory__header">
          <div>
            <p className="scholarly-page-kicker">Your academic network</p>
            <h1>Connections</h1>
            <p>Keep up with peers, collaborators, and pending introductions.</p>
          </div>
          <div className="scholarly-page-count connections-directory__count" aria-live="polite">
            <strong>{visibleRecords.length}</strong>
            <span>{countLabel}</span>
          </div>
        </header>

        <div className="connections-directory">
          <div className="connections-directory__tools section-controls scholarly-controls filter-toolbar filter-toolbar--filter-first">
            <div
              ref={filterSegmentRef}
              className="connections-directory__tabs admin-review__filters chips-row segmented-control"
              style={{
                '--seg-count': tabs.length,
                '--seg-index': tabs.findIndex((tab) => tab.id === activeTab)
              }}
              role="tablist"
              aria-label="Connection views"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`chip ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setOpenMenuId(null);
                  }}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                >
                  {tab.label} <span>{tab.count}</span>
                </button>
              ))}
            </div>
            <label className="connections-directory__search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search connections</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search people"
              />
            </label>
          </div>

          {loading ? (
            <div className="connections-directory__empty">Loading your network…</div>
          ) : visibleRecords.length === 0 ? (
            <div className="connections-directory__empty">{emptyCopy}</div>
          ) : (
            <ul className="connections-directory__list">
              {visibleRecords.map((record) => {
                const user = userDetails[record.userId] || {};
                const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'StudentSphere member';
                return (
                  <li key={record.key} className="connections-directory__row">
                    <Link to={`/user/${record.userId}`} className="connections-directory__identity">
                      <img
                        src={buildAvatarSrc(user.avatar_path)}
                        alt=""
                        className="connection-avatar"
                      />
                      <span>
                        <strong>{name}</strong>
                        <small>{user.headline || 'StudentSphere member'}</small>
                      </span>
                    </Link>

                    {activeTab === 'incoming' && (
                      <div className="connections-directory__actions">
                        <button type="button" className="primary-button" onClick={() => acceptRequest(record.connectionId)}>
                          Accept
                        </button>
                        <button type="button" className="ghost-button" onClick={() => cancelRequest(record.connectionId)}>
                          Decline
                        </button>
                      </div>
                    )}

                    {activeTab === 'outgoing' && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => cancelRequest(record.connectionId, true)}
                      >
                        Unsend
                      </button>
                    )}

                    {activeTab === 'connections' && (
                      <div
                        className="connections-directory__menu"
                        ref={openMenuId === record.userId ? menuRef : null}
                      >
                        <button
                          type="button"
                          className="connections-directory__menu-trigger"
                          onClick={() => setOpenMenuId(openMenuId === record.userId ? null : record.userId)}
                          aria-label={`Actions for ${name}`}
                          aria-expanded={openMenuId === record.userId}
                        >
                          <FaEllipsisV aria-hidden="true" />
                        </button>
                        {openMenuId === record.userId && (
                          <div className="dropdown-menu connections-directory__menu-popover">
                            <Link to={`/messages?user=${record.userId}`} className="dropdown-item">
                              Message
                            </Link>
                            <button type="button" className="dropdown-item" onClick={() => removeConnection(record.userId)}>
                              Remove connection
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

export default UserConnections;
