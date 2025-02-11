// src/components/GroupProfile.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './GroupProfile.css';

function GroupProfile({ userData }) {
  const { id } = useParams(); // community id for group
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const response = await axios.get(`/api/fetch_group.php?community_id=${id}`);
        if (response.data.success) {
          setGroup(response.data.group);
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
    <div className="group-profile">
      <div className="group-banner">
        <img
          src={group.banner_path || '/uploads/banners/default-banner.jpg'}
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
        {group.website && (
          <a href={group.website} target="_blank" rel="noopener noreferrer">
            Visit Website
          </a>
        )}
      </div>
    </div>
  );
}

export default GroupProfile;
