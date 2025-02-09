// src/components/UserProfileView.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import './ProfileView.css';
import DOMPurify from 'dompurify';

function UserProfileView() {
  const { user_id } = useParams();
  const [profile, setProfile] = useState(null);

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

  if (!profile) return <p>Loading profile...</p>;

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const displayHeadline = profile.headline || 'Student at Your University';
  const displayAbout = profile.about || 'No about information provided yet.';
  const displaySkills = profile.skills || '';

  return (
    <div className="profile-view" style={{ pointerEvents: 'none' }}>
      {/* Note: pointerEvents: 'none' disables editing interactions */}
      <div className="profile-banner">
        <img src={profile.banner_path || '/uploads/banners/default-banner.jpg'} alt="Profile Banner" className="profile-banner-img" />
      </div>
      <div className="profile-header">
        <div className="avatar-container">
          <img src={profile.avatar_path || '/uploads/avatars/default-avatar.png'} alt={`${fullName} Avatar`} className="profile-avatar" />
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{fullName}</h2>
          <p className="profile-headline">{displayHeadline}</p>
        </div>
      </div>
      <div className="profile-section">
        <h3>About</h3>
        <p>{DOMPurify.sanitize(displayAbout)}</p>
      </div>
      <div className="profile-section">
        <h3>Skills</h3>
        {displaySkills ? (
          <ul className="skills-list">
            {displaySkills.split(',').map((skill, index) => (
              <li key={index} className="skill-item">{skill.trim()}</li>
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
