import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './CommunityRequests.css';

function CommunityRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await axios.get('/api/get_community_requests.php', { withCredentials: true });
        if (res.data.success) {
          setRequests(res.data.requests);
        }
      } catch (err) {
        console.error('Error fetching requests:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const handleAction = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;
    try {
      const res = await axios.post('/api/handle_community_request.php', { request_id: id, action }, { withCredentials: true });
      if (res.data.success) {
        setRequests(prev => prev.filter(r => r.id !== id));
      } else {
        alert(res.data.error || 'Error processing request');
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <div className="requests-container">
      <h2>Community Creation Requests</h2>
      {loading ? (
        <p>Loading...</p>
      ) : requests.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        <ul className="request-list">
          {requests.map(req => (
            <li key={req.id} className="request-item">
              <h4>{req.name} ({req.community_type})</h4>
              <p>{req.description}</p>
              <div className="request-actions">
                <button onClick={() => handleAction(req.id, 'approve')}>Approve</button>
                <button onClick={() => handleAction(req.id, 'decline')}>Decline</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CommunityRequests;
