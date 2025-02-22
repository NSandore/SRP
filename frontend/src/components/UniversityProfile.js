// src/components/UniversityProfile.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './UniversityProfile.css';

function UniversityProfile({ userData }) {
  const { id } = useParams(); // community id
  const [university, setUniversity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode state (only available if userData.role_id === 3)
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields state
  const [editName, setEditName] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editPrimaryColor, setEditPrimaryColor] = useState('');
  const [editSecondaryColor, setEditSecondaryColor] = useState('');

  // File upload states for logo and banner
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [newBannerFile, setNewBannerFile] = useState(null);

  // Fetch university details on mount (or when id changes)
  useEffect(() => {
    const fetchUniversity = async () => {
      try {
        const response = await axios.get(`/api/fetch_university.php?community_id=${id}`);
        if (response.data.success) {
          setUniversity(response.data.university);
          // Initialize editable fields with the current values
          setEditName(response.data.university.name || '');
          setEditTagline(response.data.university.tagline || '');
          setEditLocation(response.data.university.location || '');
          setEditWebsite(response.data.university.website || '');
          setEditPrimaryColor(response.data.university.primary_color || '#0077B5');
          setEditSecondaryColor(response.data.university.secondary_color || '#005f8d');
        } else {
          setError(response.data.error);
        }
      } catch (err) {
        setError('Error fetching university data');
      } finally {
        setLoading(false);
      }
    };
    fetchUniversity();
  }, [id]);

  // Toggle edit mode
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // Handle form submission to update university details
  const handleUpdateUniversity = async (e) => {
    e.preventDefault();

    // Create a FormData object so that file uploads can be handled along with text data
    const formData = new FormData();
    formData.append('community_id', id);
    formData.append('name', editName);
    formData.append('tagline', editTagline);
    formData.append('location', editLocation);
    formData.append('website', editWebsite);
    formData.append('primary_color', editPrimaryColor);
    formData.append('secondary_color', editSecondaryColor);
    if (newLogoFile) {
      formData.append('logo', newLogoFile);
    }
    if (newBannerFile) {
      formData.append('banner', newBannerFile);
    }

    try {
      const response = await axios.post('/api/update_university.php', formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.data.success) {
        alert('University updated successfully!');
        setIsEditing(false);
        setUniversity(response.data.university); // Assume the API returns the updated university
        // Clear file inputs after successful update
        setNewLogoFile(null);
        setNewBannerFile(null);
      } else {
        alert('Error updating university: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error updating university:', error);
      alert('An error occurred while updating the university.');
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!university) return <p>No university found.</p>;

  return (
    <div
      className="university-profile"
      style={{
        // Optional: dynamically apply the university’s colors
        '--primary-color': university.primary_color || '#0077B5',
        '--secondary-color': university.secondary_color || '#005f8d',
      }}
    >
      {/* University Banner */}
      <div className="university-banner">
        <img
          src={university.banner_path || '/uploads/banners/default-banner.jpeg'}
          alt="University Banner"
        />
      </div>

      {isEditing ? (
        <form className="university-edit-form" onSubmit={handleUpdateUniversity}>
          <div className="university-info">
            <div className="logo-section">
              <img
                src={university.logo_path || '/uploads/logos/default-logo.png'}
                alt="University Logo"
                className="university-logo"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewLogoFile(e.target.files[0])}
              />
            </div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="edit-input university-name-input"
              placeholder="University Name"
            />
            <input
              type="text"
              value={editTagline}
              onChange={(e) => setEditTagline(e.target.value)}
              className="edit-input university-tagline-input"
              placeholder="Tagline"
            />
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="edit-input university-location-input"
              placeholder="Location"
            />
            <input
              type="text"
              value={editWebsite}
              onChange={(e) => setEditWebsite(e.target.value)}
              className="edit-input university-website-input"
              placeholder="Website URL"
            />
            <div className="color-picker-group">
              <label>
                Primary Color:
                <input
                  type="color"
                  value={editPrimaryColor}
                  onChange={(e) => setEditPrimaryColor(e.target.value)}
                />
              </label>
              <label>
                Secondary Color:
                <input
                  type="color"
                  value={editSecondaryColor}
                  onChange={(e) => setEditSecondaryColor(e.target.value)}
                />
              </label>
            </div>
            <div className="banner-upload-section">
              <img
                src={university.banner_path || '/uploads/banners/default-banner.jpg'}
                alt="Current Banner"
                className="current-banner-preview"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewBannerFile(e.target.files[0])}
              />
            </div>
            <div className="edit-buttons">
              <button type="submit" className="save-button">Save Changes</button>
              <button type="button" className="cancel-button" onClick={handleToggleEdit}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="university-info">
          <img
            src={university.logo_path || '/uploads/logos/default-logo.png'}
            alt="University Logo"
            className="university-logo"
          />
          <h1 className="university-name">{university.name}</h1>
          <p className="university-tagline">{university.tagline}</p>
          <p className="university-location">{university.location}</p>
          {university.website && (
            <a href={university.website} target="_blank" rel="noopener noreferrer">
              Visit Website
            </a>
          )}
          {userData && userData.role_id === 7 && (
            <button className="edit-university-button" onClick={handleToggleEdit}>
              Edit University
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default UniversityProfile;
