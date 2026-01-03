// src/components/FollowsView.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FollowsView.css';

function FollowsView({ userData }) {
  const [activeTab, setActiveTab] = useState("followers");
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loadingFollowers, setLoadingFollowers] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [errorFollowers, setErrorFollowers] = useState(null);
  const [errorFollowing, setErrorFollowing] = useState(null);

  useEffect(() => {
    if (userData) {
      axios
        .get(`/api/user_followers.php?user_id=${userData.user_id}`, { withCredentials: true })
        .then((response) => {
          setFollowers(response.data);
          setLoadingFollowers(false);
        })
        .catch((error) => {
          console.error('Error fetching followers:', error);
          setErrorFollowers('Error fetching followers');
          setLoadingFollowers(false);
        });

      axios
        .get(`/api/user_following.php?user_id=${userData.user_id}`, { withCredentials: true })
        .then((response) => {
          setFollowing(response.data);
          setLoadingFollowing(false);
        })
        .catch((error) => {
          console.error('Error fetching following:', error);
          setErrorFollowing('Error fetching following');
          setLoadingFollowing(false);
        });
    }
  }, [userData]);

  if (!userData) {
    return <p>Please log in to view your connections.</p>;
  }

  return (
    <div className="follows-view">
      <div className="tabs">
        <button
          className={activeTab === "followers" ? "tab active" : "tab"}
          onClick={() => setActiveTab("followers")}
        >
          Followers
        </button>
        <button
          className={activeTab === "following" ? "tab active" : "tab"}
          onClick={() => setActiveTab("following")}
        >
          Following
        </button>
      </div>
      <div className="tab-content">
        {activeTab === "followers" && (
          <>
            {loadingFollowers ? (
              <p>Loading followers...</p>
            ) : errorFollowers ? (
              <p>{errorFollowers}</p>
            ) : (
              <ul className="follow-list">
                {followers.map((follower) => (
                  <li key={follower.user_id} className="follow-item">
                    <img
                      src={follower.avatar_path || '/uploads/avatars/DefaultAvatar.png'}
                      alt={`${follower.first_name} ${follower.last_name}`}
                      className="avatar"
                    />
                    <span>
                      {follower.first_name} {follower.last_name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {activeTab === "following" && (
          <>
            {loadingFollowing ? (
              <p>Loading following...</p>
            ) : errorFollowing ? (
              <p>{errorFollowing}</p>
            ) : (
              <ul className="follow-list">
                {following.map((followed) => (
                  <li key={followed.user_id} className="follow-item">
                    <img
                      src={followed.avatar_path || '/uploads/avatars/DefaultAvatar.png'}
                      alt={`${followed.first_name} ${followed.last_name}`}
                      className="avatar"
                    />
                    <span>
                      {followed.first_name} {followed.last_name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default FollowsView;
