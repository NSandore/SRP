// src/pages/ProfileView.js

import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import api from '../services/api';
import { Link } from 'react-router-dom';

const ProfileView = () => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get('/profile')
      .then(response => setProfile(response.data))
      .catch(error => {
        console.error('Error fetching profile:', error);
        alert('Failed to fetch profile');
      });
  }, []);

  if (!profile) return <div>Loading...</div>;

  return (
    <div>
      <h2>Profile</h2>
      {profile.profile_picture && (
        <img
          src={`http://localhost:8000/storage/${profile.profile_picture}`}
          alt="Profile"
          width="150"
          height="150"
        />
      )}
      <p><strong>Name:</strong> {profile.name}</p>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Bio:</strong> {profile.bio}</p>
      <Link to="/profile/edit">Edit Profile</Link>
    </div>
  );
};

export default ProfileView;
