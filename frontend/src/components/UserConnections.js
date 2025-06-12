import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Connections.css';

function UserConnections({ userData }) {
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [userDetails, setUserDetails] = useState({});
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="connections-container">
      <div className="feed-header">
        <h2>Connections</h2>
        <div className="feed-toggle-buttons">
          <button
            className={`feed-option-button ${activeTab === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveTab('connections')}
          >
            Connections
          </button>
          <button
            className={`feed-option-button ${activeTab === 'incoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('incoming')}
          >
            Incoming Requests
          </button>
          <button
            className={`feed-option-button ${activeTab === 'outgoing' ? 'active' : ''}`}
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
                    <li key={uid}>
                      <img
                        src={user.avatar_path || '/uploads/avatars/default-avatar.png'}
                        alt={`${user.first_name || ''} ${user.last_name || ''}`}
                        className="connection-avatar"
                      />
                      <div className="connection-info">
                        <p className="connection-name">
                          <Link to={`/user/${uid}`}>{user.first_name} {user.last_name}</Link>
                        </p>
                        <p className="connection-headline">{user.headline || 'No headline'}</p>
                      </div>
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
                        src={user.avatar_path || '/uploads/avatars/default-avatar.png'}
                        alt={`${user.first_name || ''} ${user.last_name || ''}`}
                        className="connection-avatar"
                      />
                      <div className="connection-info">
                        <p className="connection-name">
                          <Link to={`/user/${req.user_id}`}>{user.first_name} {user.last_name}</Link>
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
                        src={user.avatar_path || '/uploads/avatars/default-avatar.png'}
                        alt={`${user.first_name || ''} ${user.last_name || ''}`}
                        className="connection-avatar"
                      />
                      <div className="connection-info">
                        <p className="connection-name">
                          <Link to={`/user/${req.user_id}`}>{user.first_name} {user.last_name}</Link>
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
