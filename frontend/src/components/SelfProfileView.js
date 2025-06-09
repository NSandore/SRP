import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfileView.css';
import DOMPurify from 'dompurify';
import { FaCheckCircle } from 'react-icons/fa';

function SelfProfileView({ userData, onProfileUpdate }) {
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

  // Avatar & Banner
  const [avatarPath, setAvatarPath] = useState('/uploads/avatars/default-avatar.png');
  const [bannerPath, setBannerPath] = useState('/uploads/banners/default-banner.jpg');
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  // 4) Primary & Secondary color states
  const [primaryColor, setPrimaryColor] = useState('#0077B5');
  const [secondaryColor, setSecondaryColor] = useState('#005f8d');

  // 5) Verification-related states
  const [verified, setVerified] = useState(false);
  const [verifiedCommunityName, setVerifiedCommunityName] = useState('');

  // Follower/Following counts
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // --------------------------------------------------------------------------
  // Fetch full profile from /api/fetch_user.php
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!userData) return;
    const fetchUserProfile = async () => {
      try {
        const response = await axios.get(
          `/api/fetch_user.php?user_id=${userData.user_id}`,
          { withCredentials: true }
        );
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

  // --------------------------------------------------------------------------
  // Populate local state from profile
  // --------------------------------------------------------------------------
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
      setVerified(profile.verified === '1' || profile.verified === 1);
    }
  }, [profile]);

  // --------------------------------------------------------------------------
  // Fetch verifying community name (if verified)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const fetchVerificationCommunity = async (communityId) => {
      try {
        const res = await axios.get(`/api/fetch_university.php?community_id=${communityId}`);
        if (res.data.success && res.data.university) {
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
  // Fetch follower and following counts
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!userData) return;
    const fetchCounts = async () => {
      try {
        const resFollowers = await axios.get(
          `/api/fetch_follower_count.php?user_id=${userData.user_id}`
        );
        if (resFollowers.data.success) {
          setFollowerCount(resFollowers.data.follower_count);
        }
        const resFollowing = await axios.get(
          `/api/fetch_following_count.php?user_id=${userData.user_id}`
        );
        if (resFollowing.data.success) {
          setFollowingCount(resFollowing.data.following_count);
        }
      } catch (err) {
        console.error('Error fetching follow counts:', err);
      }
    };
    fetchCounts();
  }, [userData]);

  // --------------------------------------------------------------------------
  // Fetch experience & education data
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // Handler: Toggle edit mode
  // --------------------------------------------------------------------------
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // --------------------------------------------------------------------------
  // Handler: Upload file for avatar or banner, returning new path
  // --------------------------------------------------------------------------
  const handleFileUpload = async (file, type) => {
    if (!file || !userData) return null;
    const formData = new FormData();
    formData.append('user_id', userData.user_id);
    formData.append(type, file);
    try {
      const res = await axios.post(
        `/api/upload_${type}.php`,
        formData,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      if (res.data.success) {
        if (type === 'avatar') {
          setAvatarPath(res.data.avatar_path);
          setAvatarFile(null);
          return res.data.avatar_path;
        } else if (type === 'banner') {
          setBannerPath(res.data.banner_path);
          setBannerFile(null);
          return res.data.banner_path;
        }
      } else {
        alert(`Error uploading ${type}: ${res.data.error}`);
        return null;
      }
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      alert(`An error occurred while uploading the ${type}.`);
      return null;
    }
  };

  // --------------------------------------------------------------------------
  // Handler: Submit profile updates
  // --------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userData) return;
    let updatedAvatarPath = avatarPath;
    let updatedBannerPath = bannerPath;
    if (avatarFile) {
      const newAvatarPath = await handleFileUpload(avatarFile, 'avatar');
      if (newAvatarPath) {
        updatedAvatarPath = newAvatarPath;
      }
    }
    if (bannerFile) {
      const newBannerPath = await handleFileUpload(bannerFile, 'banner');
      if (newBannerPath) {
        updatedBannerPath = newBannerPath;
      }
    }
    const updatedData = {
      user_id: userData.user_id,
      first_name: firstName,
      last_name: lastName,
      headline,
      about,
      skills: skills.split(',').map((s) => s.trim()),
      avatar_path: updatedAvatarPath,
      banner_path: updatedBannerPath,
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
        const updatedRes = await axios.get(`/api/fetch_user.php?user_id=${userData.user_id}`, { withCredentials: true });
        if (updatedRes.data.success) {
          setProfile(updatedRes.data.user);
          if (onProfileUpdate) {
            onProfileUpdate(updatedRes.data.user);
          }
          window.location.reload();
        }
      } else {
        alert('Error updating profile: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('An error occurred while updating your profile.');
    }
  };

  // --------------------------------------------------------------------------
  // Derived display variables
  // --------------------------------------------------------------------------
  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : userData
    ? `${userData.first_name} ${userData.last_name}`
    : '';
  const displayHeadline = profile ? profile.headline || 'Student at Your University' : '';
  const displayAbout = profile ? profile.about || 'No about information provided yet.' : '';
  const displaySkills = profile && profile.skills ? profile.skills : '';

  const profileStyle = {
    '--primary-color': primaryColor,
    '--secondary-color': secondaryColor,
  };

  return (
    <div className={`profile-view ${isEditing ? 'editing' : ''}`} style={profileStyle}>
      {!userData ? (
        <p>Please log in to view your profile.</p>
      ) : (
        <>
          {/* Banner Section */}
          <div className="banner-section">
            <img src={bannerPath} alt="Profile Banner" className="profile-banner-img" />
            {isEditing && (
              <div className="banner-upload-container">
                <label className="banner-upload">
                  Choose Banner
                  <input type="file" onChange={(e) => setBannerFile(e.target.files[0])} />
                </label>
              </div>
            )}
          </div>

          {/* Profile Header */}
          <div className="profile-header">
            <div className="avatar-container">
              <img src={avatarPath} alt="Profile Avatar" className="profile-avatar" />
              {isEditing && (
                <div className="avatar-upload-container">
                  <label className="avatar-upload">
                    Choose Avatar
                    <input type="file" onChange={(e) => setAvatarFile(e.target.files[0])} />
                  </label>
                </div>
              )}
            </div>
            <div className="profile-info">
              {isEditing ? (
                <div className="edit-fields">
                  <div className="name-row">
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
                  </div>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Headline"
                    className="edit-headline-input"
                  />
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
                </div>
              ) : (
                <>
                  <h2 className="profile-name">
                    {fullName}{' '}
                    {verified && (
                      <span className="verified-badge" title={`Verified from ${verifiedCommunityName}`}>
                        <FaCheckCircle />
                      </span>
                    )}
                  </h2>
                  <p className="profile-headline">{displayHeadline}</p>
                  <p className="followers-count">{followerCount} Followers</p>
                  <p className="following-count">{followingCount} Following</p>
                </>
              )}
            </div>
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
                  <div className="experience-dates">
                    {exp.start_date} - {exp.end_date ? exp.end_date : "Present"}
                  </div>
                  <div className="experience-meta">
                    {/*<span className="experience-industry">{exp.industry}</span>*/}
                    <span className="experience-type">{exp.employment_type}</span>
                    <span className="experience-location">
                      {exp.location_city}, {exp.location_state}
                    </span>
                  </div>
                  <p>{exp.description}</p>
                  {exp.responsibilities && exp.responsibilities.length > 0 && (
                    <ul className="responsibilities-list">
                      {exp.responsibilities.map((resp, idx) => (
                        <li key={idx}>{resp}</li>
                      ))}
                    </ul>
                  )}
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
                  <h4>{edu.degree} in {edu.field_of_study}</h4>
                  <div className="education-institution">{edu.institution}</div>
                  <div className="education-dates">
                    {edu.start_date} - {edu.end_date ? edu.end_date : "Present"}
                  </div>
                  {edu.gpa && <div className="education-gpa">GPA: {edu.gpa}</div>}
                  {edu.honors && <div className="education-honors">Honors: {edu.honors}</div>}
                  {edu.activities_societies && (
                    <div className="education-activities">
                      Activities: {edu.activities_societies}
                    </div>
                  )}
                  {edu.achievements && edu.achievements.length > 0 && (
                    <ul className="achievements-list">
                      {edu.achievements.map((ach, idx) => (
                        <li key={idx}>{ach}</li>
                      ))}
                    </ul>
                  )}
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

export default SelfProfileView;
