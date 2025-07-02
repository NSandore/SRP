// src/components/GroupProfile.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './GroupProfile.css';

function GroupProfile({ userData }) {
  const { id } = useParams(); // group community id
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);

  // Fetch group details on mount (or when id changes)
  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const response = await axios.get(`/api/fetch_group.php?community_id=${id}`);
        if (response.data.success) {
          setGroup(response.data.group);
          setFollowersCount(response.data.group.followers_count || 0);
        } else {
          setError(response.data.error);
        }
      } catch (err) {
        setError('Error fetching group data');
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!group) return <p>No group found.</p>;

  return (
    <div
      className="group-profile"
      style={{
        // Optional: dynamically apply the group’s colors if available
        '--primary-color': group.primary_color || '#0077B5',
        '--secondary-color': group.secondary_color || '#005f8d',
      }}
    >
      {/* Group Banner */}
      <div className="group-banner">
        <img
          src={group.banner_path || '/uploads/banners/default-banner.jpeg'}
          alt="Group Banner"
        />
      </div>

      <div className="group-info">
        <img
          src={group.logo_path || '/uploads/logos/default-logo.png'}
          alt="Group Logo"
          className="group-logo"
        />
        <h1 className="group-name">{group.name}</h1>
        <p className="group-tagline">{group.tagline}</p>
        <p className="group-location">{group.location}</p>
        <p className="followers-count">{followersCount} Followers</p>
        {group.website && (
          <a href={group.website} target="_blank" rel="noopener noreferrer">
            Visit Website
          </a>
        )}
        {/* Optionally, add an edit button if needed, similar to UniversityProfile */}
        {userData &&
          (userData.role_id >= 6 ||
            (userData.role_id === 5 &&
              userData.admin_community_ids &&
              userData.admin_community_ids.includes(Number(id))) ) && (
            <button className="edit-group-button" onClick={() => alert('Edit group functionality coming soon!')}>
              Edit Group
            </button>
        )}
      </div>
    </div>
  );
}

export default GroupProfile;
