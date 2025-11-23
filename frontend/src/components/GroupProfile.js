// src/components/GroupProfile.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { FaLock } from 'react-icons/fa';
import './GroupProfile.css';

function GroupProfile({ userData, onRequireAuth }) {
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
  const isLoggedIn = Boolean(userData);

  return (
    <div className="profile-container" style={{
      '--primary-color': group.primary_color || '#0077B5',
      '--secondary-color': group.secondary_color || '#005f8d',
    }}>
      <section className="profile-main">
        {/* HERO CARD */}
        <div className="hero-card community-hero">
          <div className="hero-banner">
            <img src={group.banner_path || '/uploads/banners/default-banner.jpeg'} alt="Group Banner" />
          </div>
          <div className="hero-content">
            <div className="hero-left">
              <div className="community-hero-logo-wrap">
                <img src={group.logo_path || '/uploads/logos/default-logo.png'} alt="Group Logo" className="community-hero-logo" />
              </div>
              <div className="hero-text">
                <h1 className="hero-title">{group.name}</h1>
                {group.tagline && <p className="hero-sub">{group.tagline}</p>}
                {group.location && <p className="hero-sub">{group.location}</p>}
              </div>
            </div>
            <div className="hero-right">
              <button
                type="button"
                className={`pill-button ${!isLoggedIn ? 'locked' : ''}`}
                onClick={() => {
                  if (!isLoggedIn) {
                    onRequireAuth?.();
                    return;
                  }
                  // follow action placeholder
                }}
                aria-disabled={!isLoggedIn}
                title={!isLoggedIn ? 'Log in to follow this group' : 'Follow this group'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {!isLoggedIn && <FaLock size={12} />}
                  Follow
                </span>
              </button>
            </div>
          </div>
          <div className="tabs-underline">
            <button type="button" className="tab-link">Overview</button>
            <button type="button" className="tab-link active">Posts</button>
          </div>
        </div>

        {/* Below hero: two-column split — main content + right cards */}
        <div className="profile-split">
          <div className="split-main">
            <div className="content-card">
              <div className="posts-placeholder">
                <p>Posts will appear here.</p>
              </div>
            </div>
          </div>
          <aside className="split-aside">
            <div className="info-card">
              <h3>Ambassadors</h3>
              <div className="avatar-stack" style={{ marginBottom: 8 }}>
                {[1,2,3].map((k) => (
                  <img key={k} className="avatar" src={'/uploads/avatars/default-avatar.png'} alt="amb" />
                ))}
              </div>
              <button
                className={`pill-button ${!isLoggedIn ? 'locked' : ''}`}
                type="button"
                onClick={() => {
                  if (!isLoggedIn) {
                    onRequireAuth?.();
                    return;
                  }
                  alert('Ambassador list coming soon');
                }}
                aria-disabled={!isLoggedIn}
                title={!isLoggedIn ? 'Log in to view ambassadors' : 'View ambassadors'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {!isLoggedIn && <FaLock size={12} />}
                  View all
                </span>
              </button>
            </div>
            <div className="info-card">
              <h3>Contact Us</h3>
              {group.website ? (
                <p style={{ margin: 0 }}>
                  <a href={group.website} target="_blank" rel="noopener noreferrer">{group.website}</a>
                </p>
              ) : null}
              {group.contact_email || group.email ? (
                <p className="muted" style={{ margin: '6px 0 0 0' }}>{group.contact_email || group.email}</p>
              ) : (
                <p className="muted" style={{ margin: 0 }}>No contact info provided.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default GroupProfile;
