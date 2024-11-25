// src/pages/ProfileEdit.js

import React, { useContext, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

const ProfileEdit = () => {
  const { user, setUser } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    bio: user.bio || '',
    profile_picture: null,
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'profile_picture') {
      setFormData(prevState => ({ ...prevState, profile_picture: files[0] }));
    } else {
      setFormData(prevState => ({ ...prevState, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append('name', formData.name);
    data.append('email', formData.email);
    data.append('bio', formData.bio);
    if (formData.profile_picture) {
      data.append('profile_picture', formData.profile_picture);
    }

    try {
      const response = await api.put('/profile', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUser(response.data); // Update user in context
      alert('Profile updated successfully!');
      navigate('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Edit Profile</h2>
      <input
        type="text"
        name="name"
        placeholder="Name"
        value={formData.name}
        onChange={handleChange}
        required
      />
      <input
        type="email"
        name="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
        required
      />
      <textarea
        name="bio"
        placeholder="Tell us about yourself"
        value={formData.bio}
        onChange={handleChange}
      ></textarea>
      <input
        type="file"
        name="profile_picture"
        accept="image/*"
        onChange={handleChange}
      />
      <button type="submit">Update Profile</button>
    </form>
  );
};

export default ProfileEdit;
