// src/components/SelfProfileView.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfileView.css';
import DOMPurify from 'dompurify';

function SelfProfileView({ userData }) {
  // 1) Full profile data from fetch_user.php
  const [profile, setProfile] = useState(null);

  // 2) Experience & Education
  const [experience, setExperience] = useState([]);
  const [education, setEducation] = useState([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingEdu, setLoadingEdu] = useState(true);
  const [errorExp, setErrorExp] = useState(null);
  const [errorEdu, setErrorEdu] = useState(null);

  // 3) Editing mode + form fields
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [skills, setSkills] = useState('');

  // 4) Avatar + Banner paths (default values provided)
  const [avatarPath, setAvatarPath] = useState('/uploads/avatars/default-avatar.png');
  const [bannerPath, setBannerPath] = useState('/uploads/banners/default-banner.jpg');

  // 5) File upload state for avatar/banner
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  // 6) New: Primary and Secondary color states
  const [primaryColor, setPrimaryColor] = useState('#0077B5');
  const [secondaryColor, setSecondaryColor] = useState('#005f8d');

  // ------------------------------------------------------------------------------
  // Fetch full profile from fetch_user.php
  // ------------------------------------------------------------------------------
  useEffect(() => {
    if (!userData) return;
    const fetchUserProfile = async () => {
      try {
        const response = await axios.get(`/api/fetch_user.php?user_id=${userData.user_id}`, {
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
  }, [userData]);

  // ------------------------------------------------------------------------------
  // Initialize form fields, avatar/banner, and colors from loaded profile data
  // ------------------------------------------------------------------------------
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setHeadline(profile.headline || '');
      setAbout(profile.about || '');
      setSkills(profile.skills || '');
      setAvatarPath(profile.avatar_path || '/uploads/avatars/default-avatar.png');
      setBannerPath(profile.banner_path || '/uploads/banners/default-banner.jpg');
      setPrimaryColor(profile.primary_color || '#0077B5');
      setSecondaryColor(profile.secondary_color || '#005f8d');
    }
  }, [profile]);

  // ------------------------------------------------------------------------------
  // Fetch experience and education data
  // ------------------------------------------------------------------------------
  useEffect(() => {
    if (!userData) {
      setExperience([]);
      setEducation([]);
      setLoadingExp(false);
      setLoadingEdu(false);
      return;
    }
    setLoadingExp(true);
    axios
      .get(`/api/user_experience.php?user_id=${userData.user_id}`, { withCredentials: true })
      .then((res) => {
        setExperience(res.data);
        setLoadingExp(false);
      })
      .catch((err) => {
        console.error('Error fetching experience:', err);
        setErrorExp('Error fetching experience');
        setLoadingExp(false);
      });
    setLoadingEdu(true);
    axios
      .get(`/api/user_education.php?user_id=${userData.user_id}`, { withCredentials: true })
      .then((res) => {
        setEducation(res.data);
        setLoadingEdu(false);
      })
      .catch((err) => {
        console.error('Error fetching education:', err);
        setErrorEdu('Error fetching education');
        setLoadingEdu(false);
      });
  }, [userData]);

  // ------------------------------------------------------------------------------
  // Handler: Toggle edit mode
  // ------------------------------------------------------------------------------
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // ------------------------------------------------------------------------------
  // Handler: Submit profile updates (includes file uploads and color updates)
  // ------------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userData) return;

    // Initialize new paths with the current ones
    let newAvatarPath = avatarPath;
    let newBannerPath = bannerPath;

    // If a new avatar file was chosen, upload it.
    if (avatarFile) {
      const avatarFormData = new FormData();
      avatarFormData.append('user_id', userData.user_id);
      avatarFormData.append('avatar', avatarFile);
      try {
        const avatarResp = await axios.post('/api/upload_avatar.php', avatarFormData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (avatarResp.data.success) {
          newAvatarPath = avatarResp.data.avatar_path;
          setAvatarPath(newAvatarPath);
        } else {
          alert('Error uploading avatar: ' + avatarResp.data.error);
          return;
        }
      } catch (error) {
        console.error('Error uploading avatar:', error);
        alert('An error occurred while uploading the avatar.');
        return;
      }
    }

    // If a new banner file was chosen, upload it.
    if (bannerFile) {
      const bannerFormData = new FormData();
      bannerFormData.append('user_id', userData.user_id);
      bannerFormData.append('banner', bannerFile);
      try {
        const bannerResp = await axios.post('/api/upload_banner.php', bannerFormData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (bannerResp.data.success) {
          newBannerPath = bannerResp.data.banner_path;
          setBannerPath(newBannerPath);
        } else {
          alert('Error uploading banner: ' + bannerResp.data.error);
          return;
        }
      } catch (error) {
        console.error('Error uploading banner:', error);
        alert('An error occurred while uploading the banner.');
        return;
      }
    }

    // Build the payload for updating profile data, including color fields
    const updatedData = {
      user_id: userData.user_id,
      first_name: firstName,
      last_name: lastName,
      headline,
      about,
      skills: skills.split(',').map((s) => s.trim()),
      avatar_path: newAvatarPath,
      banner_path: newBannerPath,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
    };

    try {
      const response = await axios.post('/api/update_profile.php', updatedData, {
        withCredentials: true,
      });
      if (response.data.success) {
        alert('Profile updated successfully!');
        setIsEditing(false);
        // Refresh profile data
        const updatedRes = await axios.get(`/api/fetch_user.php?user_id=${userData.user_id}`, {
          withCredentials: true,
        });
        if (updatedRes.data.success) {
          setProfile(updatedRes.data.user);
        }
      } else {
        alert('Error updating profile: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('An error occurred while updating your profile.');
    }
  };

  // ------------------------------------------------------------------------------
  // Derived display variables
  // ------------------------------------------------------------------------------
  const fullName =
    (profile && profile.first_name && profile.last_name)
      ? `${profile.first_name} ${profile.last_name}`
      : userData
      ? `${userData.first_name} ${userData.last_name}`
      : '';

  const displayHeadline = profile ? profile.headline || 'Student at Your University' : '';
  const displayAbout = profile ? profile.about || 'No about information provided yet.' : '';
  const displaySkills = profile && profile.skills ? profile.skills : '';

  // Apply the user’s preferred colors as CSS variables on the container.
  const profileStyle = {
    '--primary-color': primaryColor,
    '--secondary-color': secondaryColor,
  };

  return (
    <div className="profile-view" style={profileStyle}>
      {!userData ? (
        <p>Please log in to view your profile.</p>
      ) : (
        <>
          {/* Banner Section */}
          <div className="profile-banner">
            <img src={bannerPath} alt="Profile Banner" className="profile-banner-img" />
          </div>

          {/* Profile Header with Avatar and Basic Info */}
          <div className="profile-header">
            <div className="avatar-container">
              <img src={avatarPath} alt={`${fullName} Avatar`} className="profile-avatar" />
            </div>

            <div className="profile-info">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    className="edit-name-input"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="edit-name-input"
                  />
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Headline"
                    className="edit-headline-input"
                  />
                  {/* Color pickers for Primary and Secondary colors */}
                  <div className="color-picker-container">
                    <label>
                      Primary Color:
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                      />
                    </label>
                    <label>
                      Secondary Color:
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="profile-name">{fullName}</h2>
                  <p className="profile-headline">{displayHeadline}</p>
                </>
              )}
            </div>

            {/* Edit/Save Button */}
            <div className="edit-button-container">
              {isEditing ? (
                <button className="save-button" onClick={handleSubmit}>
                  Save Profile
                </button>
              ) : (
                <button className="edit-button" onClick={handleToggleEdit}>
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* About Section */}
          <div className="profile-section">
            <h3>About</h3>
            {isEditing ? (
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Tell us about yourself..."
              />
            ) : (
              <p>{DOMPurify.sanitize(displayAbout)}</p>
            )}
          </div>

          {/* Experience Section */}
          <div className="profile-section">
            <h3>Experience</h3>
            {loadingExp ? (
              <p>Loading experience...</p>
            ) : errorExp ? (
              <p>{errorExp}</p>
            ) : experience.length > 0 ? (
              experience.map((exp, index) => (
                <div key={index} className="experience-item">
                  <h4>{exp.title} at {exp.company}</h4>
                  <span className="experience-duration">{exp.duration}</span>
                  <p>{exp.description}</p>
                </div>
              ))
            ) : (
              <p>No experience added yet.</p>
            )}
          </div>

          {/* Education Section */}
          <div className="profile-section">
            <h3>Education</h3>
            {loadingEdu ? (
              <p>Loading education...</p>
            ) : errorEdu ? (
              <p>{errorEdu}</p>
            ) : education.length > 0 ? (
              education.map((edu, index) => (
                <div key={index} className="education-item">
                  <h4>{edu.degree}</h4>
                  <span className="education-institution">{edu.institution}</span>
                  <span className="education-duration">{edu.duration}</span>
                </div>
              ))
            ) : (
              <p>No education details added yet.</p>
            )}
          </div>

          {/* Skills Section */}
          <div className="profile-section">
            <h3>Skills</h3>
            {isEditing ? (
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Enter skills, separated by commas"
              />
            ) : displaySkills ? (
              <ul className="skills-list">
                {displaySkills.split(',').map((skill, index) => (
                  <li key={index} className="skill-item">{skill.trim()}</li>
                ))}
              </ul>
            ) : (
              <p>No skills listed yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default SelfProfileView;
