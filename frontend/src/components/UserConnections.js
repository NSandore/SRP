import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Connections.css';
import { FaEllipsisV } from 'react-icons/fa';
import useOnClickOutside from '../hooks/useOnClickOutside';
import { buildAvatarSrc } from '../utils/avatar';

function UserConnections({ userData }) {
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [userDetails, setUserDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const segmentRef = useRef(null);
  useOnClickOutside(menuRef, () => setOpenMenuId(null));

  useEffect(() => {
    if (!userData) return;
    const fetchAll = async () => {
      try {
        const connRes = await axios.get(`/api/fetch_user_connections.php?user_id=${userData.user_id}`);
        if (connRes.data.success) {
          setConnections(connRes.data.connections);
        }
        const reqRes = await axios.get(`/api/fetch_connection_requests.php?user_id=${userData.user_id}`);
        if (reqRes.data.success) {
          setIncoming(reqRes.data.incoming);
          setOutgoing(reqRes.data.outgoing);
          const ids = [
            ...connRes.data.connections,
            ...reqRes.data.incoming.map(r => r.user_id),
            ...reqRes.data.outgoing.map(r => r.user_id)
          ];
          fetchUserDetails(ids);
        }
      } catch (err) {
        console.error('Error fetching connections:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [userData]);

  const fetchUserDetails = async (ids) => {
    const info = { ...userDetails };
    for (let uid of ids) {
      if (info[uid]) continue;
      try {
        const res = await axios.get(`/api/fetch_user.php?user_id=${uid}`);
        if (res.data.success) info[uid] = res.data.user;
      } catch (err) {}
    }
    setUserDetails(info);
  };

  const acceptRequest = async (connectionId) => {
    try {
      await axios.post('/api/accept_connection.php', { connection_id: connectionId }, { withCredentials: true });
      setIncoming(prev => prev.filter(r => r.connection_id !== connectionId));
      setConnections(prev => [...prev, incoming.find(r => r.connection_id === connectionId).user_id]);
    } catch (err) {
      console.error('Error accepting connection:', err);
    }
  };

  const cancelRequest = async (connectionId, isOutgoing = false) => {
    try {
      await axios.post('/api/cancel_connection.php', { connection_id: connectionId }, { withCredentials: true });
      if (isOutgoing) {
        setOutgoing(prev => prev.filter(r => r.connection_id !== connectionId));
      } else {
        setIncoming(prev => prev.filter(r => r.connection_id !== connectionId));
      }
    } catch (err) {
      console.error('Error cancelling request:', err);
    }
  };

  const removeConnection = async (uid) => {
    try {
      await axios.post(
        '/api/remove_connection.php',
        { user_id1: userData.user_id, user_id2: uid },
        { withCredentials: true }
      );
      setConnections(prev => prev.filter(id => id !== uid));
    } catch (err) {
      console.error('Error removing connection:', err);
    }
  };

  const updateSegmentIndicator = useCallback(() => {
    const container = segmentRef.current;
    if (!container) return;
    const activeChip = container.querySelector('.chip.active');
    if (!activeChip) return;
    const containerRect = container.getBoundingClientRect();
    const chipRect = activeChip.getBoundingClientRect();
    const left = Math.max(chipRect.left - containerRect.left, 0);
    const width = chipRect.width;
    container.style.setProperty('--seg-left', `${left}px`);
    container.style.setProperty('--seg-width', `${width}px`);
  }, []);

  const scheduleSegmentUpdate = useCallback(() => {
    const run = () => updateSegmentIndicator();
    const raf1 = requestAnimationFrame(run);
    const raf2 = requestAnimationFrame(run);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [updateSegmentIndicator]);

  useEffect(() => {
    return scheduleSegmentUpdate();
  }, [activeTab, scheduleSegmentUpdate]);

  useEffect(() => {
    const handleResize = () => updateSegmentIndicator();
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [updateSegmentIndicator]);

  return (
    <div className="feed-container connections-container">
      <div>
        <h1 className="section-title" style={{ marginBottom: 4 }}>Connections</h1>
        <p className="muted-text" style={{ marginTop: 0, marginBottom: 0 }}>
          Manage your network, incoming invites, and pending requests in one place.
        </p>
      </div>
      <div className="section-controls section-controls-sticky connections-controls">
        <div
          ref={segmentRef}
          className="chips-row segmented-control"
          style={{
            '--seg-count': 3,
            '--seg-index': activeTab === 'connections' ? 0 : activeTab === 'incoming' ? 1 : 2
          }}
        >
          <button
            type="button"
            className={`chip ${activeTab === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveTab('connections')}
          >
            Connections
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'incoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('incoming')}
          >
            Incoming
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'outgoing' ? 'active' : ''}`}
            onClick={() => setActiveTab('outgoing')}
          >
            Pending
          </button>
        </div>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="connections-list">
          {activeTab === 'connections' && (
            connections.length === 0 ? (
              <p>No connections yet.</p>
            ) : (
              <ul>
                {connections.map(uid => {
                  const user = userDetails[uid] || {};
                  return (
                    <li key={uid} style={{ position: 'relative' }}>
                      <img
                        src={buildAvatarSrc(user.avatar_path)}
                        alt={`${user.first_name || ''} ${user.last_name || ''}`}
                        className="connection-avatar"
                      />
                      <div className="connection-info">
                        <p className="connection-name">
                          <Link to={`/user/${uid}`}>{user.first_name} {user.last_name}</Link>
                          {/* Presence temporarily disabled */}
                        </p>
                        <p className="connection-headline">{user.headline || 'No headline'}</p>
                      </div>
                      <FaEllipsisV
                        className="menu-icon"
                        onClick={() => setOpenMenuId(openMenuId === uid ? null : uid)}
                        style={{ position: 'absolute', top: '8px', right: '8px' }}
                      />
                      {openMenuId === uid && (
                        <div ref={menuRef} className="dropdown-menu">
                          <Link to={`/messages?user=${uid}`} className="dropdown-item">
                            Message
                          </Link>
                          <button className="dropdown-item" onClick={() => removeConnection(uid)}>
                            Remove Connection
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          )}
          {activeTab === 'incoming' && (
            incoming.length === 0 ? (
              <p>No incoming requests.</p>
            ) : (
              <ul>
                {incoming.map(req => {
                  const user = userDetails[req.user_id] || {};
                  return (
                    <li key={req.connection_id}>
                      <img
                        src={buildAvatarSrc(user.avatar_path)}
                        alt={`${user.first_name || ''} ${user.last_name || ''}`}
                        className="connection-avatar"
                      />
                      <div className="connection-info">
                        <p className="connection-name">
                          <Link to={`/user/${req.user_id}`}>{user.first_name} {user.last_name}</Link>
                          {/* Presence temporarily disabled */}
                        </p>
                        <p className="connection-headline">{user.headline || 'No headline'}</p>
                      </div>
                      <div className="connection-actions">
                        <button className="follow-button" onClick={() => acceptRequest(req.connection_id)}>Accept</button>
                        <button className="follow-button unfollow" onClick={() => cancelRequest(req.connection_id)}>Decline</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}
          {activeTab === 'outgoing' && (
            outgoing.length === 0 ? (
              <p>No pending requests.</p>
            ) : (
              <ul>
                {outgoing.map(req => {
                  const user = userDetails[req.user_id] || {};
                  return (
                    <li key={req.connection_id}>
                      <img
                        src={buildAvatarSrc(user.avatar_path)}
                        alt={`${user.first_name || ''} ${user.last_name || ''}`}
                        className="connection-avatar"
                      />
                      <div className="connection-info">
                        <p className="connection-name">
                          <Link to={`/user/${req.user_id}`}>{user.first_name} {user.last_name}</Link>
                          {/* Presence temporarily disabled */}
                        </p>
                        <p className="connection-headline">{user.headline || 'No headline'}</p>
                      </div>
                      <div className="connection-actions">
                        <button className="follow-button unfollow" onClick={() => cancelRequest(req.connection_id, true)}>Unsend</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default UserConnections;
