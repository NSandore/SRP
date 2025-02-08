// src/components/ProfileView.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfileView.css';

function ProfileView({ userData }) {
  // States for profile data
  const [experience, setExperience] = useState([]);
  const [education, setEducation] = useState([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingEdu, setLoadingEdu] = useState(true);
  const [errorExp, setErrorExp] = useState(null);
  const [errorEdu, setErrorEdu] = useState(null);

  // State for editing mode
  const [isEditing, setIsEditing] = useState(false);

  // Form state for basic profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [skills, setSkills] = useState('');

  // Fetch experience and education whenever userData changes.
  useEffect(() => {
    if (userData) {
      // Set form fields from userData when available
      setFirstName(userData.first_name || '');
      setLastName(userData.last_name || '');
      setHeadline(userData.headline || '');
      setAbout(userData.about || '');
      // Assume skills is either an array or a comma‐separated string
      setSkills(
        Array.isArray(userData.skills)
          ? userData.skills.join(', ')
          : userData.skills || ''
      );

      // Fetch user experience
      setLoadingExp(true);
      axios
        .get(`/api/user_experience.php?user_id=${userData.user_id}`, {
          withCredentials: true,
        })
        .then((response) => {
          setExperience(response.data);
          setLoadingExp(false);
        })
        .catch((err) => {
          console.error('Error fetching experience:', err);
          setErrorExp('Error fetching experience');
          setLoadingExp(false);
        });

      // Fetch user education
      setLoadingEdu(true);
      axios
        .get(`/api/user_education.php?user_id=${userData.user_id}`, {
          withCredentials: true,
        })
        .then((response) => {
          setEducation(response.data);
          setLoadingEdu(false);
        })
        .catch((err) => {
          console.error('Error fetching education:', err);
          setErrorEdu('Error fetching education');
          setLoadingEdu(false);
        });
    } else {
      // If no userData, clear any existing data
      setExperience([]);
      setEducation([]);
      setLoadingExp(false);
      setLoadingEdu(false);
    }
  }, [userData]);

  // Extract basic display data
  const avatar =
    userData && userData.avatar_path
      ? userData.avatar_path
      : '/uploads/avatars/default-avatar.png';
  const fullName = userData ? `${userData.first_name} ${userData.last_name}` : '';
  const displayHeadline = userData ? userData.headline || 'Student at Your University' : '';
  const displayAbout = userData ? userData.about || 'No about information provided yet.' : '';
  const connections = userData ? userData.connections || 0 : 0;
  // For display, if skills is an array, join with commas
  const displaySkills =
    userData && userData.skills
      ? Array.isArray(userData.skills)
        ? userData.skills.join(', ')
        : userData.skills
      : '';

  // Handler to toggle edit mode
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // Handler for form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Build the payload with updated data.
    const updatedData = {
      user_id: userData.user_id,
      first_name: firstName,
      last_name: lastName,
      headline,
      about,
      skills: skills.split(',').map((s) => s.trim()), // convert to array
    };

    try {
      // Example API call to update profile (adjust endpoint and method as needed)
      const response = await axios.post('/api/update_profile.php', updatedData, {
        withCredentials: true,
      });
      if (response.data.success) {
        // Optionally update local userData state or refetch the profile data
        alert('Profile updated successfully!');
        setIsEditing(false);
      } else {
        alert('Error updating profile: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('An error occurred while updating your profile.');
    }
  };

  return (
    <div className="profile-view">
      {!userData ? (
        <p>Please log in to view your profile.</p>
      ) : (
        <>
          {/* Header with Avatar and Basic Info */}
          <div className="profile-header">
            <img src={avatar} alt={`${fullName} Avatar`} className="profile-avatar" />
            <div className="profile-info">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                  />
                </>
              ) : (
                <h2 className="profile-name">{fullName}</h2>
              )}
              {isEditing ? (
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Headline"
                />
              ) : (
                <p className="profile-headline">{displayHeadline}</p>
              )}
              <p className="profile-connections">{connections} Connections</p>
            </div>
            {/* Edit/Save Toggle Button */}
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
              <p>{displayAbout}</p>
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
                  <h4>
                    {exp.title} at {exp.company}
                  </h4>
                  <span className="experience-duration">{exp.duration}</span>
                  <p>{exp.description}</p>
                </div>
              ))
            ) : (
              <p>No experience added yet.</p>
            )}
            {/* Optionally, add a button to edit experience in a separate modal/form */}
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
            {/* Optionally, add a button to edit education */}
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
            ) : skills.length > 0 ? (
              <ul className="skills-list">
                {skills.split(',').map((skill, index) => (
                  <li key={index} className="skill-item">
                    {skill.trim()}
                  </li>
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

export default ProfileView;
