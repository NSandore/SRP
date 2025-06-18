import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './CommunityRequests.css';

function CommunityRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

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
        if (expandedId === id) setExpandedId(null);
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
              <button
                className="request-toggle"
                onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
              >
                {expandedId === req.id ? 'Hide Details' : 'View Details'}
              </button>
              {expandedId === req.id && (
                <div className="request-details">
                  {req.tagline && <p><strong>Tagline:</strong> {req.tagline}</p>}
                  {req.location && <p><strong>Location:</strong> {req.location}</p>}
                  {req.website && (
                    <p>
                      <strong>Website:</strong>{' '}
                      <a href={req.website} target="_blank" rel="noopener noreferrer">
                        {req.website}
                      </a>
                    </p>
                  )}
                  {req.primary_color && (
                    <p>
                      <strong>Primary Color:</strong>{' '}
                      <span style={{ background: req.primary_color, padding: '0 0.5rem' }}>
                        {req.primary_color}
                      </span>
                    </p>
                  )}
                  {req.secondary_color && (
                    <p>
                      <strong>Secondary Color:</strong>{' '}
                      <span style={{ background: req.secondary_color, padding: '0 0.5rem' }}>
                        {req.secondary_color}
                      </span>
                    </p>
                  )}
                  <div className="request-actions">
                    <button onClick={() => handleAction(req.id, 'approve')}>Approve</button>
                    <button onClick={() => handleAction(req.id, 'decline')}>Decline</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CommunityRequests;
