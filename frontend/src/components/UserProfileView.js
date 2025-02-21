// src/components/UserProfileView.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import './ProfileView.css';
import DOMPurify from 'dompurify';
import { FaCheckCircle } from 'react-icons/fa'; // Import verification badge icon

function UserProfileView() {
  const { user_id } = useParams();
  const [profile, setProfile] = useState(null);

  // Local states for verification
  const [verified, setVerified] = useState(false);
  const [verifiedCommunityName, setVerifiedCommunityName] = useState('');

  // --------------------------------------------------------------------------
  // Fetch user profile
  // --------------------------------------------------------------------------
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await axios.get(`/api/fetch_user.php?user_id=${user_id}`, {
          withCredentials: true,
        });
        if (response.data.success) {
          setProfile(response.data.user);
        } else {
          console.error('Error fetching user:', response.data.error);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUserProfile();
  }, [user_id]);

  // --------------------------------------------------------------------------
  // Once profile is loaded, determine if user is verified
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (profile) {
      // Convert 'verified' field to a boolean
      setVerified(profile.verified === 1 || profile.verified === '1');
    }
  }, [profile]);

  // --------------------------------------------------------------------------
  // If user is verified, fetch verifying community name
  // --------------------------------------------------------------------------
  useEffect(() => {
    const fetchVerificationCommunity = async (communityId) => {
      try {
        const res = await axios.get(`/api/fetch_university.php?community_id=${communityId}`);
        if (res.data.success && res.data.university) {
          // Adjust as needed for your 'communities' table schema
          setVerifiedCommunityName(res.data.university.name);
        }
      } catch (err) {
        console.error('Error fetching verification community name:', err);
      }
    };

    if (verified && profile && profile.verified_community_id) {
      fetchVerificationCommunity(profile.verified_community_id);
    }
  }, [verified, profile]);

  // --------------------------------------------------------------------------
  // If profile is still loading, show a message
  // --------------------------------------------------------------------------
  if (!profile) return <p>Loading profile...</p>;

  // --------------------------------------------------------------------------
  // Prepare display values
  // --------------------------------------------------------------------------
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const displayHeadline = profile.headline || 'Student at Your University';
  const displayAbout = profile.about || 'No about information provided yet.';
  const displaySkills = profile.skills || '';

  return (
    <div className="profile-view">
      {/* Banner Section */}
      <div className="profile-banner">
        <img
          src={profile.banner_path || '/uploads/banners/default-banner.jpg'}
          alt="Profile Banner"
          className="profile-banner-img"
        />
      </div>

      {/* Header Section */}
      <div className="profile-header">
        <div className="avatar-container">
          <img
            src={profile.avatar_path || '/uploads/avatars/default-avatar.png'}
            alt={`${fullName} Avatar`}
            className="profile-avatar"
          />
        </div>
        <div className="profile-info">
          <h2 className="profile-name">
            {fullName}{' '}
            {verified && (
              <FaCheckCircle
                className="verified-badge"
                style={{ pointerEvents: 'auto' }} // Ensure hover tooltip works
                title={`Verified from ${verifiedCommunityName}`}
              />
            )}
          </h2>
          <p className="profile-headline">{displayHeadline}</p>
        </div>
      </div>

      {/* About Section */}
      <div className="profile-section">
        <h3>About</h3>
        <p>{DOMPurify.sanitize(displayAbout)}</p>
      </div>

      {/* Skills Section */}
      <div className="profile-section">
        <h3>Skills</h3>
        {displaySkills ? (
          <ul className="skills-list">
            {displaySkills.split(',').map((skill, index) => (
              <li key={index} className="skill-item">
                {skill.trim()}
              </li>
            ))}
          </ul>
        ) : (
          <p>No skills listed yet.</p>
        )}
      </div>
    </div>
  );
}

export default UserProfileView;
