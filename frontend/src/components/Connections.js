import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Connections.css';

function Connections({ userData }) {
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('following'); // Default tab
  const [userDetails, setUserDetails] = useState({}); // Store user details

  useEffect(() => {
    if (!userData) return;

    const fetchConnections = async () => {
      try {
        const response = await axios.get(
          `http://172.16.11.133/api/fetch_connections_list.php?user_id=${userData.user_id}`,
          { withCredentials: true }
        );

        if (response.data.success) {
          setFollowing(response.data.following);
          setFollowers(response.data.followers);

          // Fetch user details for all IDs
          const allUserIds = [...response.data.following, ...response.data.followers];
          fetchUserDetails(allUserIds);
        } else {
          console.error('Failed to fetch connections:', response.data.error);
        }
      } catch (error) {
        console.error('Error fetching connections:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, [userData]);

  const fetchUserDetails = async (userIds) => {
    try {
      const userInfo = {};
      await Promise.all(
        userIds.map(async (userId) => {
          const response = await axios.get(
            `http://172.16.11.133/api/fetch_user.php?user_id=${userId}`,
            { withCredentials: true }
          );

          if (response.data.success) {
            userInfo[userId] = response.data.user;
          }
        })
      );
      setUserDetails(userInfo);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const handleFollowToggle = async (userId, isFollowing) => {
    try {
      const endpoint = `http://172.16.11.133/api/${isFollowing ? 'unfollow_user' : 'follow_user'}.php`;
  
      const response = await axios.post(
        endpoint,
        {
          follower_id: userData.user_id,  // Change 'user_id' to 'follower_id'
          followed_user_id: userId       // Change 'target_user_id' to 'followed_user_id'
        },
        { withCredentials: true }
      );
  
      if (response.data.success) {
        setFollowing((prev) =>
          isFollowing ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
      } else {
        console.error('Error toggling follow status:', response.data.error);
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
    }
  };  

  return (
    <div className="connections-container">
      <div className="feed-header">
        <h2>Connections</h2>
        <div className="feed-toggle-buttons">
          <button
            className={`feed-option-button ${activeTab === 'following' ? 'active' : ''}`}
            onClick={() => setActiveTab('following')}
          >
            Following
          </button>
          <button
            className={`feed-option-button ${activeTab === 'followers' ? 'active' : ''}`}
            onClick={() => setActiveTab('followers')}
          >
            Followers
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading connections...</p>
      ) : (
        <div className="connections-list">
          {activeTab === 'following' ? (
            following.length > 0 ? (
              <ul>
                {following.map((userId) => {
                  const user = userDetails[userId] || {};
                  return (
                    <li key={userId}>
                      <img
                        src={user.avatar_path || "/uploads/avatars/default-avatar.png"}
                        alt={`${user.first_name || 'User'} ${user.last_name || ''}`}
                        className="connection-avatar"
                      />
                      <div className="connection-info">
                        <p className="connection-name">
                          <Link to={`/user/${userId}`}>
                            {user.first_name} {user.last_name}
                          </Link>
                        </p>
                        <p className="connection-headline">{user.headline || 'No headline'}</p>
                      </div>
                      <div className="connection-actions">
                        <button
                          className="follow-button unfollow"
                          onClick={() => handleFollowToggle(userId, true)}
                        >
                          Unfollow
                        </button>
                        <button className="message-button">Message</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>You are not following anyone yet.</p>
            )
          ) : (
            followers.length > 0 ? (
              <ul>
                {followers.map((userId) => {
                  const user = userDetails[userId] || {};
                  return (
                    <li key={userId}>
                      <img
                        src={user.avatar_path || "/uploads/avatars/default-avatar.png"}
                        alt={`${user.first_name || 'User'} ${user.last_name || ''}`}
                        className="connection-avatar"
                      />
                      <div className="connection-info">
                        <p className="connection-name">
                          <Link to={`/user/${userId}`}>
                            {user.first_name} {user.last_name}
                          </Link>
                        </p>
                        <p className="connection-headline">{user.headline || 'No headline'}</p>
                      </div>
                      <button className="message-button">
                        Message
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>You have no followers yet.</p>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default Connections;
