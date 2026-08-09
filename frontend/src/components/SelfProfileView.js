import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link as RouterLink } from 'react-router-dom';
import './ProfileView.css';
import DOMPurify from 'dompurify';
import { BadgeCheck } from 'lucide-react';
import ThreadCard from './ThreadCard';
import ModalOverlay from './ModalOverlay';
import { buildAvatarSrc } from '../utils/avatar';
import buildUploadSrc from '../utils/uploads';
import { usePublishProfileContact } from '../context/ProfileContactContext';
import ReelGrid, { IntroReelCard } from './ReelGrid';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const parsed = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  const ts = parsed.getTime();
  if (Number.isNaN(ts)) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 3600) {
    const mins = Math.max(1, Math.floor(seconds / 60));
    return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.max(1, Math.round(seconds / 3600));
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  const intervals = [
    { label: 'year', secs: 31536000 },
    { label: 'month', secs: 2592000 },
    { label: 'week', secs: 604800 },
    { label: 'day', secs: 86400 },
  ];
  for (const it of intervals) {
    const count = Math.floor(seconds / it.secs);
    if (count >= 1) return `${count} ${it.label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
};

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
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [skills, setSkills] = useState('');

  // Avatar & Banner
  const [avatarPath, setAvatarPath] = useState('/uploads/avatars/DefaultAvatar.png');
  const [bannerPath, setBannerPath] = useState('/uploads/banners/DefaultBanner.jpeg');
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  // 4) Primary & Secondary color states
  const [primaryColor, setPrimaryColor] = useState('#2F80ED');
  const [secondaryColor, setSecondaryColor] = useState('#1D5FC4');

  // 5) Verification-related states
  const [verified, setVerified] = useState(false);
  const [verifiedCommunityName, setVerifiedCommunityName] = useState('');
  const [ambassadorLogo, setAmbassadorLogo] = useState('');

  // Follower/Following counts
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState('about');
  const [userThreads, setUserThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState(null);
  const [hasLoadedThreads, setHasLoadedThreads] = useState(false);
  const [userReplies, setUserReplies] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState(null);
  const [hasLoadedReplies, setHasLoadedReplies] = useState(false);

  const userId = userData?.user_id;
  const profileTabs = [
    { id: 'about', label: 'About' },
    { id: 'reels', label: 'Reels' },
    { id: 'posts', label: 'Posts' },
    { id: 'replies', label: 'Replies' },
  ];

  // --------------------------------------------------------------------------
  // Fetch full profile from /api/fetch_user.php
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    const fetchUserProfile = async () => {
      try {
        const response = await axios.get(
          `/api/fetch_user.php?user_id=${userId}`,
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
  }, [userId]);

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
      setAvatarPath(profile.avatar_path || '/uploads/avatars/DefaultAvatar.png');
      setBannerPath(profile.banner_path || '/uploads/banners/DefaultBanner.jpeg');
      setPrimaryColor(profile.primary_color || '#2F80ED');
      setSecondaryColor(profile.secondary_color || '#1D5FC4');
      setVerified(profile.verified === '1' || profile.verified === 1);
    }
  }, [profile]);

  useEffect(() => {
    if (!profileNotice) return undefined;
    const timeoutId = window.setTimeout(() => setProfileNotice(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [profileNotice]);

  const primaryAmbassadorCommunityId =
    Array.isArray(userData?.ambassador_communities) && userData.ambassador_communities.length > 0
      ? String(userData.ambassador_communities[0]?.community_id ?? userData.ambassador_communities[0]?.id ?? '')
      : '';

  useEffect(() => {
    const loadAmbassadorLogo = async () => {
      if (!primaryAmbassadorCommunityId) {
        setAmbassadorLogo('');
        return;
      }
      try {
        const res = await axios.get(`/api/fetch_community.php?community_id=${primaryAmbassadorCommunityId}`);
        if (res.data?.success && res.data?.community?.logo_path) {
          setAmbassadorLogo(buildUploadSrc(res.data.community.logo_path));
        } else {
          setAmbassadorLogo('');
        }
      } catch (error) {
        setAmbassadorLogo('');
      }
    };
    loadAmbassadorLogo();
  }, [primaryAmbassadorCommunityId]);

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

  const fetchProfileThreads = async () => {
    if (!userId) return;
    setThreadsLoading(true);
    setThreadsError(null);
    try {
      let url = `/api/fetch_user_threads.php?user_id=${userId}`;
      if (userId) {
        url += `&viewer_id=${userId}`;
      }
      const res = await axios.get(url, { withCredentials: true });
      if (res.data.success) {
        setUserThreads(res.data.threads || []);
      } else {
        setThreadsError(res.data.error || 'Unable to load posts.');
      }
    } catch (error) {
      console.error('Error fetching profile threads:', error);
      setThreadsError('Unable to load posts.');
    } finally {
      setThreadsLoading(false);
      setHasLoadedThreads(true);
    }
  };

  const fetchProfileReplies = async () => {
    if (!userId) return;
    setRepliesLoading(true);
    setRepliesError(null);
    try {
      let url = `/api/fetch_user_replies.php?user_id=${userId}`;
      if (userId) {
        url += `&viewer_id=${userId}`;
      }
      const res = await axios.get(url, { withCredentials: true });
      if (res.data.success) {
        setUserReplies(res.data.replies || []);
      } else {
        setRepliesError(res.data.error || 'Unable to load replies.');
      }
    } catch (error) {
      console.error('Error fetching profile replies:', error);
      setRepliesError('Unable to load replies.');
    } finally {
      setRepliesLoading(false);
      setHasLoadedReplies(true);
    }
  };

  useEffect(() => {
    if (activeTab === 'posts' && !hasLoadedThreads) {
      fetchProfileThreads();
    }
    if (activeTab === 'replies' && !hasLoadedReplies) {
      fetchProfileReplies();
    }
  }, [activeTab, hasLoadedThreads, hasLoadedReplies, userId]);

  // --------------------------------------------------------------------------
  // Fetch follower and following counts
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    const fetchCounts = async () => {
      try {
        const resFollowers = await axios.get(
          `/api/fetch_follower_count.php?user_id=${userId}`
        );
        if (resFollowers.data.success) {
          setFollowerCount(resFollowers.data.follower_count);
        }
        const resFollowing = await axios.get(
          `/api/fetch_following_count.php?user_id=${userId}`
        );
        if (resFollowing.data.success) {
          setFollowingCount(resFollowing.data.following_count);
        }
      } catch (err) {
        console.error('Error fetching follow counts:', err);
      }
    };
    fetchCounts();
  }, [userId]);

  useEffect(() => {
    setActiveTab('about');
    setUserThreads([]);
    setHasLoadedThreads(false);
    setThreadsError(null);
    setUserReplies([]);
    setHasLoadedReplies(false);
    setRepliesError(null);
  }, [userId]);

  // --------------------------------------------------------------------------
  // Fetch experience & education data
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!userId) {
      setExperience([]);
      setEducation([]);
      setLoadingExp(false);
      setLoadingEdu(false);
      return;
    }
    setLoadingExp(true);
    axios
      .get(`/api/user_experience.php?user_id=${userId}`, { withCredentials: true })
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
      .get(`/api/user_education.php?user_id=${userId}`, { withCredentials: true })
      .then((res) => {
        setEducation(res.data);
        setLoadingEdu(false);
      })
      .catch((err) => {
        console.error('Error fetching education:', err);
        setErrorEdu('Error fetching education');
        setLoadingEdu(false);
      });
  }, [userId]);

  // --------------------------------------------------------------------------
  // Handler: Toggle edit mode
  // --------------------------------------------------------------------------
  const resetProfileDraft = () => {
    if (!profile) return;
    setFirstName(profile.first_name || '');
    setLastName(profile.last_name || '');
    setHeadline(profile.headline || '');
    setAbout(profile.about || '');
    setSkills(profile.skills || '');
    setAvatarPath(profile.avatar_path || '/uploads/avatars/DefaultAvatar.png');
    setBannerPath(profile.banner_path || '/uploads/banners/DefaultBanner.jpeg');
    setPrimaryColor(profile.primary_color || '#2F80ED');
    setSecondaryColor(profile.secondary_color || '#1D5FC4');
    setAvatarFile(null);
    setBannerFile(null);
  };

  const handleToggleEdit = () => {
    setProfileNotice(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    resetProfileDraft();
    setIsEditing(false);
  };

  // --------------------------------------------------------------------------
  // Handler: Upload file for avatar or banner, returning new path
  // --------------------------------------------------------------------------
  const handleFileUpload = async (file, type) => {
    if (!file || !userId) return null;
    const formData = new FormData();
    formData.append('user_id', userId);
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
        setProfileNotice({ type: 'error', message: `Error uploading ${type}: ${res.data.error}` });
        return null;
      }
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      setProfileNotice({ type: 'error', message: `An error occurred while uploading the ${type}.` });
      return null;
    }
  };

  // --------------------------------------------------------------------------
  // Handler: Submit profile updates
  // --------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) return;
    setIsSavingProfile(true);
    setProfileNotice(null);
    let updatedAvatarPath = avatarPath;
    let updatedBannerPath = bannerPath;
    if (avatarFile) {
      const newAvatarPath = await handleFileUpload(avatarFile, 'avatar');
      if (!newAvatarPath) {
        setIsSavingProfile(false);
        return;
      }
      updatedAvatarPath = newAvatarPath;
    }
    if (bannerFile) {
      const newBannerPath = await handleFileUpload(bannerFile, 'banner');
      if (!newBannerPath) {
        setIsSavingProfile(false);
        return;
      }
      updatedBannerPath = newBannerPath;
    }
    const updatedData = {
      user_id: userId,
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
        setIsEditing(false);
        const updatedRes = await axios.get(`/api/fetch_user.php?user_id=${userId}`, { withCredentials: true });
        if (updatedRes.data.success) {
          setProfile(updatedRes.data.user);
          if (onProfileUpdate) {
            onProfileUpdate(updatedRes.data.user);
          }
        }
        setProfileNotice({ type: 'success', message: 'Profile updated successfully.' });
      } else {
        setProfileNotice({ type: 'error', message: `Error updating profile: ${response.data.error}` });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setProfileNotice({ type: 'error', message: 'An error occurred while updating your profile.' });
    } finally {
      setIsSavingProfile(false);
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
  const isDefaultAvatar = avatarPath?.includes('DefaultAvatar.png');
  const contactVisibilityRaw = profile?.show_email;
  const contactVisibility = Number(
    contactVisibilityRaw === true ? 2 : contactVisibilityRaw || 0
  ); // 0 hidden, 1 connections, 2 everyone
  const emailVisibleFlag =
    profile?.email_visible === true ||
    profile?.email_visible === '1' ||
    Number(profile?.email_visible) === 1;
  const contactEmail = profile?.email || '';
  const viewerCanSeeEmail = true; // Self profile view always allows owner visibility
  const canDisplayEmailValue = viewerCanSeeEmail && Boolean(contactEmail);

  usePublishProfileContact(() => {
    if (!userId) return null;
    if (!canDisplayEmailValue) {
      return <p className="muted">No email provided.</p>;
    }
    return (
      <>
        <a className="contact-email" href={`mailto:${contactEmail}`}>
          {contactEmail}
        </a>
        {contactVisibility === 0 && (
          <p className="muted">
            Hidden from others. Switch to &quot;Connections only&quot; or &quot;Everyone&quot; in Account Settings to share it.
          </p>
        )}
        {contactVisibility === 1 && (
          <p className="muted">Visible to your connections only.</p>
        )}
      </>
    );
  }, [userId, canDisplayEmailValue, contactEmail, contactVisibility]);

  const profileStyle = {
    '--primary-color': primaryColor,
    '--secondary-color': secondaryColor,
  };

  return (
    <div className="profile-view profile-container" style={profileStyle}>
      {profileNotice && (
        <div
          className={`site-notice site-notice--${profileNotice.type}`}
          role={profileNotice.type === 'error' ? 'alert' : 'status'}
        >
          {profileNotice.message}
        </div>
      )}
      {!userId ? (
        <p>Please log in to view your profile.</p>
      ) : (
        <>
          <div className="hero-card profile-hero-card">
            <div className="hero-banner">
              <img src={buildUploadSrc(bannerPath)} alt="Profile Banner" />
            </div>
            <div className="hero-content">
              <div className="hero-left">
                <div className="user-hero-logo-wrap">
                  <img
                    src={buildAvatarSrc(avatarPath)}
                    alt="Profile Avatar"
                    className={`user-hero-logo ${isDefaultAvatar ? 'user-hero-logo--default' : ''}`}
                  />
                </div>
                <div className="hero-text">
                  <h1 className="hero-title">
                    {fullName}
                    {verified ? (
                      <span
                        className="profile-verification-status profile-verification-status--verified"
                        title={`Verified from ${verifiedCommunityName || 'this community'}`}
                        aria-label={`Verified from ${verifiedCommunityName || 'this community'}`}
                      >
                        <BadgeCheck size={19} strokeWidth={2.2} aria-hidden="true" />
                      </span>
                    ) : (
                      <span
                        className="profile-verification-status profile-verification-status--unverified"
                        title="Not verified"
                      >
                        Unverified
                      </span>
                    )}
                    {ambassadorLogo && (
                      <img
                        src={ambassadorLogo}
                        alt="Ambassador badge"
                        className="ambassador-inline-logo"
                        title="Ambassador"
                      />
                    )}
                  </h1>
                  <p className="hero-sub">
                    {displayHeadline}
                  </p>
                  <p className="hero-sub hero-sub-row">
                    <span>{followerCount} Followers</span>
                    <span>{followingCount} Following</span>
                  </p>
                </div>
              </div>
              <div className="hero-right hero-actions">
                <div className="profile-actions">
                  <button className="edit-button" onClick={handleToggleEdit}>
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
            <div className="tabs-underline">
              {profileTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`tab-link ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="profile-detail-wrapper community-profile">
            <div className="community-profile-content">
            <div className="profile-detail-sections split-main">
              {activeTab === 'about' && (
                <>
                    <div className="content-card about-section self-profile-about-card">
                      <div className="qa-header">
                        <div>
                          <h3>About</h3>
                          <p className="muted">How you introduce yourself.</p>
                        </div>
                      </div>
                      {profile?.about ? (
                        <p className="community-overview__lead">{DOMPurify.sanitize(displayAbout)}</p>
                      ) : (
                        <p className="muted">No about information provided yet.</p>
                      )}
                    </div>

                    <IntroReelCard profile={profile} isOwner />

                    <div className="content-card self-profile-about-card">
                      <div className="qa-header">
                        <div>
                          <h3>Experience</h3>
                          <p className="muted">Roles, work, and appointments.</p>
                        </div>
                      </div>
                      {loadingExp ? (
                        <p className="muted">Loading experience...</p>
                      ) : errorExp ? (
                        <p className="muted">{errorExp}</p>
                      ) : experience.length > 0 ? (
                        experience.map((exp, index) => (
                          <div key={index} className="experience-item">
                            <h4>
                              {exp.title} at {exp.company}
                            </h4>
                            <div className="experience-dates">
                              {exp.start_date} - {exp.end_date ? exp.end_date : 'Present'}
                            </div>
                            <div className="experience-meta">
                              <span className="experience-type">{exp.employment_type}</span>
                              <span className="experience-location">
                                {exp.location_city}
                                {exp.location_state ? `, ${exp.location_state}` : ''}
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
                        <p className="muted">No experience added yet.</p>
                      )}
                    </div>

                    <div className="content-card self-profile-about-card">
                      <div className="qa-header">
                        <div>
                          <h3>Education</h3>
                          <p className="muted">Schools, programs, and achievements.</p>
                        </div>
                      </div>
                      {loadingEdu ? (
                        <p className="muted">Loading education...</p>
                      ) : errorEdu ? (
                        <p className="muted">{errorEdu}</p>
                      ) : education.length > 0 ? (
                        education.map((edu, index) => (
                          <div key={index} className="education-item">
                            <h4>
                              {edu.degree} in {edu.field_of_study}
                            </h4>
                            <div className="education-institution">{edu.institution}</div>
                            <div className="education-dates">
                              {edu.start_date} - {edu.end_date ? edu.end_date : 'Present'}
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
                        <p className="muted">No education details added yet.</p>
                      )}
                    </div>

                    <div className="content-card self-profile-about-card">
                      <div className="qa-header">
                        <div>
                          <h3>Skills</h3>
                          <p className="muted">Strengths and focus areas.</p>
                        </div>
                      </div>
                      {displaySkills ? (
                        <ul className="skills-list">
                          {displaySkills.split(',').map((skill, index) => (
                            <li key={index} className="skill-item">
                              {skill.trim()}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">No skills listed yet.</p>
                      )}
                    </div>
                </>
              )}

              {activeTab === 'reels' && (
                <ReelGrid
                  userId={userId}
                  isOwner
                  showCreate
                  title="Your Reels"
                  description="Short videos you’ve shared across StudentSphere."
                  emptyLabel="You haven’t shared a reel yet."
                />
              )}

              {activeTab === 'posts' && (
                <div className="content-card">
                  <div className="qa-header">
                    <div>
                      <h3>Posts</h3>
                      <p className="muted">Threads you&apos;ve started across StudentSphere.</p>
                    </div>
                  </div>
                  {threadsLoading ? (
                    <p className="muted">Loading posts...</p>
                  ) : threadsError ? (
                    <p className="muted">{threadsError}</p>
                  ) : userThreads.length > 0 ? (
                    <div className="profile-thread-list">
                      {userThreads.map((thread) => (
                        <ThreadCard key={thread.thread_id} thread={thread} userData={userData} />
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No posts yet.</p>
                  )}
                </div>
              )}

              {activeTab === 'replies' && (
                <div className="content-card">
                  <div className="qa-header">
                    <div>
                      <h3>Replies</h3>
                      <p className="muted">Comments you&apos;ve shared in community threads.</p>
                    </div>
                  </div>
                  {repliesLoading ? (
                    <p className="muted">Loading replies...</p>
                  ) : repliesError ? (
                    <p className="muted">{repliesError}</p>
                  ) : userReplies.length > 0 ? (
                    <div className="profile-replies-list">
                      {userReplies.map((reply) => (
                        <div key={reply.post_id} className="profile-reply-card">
                          <div className="profile-reply-meta">
                            <RouterLink
                              to={`/info/forum/${reply.forum_id}/thread/${reply.thread_id}`}
                              className="profile-reply-thread"
                            >
                              {reply.thread_title || 'View Thread'}
                            </RouterLink>
                            <span className="middot" aria-hidden="true">
                              •
                            </span>
                            <span className="meta-quiet">
                              {timeAgo(reply.created_at)}
                            </span>
                            {reply.community_name && reply.community_id && reply.community_type && (
                              <>
                                <span className="middot" aria-hidden="true">
                                  •
                                </span>
                                <RouterLink
                                  to={`/${reply.community_type}/${reply.community_id}`}
                                  className="profile-reply-community"
                                >
                                  {reply.community_name}
                                </RouterLink>
                              </>
                            )}
                          </div>
                          <div
                            className="profile-reply-content"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(reply.content || ''),
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No replies yet.</p>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>

          <ModalOverlay
            isOpen={isEditing}
            onClose={handleCancelEdit}
            contentClassName="community-form-overlay community-form-overlay--edit profile-editor-overlay"
          >
            <div className="content-card community-form-dialog">
              <div className="qa-header">
                <div>
                  <h3>Edit Profile</h3>
                  <p className="muted">Update your profile details, colors, and media.</p>
                </div>
              </div>
              <form className="qa-form" onSubmit={handleSubmit}>
                <label className="qa-label" htmlFor="profile-first-name">First name</label>
                <input
                  id="profile-first-name"
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                />
                <label className="qa-label" htmlFor="profile-last-name">Last name</label>
                <input
                  id="profile-last-name"
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                />
                <label className="qa-label" htmlFor="profile-headline">Headline</label>
                <input
                  id="profile-headline"
                  type="text"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder="Your role, field, or focus"
                />
                <label className="qa-label" htmlFor="profile-about">About</label>
                <textarea
                  id="profile-about"
                  value={about}
                  onChange={(event) => setAbout(event.target.value)}
                  placeholder="Share a concise introduction"
                  rows={5}
                />
                <label className="qa-label" htmlFor="profile-skills">Skills</label>
                <input
                  id="profile-skills"
                  type="text"
                  value={skills}
                  onChange={(event) => setSkills(event.target.value)}
                  placeholder="Research, writing, facilitation"
                />
                <label className="qa-label" htmlFor="profile-primary-color">Primary Color</label>
                <input
                  id="profile-primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                />
                <label className="qa-label" htmlFor="profile-secondary-color">Secondary Color</label>
                <input
                  id="profile-secondary-color"
                  type="color"
                  value={secondaryColor}
                  onChange={(event) => setSecondaryColor(event.target.value)}
                />
                <label className="qa-label" htmlFor="profile-avatar">Profile image</label>
                <input
                  id="profile-avatar"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAvatarFile(event.target.files[0])}
                />
                <label className="qa-label" htmlFor="profile-banner">Banner image</label>
                <input
                  id="profile-banner"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setBannerFile(event.target.files[0])}
                />
                <div className="qa-actions">
                  <button type="submit" className="pill-button" disabled={isSavingProfile}>
                    {isSavingProfile ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" className="pill-button secondary" onClick={handleCancelEdit} disabled={isSavingProfile}>
                  Cancel
                  </button>
                </div>
              </form>
            </div>
          </ModalOverlay>
        </>
      )}
    </div>
  );
}

export default SelfProfileView;
