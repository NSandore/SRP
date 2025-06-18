import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './CommunityRequests.css';

function CommunityRequests({ userData }) {
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/fetch_community_requests.php', { withCredentials: true });
      if (res.data.success) {
        setRequests(res.data.requests);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  useEffect(() => {
    if (userData) fetchRequests();
  }, [userData]);

  const handleAction = async (request_id, action) => {
    try {
      const res = await axios.post('/api/handle_community_request.php', { request_id, action }, { withCredentials: true });
      if (res.data.success) fetchRequests();
    } catch (err) {
      console.error('Error updating request:', err);
    }
  };

  return (
    <main>
      <div className="feed-container">
        <h2>Community Creation Requests</h2>
        {requests.length === 0 ? (
          <p>No pending requests.</p>
        ) : (
          <ul className="request-list">
            {requests.map((r) => (
              <li key={r.request_id} className="request-item">
                <h4>{r.name} ({r.type})</h4>
                <p>{r.description}</p>
                <div className="request-actions">
                  <button onClick={() => handleAction(r.request_id, 'approve')}>Approve</button>
                  <button onClick={() => handleAction(r.request_id, 'decline')}>Decline</button>
                  <button onClick={() => navigate(`/messages?user=${r.user_id}`)}>Message</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default CommunityRequests;
