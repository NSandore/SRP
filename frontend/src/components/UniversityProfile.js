// src/components/UniversityProfile.js
import React, { useState, useEffect } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import axios from "axios";
import { FaLock } from "react-icons/fa";
import "./UniversityProfile.css";
import ModalOverlay from "./ModalOverlay";

function UniversityProfile({ userData, onRequireAuth, onFollowNotification, onNotificationsRefresh }) {
  const { id } = useParams(); // community id
  const communityId = String(id);
  const [university, setUniversity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode state (only available if userData.role_id === 3)
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields state
  const [editName, setEditName] = useState("");
  const [editTagline, setEditTagline] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("");
  const [editSecondaryColor, setEditSecondaryColor] = useState("");

  // File upload states for logo and banner
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [newBannerFile, setNewBannerFile] = useState(null);

  // State to control the Ambassador overlay and its data
  const [showAmbassadorOverlay, setShowAmbassadorOverlay] = useState(false);
  const [ambassadors, setAmbassadors] = useState([]);
  const [loadingAmbassadors, setLoadingAmbassadors] = useState(false);
  const [errorAmbassadors, setErrorAmbassadors] = useState(null);
  const [ambassadorsLoaded, setAmbassadorsLoaded] = useState(false);

  // New state for connections: following and followers (fetched via fetch_connections_list.php)
  const [connections, setConnections] = useState({ following: [], followers: [] });
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [questions, setQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionBody, setQuestionBody] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [subcommunities, setSubcommunities] = useState([]);
  const [loadingSubcommunities, setLoadingSubcommunities] = useState(false);
  const [subcommunitiesError, setSubcommunitiesError] = useState('');
  const [showCreateSubModal, setShowCreateSubModal] = useState(false);
  const [createSubData, setCreateSubData] = useState({
    name: '',
    tagline: '',
    location: '',
    website: '',
    primary_color: '',
    secondary_color: ''
  });
  const [isCreatingSub, setIsCreatingSub] = useState(false);
  const [createSubStatus, setCreateSubStatus] = useState('');
  const [childFollowBusy, setChildFollowBusy] = useState({});
  const hasSubcommunities = subcommunities.length > 0;

  const canViewAmbassadors = Boolean(userData);
  const isAmbassador =
    Boolean(userData) &&
    ambassadors.some((a) => String(a.user_id || a.id) === String(userData.user_id));
  const currentAmbassador = ambassadors.find((a) => String(a.user_id) === String(userData?.user_id));
  const viewerRole = (currentAmbassador?.role || '').toLowerCase() || 'viewer';
  const isSuperAdmin = Number(userData?.role_id) === 1;
  const isCommunityAdmin = viewerRole === 'admin';
  const canEditCommunity = Boolean(userData) && (isSuperAdmin || isCommunityAdmin);
  const canRemoveAmbassador = Boolean(userData) && (isSuperAdmin || isCommunityAdmin);
  const canApplyForAmbassador = Boolean(userData) && ambassadorsLoaded && !isAmbassador;

  const getInitials = (firstName = '', lastName = '') => {
    const first = firstName.trim().charAt(0);
    const last = lastName.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || 'A';
  };

  // --------------------------------------------------------------------------
  // Fetch university details on mount (or when id changes)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const fetchUniversity = async () => {
      try {
        const params = new URLSearchParams();
        params.append('community_id', id);
        if (userData?.user_id) {
          params.append('user_id', userData.user_id);
        }
        const response = await axios.get(`/api/fetch_university.php?${params.toString()}`);
        if (response.data.success) {
          setUniversity(response.data.university);
          setFollowersCount(response.data.university.followers_count || 0);
          setIsFollowing(Boolean(response.data.university.is_following));
          // Initialize editable fields with the current values
          setEditName(response.data.university.name || "");
          setEditTagline(response.data.university.tagline || "");
          setEditLocation(response.data.university.location || "");
          setEditWebsite(response.data.university.website || "");
          setEditPrimaryColor(response.data.university.primary_color || "#0077B5");
          setEditSecondaryColor(response.data.university.secondary_color || "#005f8d");
        } else {
          setError(response.data.error);
        }
      } catch (err) {
        setError("Error fetching university data");
      } finally {
        setLoading(false);
      }
    };
    fetchUniversity();
  }, [id, userData?.user_id]);

  // --------------------------------------------------------------------------
  // Fetch ambassadors for this community
  // --------------------------------------------------------------------------
  const fetchAmbassadors = async () => {
    setAmbassadorsLoaded(false);
    setLoadingAmbassadors(true);
    setErrorAmbassadors(null);
    try {
      const response = await axios.get(`/api/fetch_ambassador_list.php?community_id=${id}`);
      if (response.data.success) {
        setAmbassadors(response.data.ambassadors || []);
      } else {
        setErrorAmbassadors(response.data.error || "Error fetching ambassadors");
      }
    } catch (err) {
      setErrorAmbassadors("Error fetching ambassadors");
    } finally {
      setLoadingAmbassadors(false);
      setAmbassadorsLoaded(true);
    }
  };

  // Keep ambassadors fresh on first load
  useEffect(() => {
    fetchAmbassadors();
  }, [id]);

  // --------------------------------------------------------------------------
  // Fetch connections (who the current user follows and who follows them)
  // --------------------------------------------------------------------------
  const fetchConnections = async () => {
    try {
      const response = await axios.get(`/api/fetch_connections_list.php?user_id=${userData.user_id}`, {
        withCredentials: true,
      });
      if (response.data.success) {
        setConnections({
          following: response.data.following, // array of user_ids current user is following
          followers: response.data.followers,   // array of user_ids that follow current user
        });
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    }
  };

  // When the Ambassador overlay is shown, fetch both ambassadors and connections
  useEffect(() => {
    if (!showAmbassadorOverlay) return;
    fetchAmbassadors();
    if (userData) {
      fetchConnections();
    }
  }, [showAmbassadorOverlay, id, userData]);

  // Toggle edit mode
  const handleToggleEdit = () => {
    if (!canEditCommunity) return;
    if (!isEditing && university) {
      setEditName(university.name || "");
      setEditTagline(university.tagline || "");
      setEditLocation(university.location || "");
      setEditWebsite(university.website || "");
      setEditPrimaryColor(university.primary_color || "#0077B5");
      setEditSecondaryColor(university.secondary_color || "#005f8d");
      setNewLogoFile(null);
      setNewBannerFile(null);
      setEditStatus('');
    }
    setIsEditing(!isEditing);
  };

  const loadQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      const res = await axios.get(`/api/fetch_group_questions.php?group_id=${id}&viewer_id=${userData?.user_id || 0}`, {
        withCredentials: true,
      });
      if (res.data.success) {
        setQuestions(res.data.questions || []);
      } else {
        setQuestions([]);
      }
    } catch (err) {
      setQuestions([]);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'qa') {
      loadQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userData]);

  // --------------------------------------------------------------------------
  // Sub-communities: load and manage follows
  // --------------------------------------------------------------------------
  const loadSubcommunities = async () => {
    setLoadingSubcommunities(true);
    setSubcommunitiesError('');
    try {
      const params = new URLSearchParams();
      params.append('parent_id', id);
      if (userData?.user_id) {
        params.append('user_id', userData.user_id);
      }
      const res = await axios.get(`/api/fetch_subcommunities.php?${params.toString()}`);
      if (res.data.success) {
        setSubcommunities(res.data.subcommunities || []);
      } else {
        setSubcommunities([]);
        setSubcommunitiesError(res.data.error || 'Unable to load sub-communities.');
      }
    } catch (err) {
      setSubcommunities([]);
      setSubcommunitiesError('Unable to load sub-communities.');
    } finally {
      setLoadingSubcommunities(false);
    }
  };

  useEffect(() => {
    loadSubcommunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userData?.user_id]);

  const handleChildFollowToggle = async (communityId, isFollowingNow) => {
    if (!userData) {
      onRequireAuth?.();
      return;
    }
    setChildFollowBusy((prev) => ({ ...prev, [communityId]: true }));
    try {
      const endpoint = isFollowingNow ? '/api/unfollow_community.php' : '/api/follow_community.php';
      const res = await axios.post(
        endpoint,
        { user_id: userData.user_id, community_id: communityId },
        { withCredentials: true }
      );
      if (res.data.error) {
        alert(res.data.error);
        return;
      }
      setSubcommunities((prev) =>
        prev.map((c) => {
          if (String(c.community_id) !== String(communityId)) return c;
          const nextFollowers =
            Number(c.followers_count || 0) + (isFollowingNow ? -1 : 1);
          return {
            ...c,
            is_following: !isFollowingNow,
            followers_count: Math.max(0, nextFollowers)
          };
        })
      );
    } catch (err) {
      alert('Unable to update follow status right now.');
    } finally {
      setChildFollowBusy((prev) => {
        const next = { ...prev };
        delete next[communityId];
        return next;
      });
    }
  };

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!userData) {
      onRequireAuth?.();
      return;
    }
    setIsSubmittingQuestion(true);
    try {
      const res = await axios.post(
        '/api/submit_group_question.php',
        {
          group_id: id,
          user_id: userData.user_id,
          title: questionTitle,
          body: questionBody,
        },
        { withCredentials: true }
      );
      if (res.data.success) {
        setQuestionTitle('');
        setQuestionBody('');
        setStatusMessage('Question submitted for review.');
        loadQuestions();
        setShowQuestionModal(false);
      } else {
        setStatusMessage(res.data.error || 'Unable to submit question.');
      }
    } catch (err) {
      setStatusMessage('Unable to submit question.');
    } finally {
      setIsSubmittingQuestion(false);
      setTimeout(() => setStatusMessage(''), 2500);
    }
  };

  const handleApproveQuestion = async (questionId) => {
    if (!isAmbassador) return;
    try {
      const res = await axios.post(
        '/api/approve_group_question.php',
        { question_id: questionId, user_id: userData.user_id },
        { withCredentials: true }
      );
      if (res.data.success) {
        loadQuestions();
      }
    } catch (err) {
      // noop
    }
  };

  const handleSubmitAnswer = async (questionId) => {
    if (!isAmbassador) return;
    const body = answerDrafts[questionId] || '';
    if (!body.trim()) return;
    try {
      const res = await axios.post(
        '/api/answer_group_question.php',
        { question_id: questionId, ambassador_id: userData.user_id, body },
        { withCredentials: true }
      );
      if (res.data.success) {
        setAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
        loadQuestions();
      }
    } catch (err) {
      // noop
    }
  };

  const handleRejectQuestion = async (questionId, reason) => {
    if (!isAmbassador) return;
    try {
      const res = await axios.post(
        '/api/reject_group_question.php',
        { question_id: questionId, user_id: userData.user_id, reason },
        { withCredentials: true }
      );
      if (res.data.success) {
        loadQuestions();
      }
    } catch (err) {
      // noop
    }
  };

  const handleFollowToggle = async () => {
    if (!userData) {
      onRequireAuth?.();
      return;
    }
    setIsTogglingFollow(true);
    try {
      const endpoint = isFollowing ? '/api/unfollow_community.php' : '/api/follow_community.php';
      const res = await axios.post(
        endpoint,
        { user_id: userData.user_id, community_id: id },
        { withCredentials: true }
      );
      if (res.data.error) {
        alert(res.data.error);
        return;
      }
      setIsFollowing(!isFollowing);
      setFollowersCount((prev) => Math.max(0, prev + (isFollowing ? -1 : 1)));
    } catch (err) {
      console.error('Error updating follow status:', err);
      alert('Unable to update follow status right now.');
    } finally {
      setIsTogglingFollow(false);
    }
  };

  useEffect(() => {
    if (university) {
      setCreateSubData((prev) => ({
        ...prev,
        primary_color: prev.primary_color || university.primary_color || '#0077B5',
        secondary_color: prev.secondary_color || university.secondary_color || '#005f8d'
      }));
    }
  }, [university]);

  const handleCreateSubcommunity = async (e) => {
    e.preventDefault();
    if (!userData) {
      onRequireAuth?.();
      return;
    }
    setIsCreatingSub(true);
    setCreateSubStatus('');
    try {
      const payload = {
        ...createSubData,
        type: 'group',
        parent_community_id: id,
        primary_color: createSubData.primary_color || university?.primary_color || '#0077B5',
        secondary_color: createSubData.secondary_color || university?.secondary_color || '#005f8d'
      };
      const res = await axios.post('/api/create_community.php', payload, { withCredentials: true });
      if (res.data.success) {
        setCreateSubStatus('Sub-community created.');
        setShowCreateSubModal(false);
        setCreateSubData({
          name: '',
          tagline: '',
          location: '',
          website: '',
          primary_color: university?.primary_color || '#0077B5',
          secondary_color: university?.secondary_color || '#005f8d'
        });
        loadSubcommunities();
      } else {
        setCreateSubStatus(res.data.error || 'Unable to create sub-community.');
      }
    } catch (err) {
      console.error('Error creating sub-community:', err);
      setCreateSubStatus('Unable to create sub-community.');
    } finally {
      setIsCreatingSub(false);
      setTimeout(() => setCreateSubStatus(''), 2500);
    }
  };

  const handleSubFieldChange = (field, value) => {
    setCreateSubData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle form submission to update university details
  const handleUpdateUniversity = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("community_id", id);
    formData.append("name", editName);
    formData.append("tagline", editTagline);
    formData.append("location", editLocation);
    formData.append("website", editWebsite);
    formData.append("primary_color", editPrimaryColor);
    formData.append("secondary_color", editSecondaryColor);
    if (newLogoFile) {
      formData.append("logo", newLogoFile);
    }
    if (newBannerFile) {
      formData.append("banner", newBannerFile);
    }
    try {
      setIsSavingEdit(true);
      setEditStatus('');
      const response = await axios.post("/api/update_university.php", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data.success) {
        const updated = response.data.university || response.data.group || response.data.community || null;
        if (updated) {
          setUniversity(updated);
        }
        setIsEditing(false);
        setNewLogoFile(null);
        setNewBannerFile(null);
        setEditStatus('Community updated successfully.');
      } else {
        setEditStatus(response.data.error || "Error updating community.");
      }
    } catch (error) {
      console.error("Error updating university:", error);
      setEditStatus("An error occurred while updating the community.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle follow/unfollow ambassador
  const handleFollowAmbassador = async (ambassadorUserId) => {
    const isFollowing = connections.following.includes(ambassadorUserId);
    try {
      if (isFollowing) {
        const response = await axios.post(
          "/api/unfollow_user.php",
          { follower_id: userData.user_id, followed_user_id: ambassadorUserId },
          { withCredentials: true }
        );
        if (response.data.success) {
          alert("Unfollowed successfully");
        }
      } else {
        const response = await axios.post(
          "/api/follow_user.php",
          { follower_id: userData.user_id, followed_user_id: ambassadorUserId },
          { withCredentials: true }
        );
        if (response.data.success) {
          alert("Followed successfully");
          onFollowNotification?.(ambassadorUserId, userData.user_id);
          onNotificationsRefresh?.();
        }
      }
      fetchConnections();
    } catch (error) {
      console.error("Error following/unfollowing user:", error);
      alert("Error following/unfollowing user");
    }
  };

  const handlePromoteAdmin = async (email, userIdOverride = null) => {
    try {
      const response = await axios.post(
        "/api/promote_user_to_admin.php",
        { community_id: id, user_email: email, user_id: userIdOverride },
        { withCredentials: true }
      );
      if (response.data.success) {
        fetchAmbassadors();
      } else {
        alert("Error: " + response.data.error);
      }
    } catch (err) {
      console.error("Error promoting user:", err);
      alert("Error promoting user");
    }
  };

  const handleRemoveAmbassador = async (amb) => {
    if (!canRemoveAmbassador || String(amb.role).toLowerCase() === 'admin') return;
    const reason = window.prompt('Are you sure you want to revoke their access? Provide a reason (optional):', '');
    if (reason === null) return;
    try {
      await axios.post(
        "/api/remove_ambassador.php",
        { community_id: id, user_id: amb.user_id, reason },
        { withCredentials: true }
      );
      fetchAmbassadors();
    } catch (err) {
      alert("Error removing ambassador");
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!university) return <p>No university found.</p>;

  const universityLogo =
    university.logo_path && university.logo_path.startsWith('/')
      ? university.logo_path
      : `/uploads/logos/${university.logo_path || 'default-logo.png'}`;
  const subCommunityCount = Number(university.child_count || 0);

  return (
    <div className="profile-container" style={{
      "--primary-color": university.primary_color || "#0077B5",
      "--secondary-color": university.secondary_color || "#005f8d",
    }}>
      <section className="profile-main">
        {/* HERO CARD */}
        <div className="hero-card community-hero">
          <div className="hero-banner">
            <img src={university.banner_path || "/uploads/banners/DefaultBanner.jpeg"} alt="University Banner" />
          </div>
          <div className="hero-content">
            <div className="hero-left">
              <RouterLink to={`/university/${id}`} className="community-hero-logo-wrap">
                <img
                  src={universityLogo || "/uploads/logos/default-logo.png"}
                  alt="University Logo"
                  className="community-hero-logo"
                />
              </RouterLink>
              <div className="hero-text">
                <h1 className="hero-title">{university.name}</h1>
                {university.tagline && <p className="hero-sub">{university.tagline}</p>}
                {university.location && <p className="hero-sub">{university.location}</p>}
              </div>
            </div>
            <div className="hero-right hero-actions">
              <button
                type="button"
                className={`pill-button ${isFollowing ? 'secondary' : ''} ${!userData ? 'locked' : ''}`}
                onClick={handleFollowToggle}
                aria-disabled={!userData || isTogglingFollow}
                disabled={isTogglingFollow}
                title={!userData ? 'Log in to follow this university' : isFollowing ? 'Unfollow this university' : 'Follow this university'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {!userData && <FaLock size={12} />}
                  {isTogglingFollow ? 'Updating…' : isFollowing ? 'Unfollow' : 'Follow'}
                </span>
              </button>
              <p className="muted" style={{ marginTop: 6, textAlign: 'right' }}>
                {followersCount} follower{followersCount === 1 ? '' : 's'}
              </p>
              <p className="muted" style={{ margin: '4px 0 0 0', textAlign: 'right' }}>
                {subCommunityCount} sub-community{subCommunityCount === 1 ? '' : 'ies'}
              </p>
              {canEditCommunity && (
                <button
                  type="button"
                  className="pill-button secondary"
                  onClick={handleToggleEdit}
                >
                  Edit Community
                </button>
              )}
            </div>
          </div>
          <div className="tabs-underline">
            <button
              type="button"
              className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            {(hasSubcommunities || canEditCommunity) && (
              <button
                type="button"
                className={`tab-link ${activeTab === 'subgroups' ? 'active' : ''}`}
                onClick={() => setActiveTab('subgroups')}
              >
                Sub-Groups
              </button>
            )}
            <button
              type="button"
              className={`tab-link ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              Posts
            </button>
            <button
              type="button"
              className={`tab-link ${activeTab === 'qa' ? 'active' : ''}`}
              onClick={() => setActiveTab('qa')}
            >
              Q+A
            </button>
          </div>
        </div>

        {/* Below hero: two-column split — main content + right cards */}
        <div className={`profile-split ${activeTab === 'qa' ? 'fullwidth' : ''}`}>
          <div className="split-main">
            {activeTab === 'overview' && null}

            {activeTab === 'subgroups' && (
              <div className="content-card">
                <div className="qa-header">
                  <div>
                    <h3>Sub-Groups</h3>
                    <p className="muted">Departments, programs, and teams managed by {university.name}.</p>
                  </div>
                  {canEditCommunity && (
                    <button
                      type="button"
                      className="pill-button"
                      onClick={() => {
                        if (!userData) {
                          onRequireAuth?.();
                          return;
                        }
                        setShowCreateSubModal(true);
                        setCreateSubStatus('');
                        setCreateSubData({
                          name: '',
                          tagline: '',
                          location: '',
                          website: '',
                          primary_color: university?.primary_color || '#0077B5',
                          secondary_color: university?.secondary_color || '#005f8d'
                        });
                      }}
                    >
                      Create sub-community
                    </button>
                  )}
                </div>

                {loadingSubcommunities ? (
                  <p>Loading sub-groups...</p>
                ) : subcommunitiesError ? (
                  <p>{subcommunitiesError}</p>
                ) : subcommunities.length === 0 ? (
                  <p className="muted">No sub-groups yet.</p>
                ) : (
                  <div className="community-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {subcommunities.map((child) => {
                      const isFollowingChild =
                        child.is_following === true ||
                        child.is_following === 1 ||
                        child.is_following === '1';
                      const logoSrc =
                        child.logo_path && child.logo_path.startsWith('/')
                          ? child.logo_path
                          : `/uploads/logos/${child.logo_path || 'default-logo.png'}`;
                      return (
                        <div
                          key={child.community_id}
                          className={`community-row-card${isFollowingChild ? ' followed' : ''}`}
                        >
                          <img
                            src={logoSrc}
                            alt={`${child.name} Logo`}
                            className="community-row-logo"
                            loading="lazy"
                          />
                          <div className="community-row-content">
                            <div className="community-row-header">
                              <h4 className="community-name" style={{ margin: 0 }}>
                                <RouterLink
                                  to={`/${child.community_type}/${child.community_id}`}
                                  style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                  <span className="truncate-38ch">{child.name}</span>
                                </RouterLink>
                              </h4>
                              <span className="pill-button secondary" style={{ padding: '4px 10px' }}>
                                {child.community_type === 'group' ? 'Group' : 'University'}
                              </span>
                            </div>
                            {child.tagline && (
                              <p className="community-slogan" style={{ margin: '2px 0' }}>{child.tagline}</p>
                            )}
                            <div className="community-row-meta">
                              {child.location && (
                                <span className="community-location">{child.location}</span>
                              )}
                              <span
                                className="followers-count"
                                style={{ marginLeft: child.location ? 12 : 0 }}
                              >
                                Followers: {child.followers_count || 0}
                              </span>
                            </div>
                          </div>
                          <div className="community-row-actions">
                            <button
                              type="button"
                              className={`follow-button ${isFollowingChild ? 'unfollow' : 'follow'} ${!userData ? 'locked' : ''}`}
                              onClick={() => handleChildFollowToggle(child.community_id, isFollowingChild)}
                              aria-disabled={!userData || childFollowBusy[child.community_id]}
                              disabled={childFollowBusy[child.community_id]}
                              title={!userData ? 'Log in to follow communities' : isFollowingChild ? 'Unfollow community' : 'Follow community'}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {!userData && <FaLock size={12} />}
                                {childFollowBusy[child.community_id]
                                  ? 'Updating…'
                                  : isFollowingChild
                                  ? 'Unfollow'
                                  : 'Follow'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="content-card">
                <div className="posts-placeholder">
                  <p>Posts will appear here.</p>
                </div>
              </div>
            )}

            {activeTab === 'qa' && (
              <div className="content-card">
                <div className="qa-header">
                  <div>
                    <h3>University Q+A</h3>
                    <p className="muted">Submit a question for ambassadors. Approved items appear for everyone.</p>
                  </div>
                  <button
                    type="button"
                    className="pill-button"
                    onClick={() => {
                      if (!userData) {
                        onRequireAuth?.();
                        return;
                      }
                      setShowQuestionModal(true);
                    }}
                  >
                    Ask a question
                  </button>
                </div>

                <div className="qa-list">
                  {isLoadingQuestions ? (
                    <p>Loading questions...</p>
                  ) : questions.length === 0 ? (
                    <p>No questions yet.</p>
                  ) : (
                    questions.map((q) => {
                      const isPending = q.status === 'pending';
                      return (
                        <div key={q.id} className="qa-item">
                          <div className="qa-item-header">
                            <div>
                              <h4>{q.title}</h4>
                              <p className="muted">
                                Asked by {q.asker_first_name} {q.asker_last_name}
                                {isPending && ' · Pending approval'}
                              </p>
                            </div>
                            {isAmbassador && isPending && (
                              <div className="qa-actions">
                                <button
                                  type="button"
                                  className="pill-button secondary"
                                  onClick={() => handleApproveQuestion(q.id)}
                                >
                                  Add to Q+A list
                                </button>
                                <button
                                  type="button"
                                  className="pill-button secondary"
                                  onClick={() => {
                                    const reason = window.prompt('Provide a justification for declining:');
                                    if (!reason) return;
                                    handleRejectQuestion(q.id, reason);
                                  }}
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                          <p style={{ marginTop: 6 }}>{q.body}</p>

                          <div className="qa-answers">
                            {q.answers && q.answers.length > 0 ? (
                              q.answers.map((a) => (
                                <div key={a.id} className="qa-answer">
                                  <strong>{a.first_name} {a.last_name}</strong>
                                  <p>{a.body}</p>
                                </div>
                              ))
                            ) : (
                              <p className="muted">No answers yet.</p>
                            )}
                          </div>

                          {isAmbassador && (
                            <div className="qa-answer-form">
                              <textarea
                                placeholder="Write an answer..."
                                value={answerDrafts[q.id] || ''}
                                onChange={(e) =>
                                  setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                                }
                              />
                              <div className="qa-actions">
                                <button
                                  type="button"
                                  className="pill-button secondary"
                                  onClick={() => handleSubmitAnswer(q.id)}
                                >
                                  Post answer
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          {activeTab !== 'qa' && (
          <aside className="split-aside">
            <div className="info-card">
              <h3>Ambassadors</h3>
              {ambassadors.length ? (
                <div className="avatar-stack" style={{ marginBottom: 8 }}>
                  {ambassadors.slice(0, 6).map((a) => {
                    const initials = getInitials(a.first_name, a.last_name);
                    const key = a.user_id || a.id || initials;
                    return a.avatar_path ? (
                      <img
                        key={key}
                        className="avatar"
                        src={a.avatar_path}
                        alt={`${a.first_name} ${a.last_name}`}
                      />
                    ) : (
                      <div key={key} className="avatar avatar-initial" aria-label={`${a.first_name} ${a.last_name}`}>
                        {initials}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted" style={{ marginBottom: 8 }}>
                  No current ambassadors.
                </p>
              )}
              <button
                className={`pill-button ${!canViewAmbassadors ? 'locked' : ''}`}
                type="button"
                onClick={() => {
                  if (!canViewAmbassadors) {
                    onRequireAuth?.();
                    return;
                  }
                  setShowAmbassadorOverlay(true);
                  fetchAmbassadors();
                  setMenuOpenFor(null);
                }}
                aria-disabled={!canViewAmbassadors}
                title={!canViewAmbassadors ? 'Log in to view ambassadors' : 'View ambassadors'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {!canViewAmbassadors && <FaLock size={12} />}
                  View all
                </span>
              </button>
            </div>
            <div className="info-card">
              <h3>Contact Us</h3>
              {university.website ? (
                <p style={{ margin: 0 }}>
                  <a href={university.website} target="_blank" rel="noopener noreferrer">{university.website}</a>
                </p>
              ) : null}
              {university.contact_email || university.email ? (
                <p className="muted" style={{ margin: '6px 0 0 0' }}>{university.contact_email || university.email}</p>
              ) : (
                <p className="muted" style={{ margin: 0 }}>No contact info provided.</p>
              )}
            </div>
          </aside>
          )}
        </div>
      </section>

      <ModalOverlay
        isOpen={isEditing}
        onClose={() => {
          setIsEditing(false);
          setEditStatus('');
        }}
      >
        <div className="content-card">
          <div className="qa-header">
            <div>
              <h3>Edit Community</h3>
              <p className="muted">Update basic details, colors, and media.</p>
            </div>
          </div>
          <form className="qa-form" onSubmit={handleUpdateUniversity}>
            <label className="qa-label" htmlFor="edit-name">Name</label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <label className="qa-label" htmlFor="edit-tagline">Tagline</label>
            <input
              id="edit-tagline"
              type="text"
              value={editTagline}
              onChange={(e) => setEditTagline(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-location">Location</label>
            <input
              id="edit-location"
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-website">Website</label>
            <input
              id="edit-website"
              type="url"
              value={editWebsite}
              onChange={(e) => setEditWebsite(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-primary-color">Primary Color</label>
            <input
              id="edit-primary-color"
              type="color"
              value={editPrimaryColor || "#0077B5"}
              onChange={(e) => setEditPrimaryColor(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-secondary-color">Secondary Color</label>
            <input
              id="edit-secondary-color"
              type="color"
              value={editSecondaryColor || "#005f8d"}
              onChange={(e) => setEditSecondaryColor(e.target.value)}
            />
            <label className="qa-label" htmlFor="edit-logo">Logo</label>
            <input
              id="edit-logo"
              type="file"
              accept="image/*"
              onChange={(e) => setNewLogoFile(e.target.files?.[0] || null)}
            />
            <label className="qa-label" htmlFor="edit-banner">Banner</label>
            <input
              id="edit-banner"
              type="file"
              accept="image/*"
              onChange={(e) => setNewBannerFile(e.target.files?.[0] || null)}
            />
            <div className="qa-actions">
              <button
                type="submit"
                className="pill-button"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="pill-button secondary"
                onClick={() => {
                  setIsEditing(false);
                  setEditStatus('');
                }}
              >
                Cancel
              </button>
            </div>
            {editStatus && <p className="muted" style={{ marginTop: 6 }}>{editStatus}</p>}
          </form>
        </div>
      </ModalOverlay>

      <ModalOverlay
        isOpen={showCreateSubModal}
        onClose={() => {
          setShowCreateSubModal(false);
          setCreateSubStatus('');
        }}
      >
        <div className="content-card">
          <div className="qa-header">
            <div>
              <h3>Create sub-community</h3>
              <p className="muted">Add a department or program under {university.name}.</p>
            </div>
          </div>
          <form className="qa-form" onSubmit={handleCreateSubcommunity}>
            <label className="qa-label" htmlFor="sub-name">Name</label>
            <input
              id="sub-name"
              type="text"
              value={createSubData.name}
              onChange={(e) => handleSubFieldChange('name', e.target.value)}
              placeholder="Financial Services Department"
              required
            />
            <label className="qa-label" htmlFor="sub-tagline">Tagline</label>
            <input
              id="sub-tagline"
              type="text"
              value={createSubData.tagline}
              onChange={(e) => handleSubFieldChange('tagline', e.target.value)}
              placeholder="Helping students manage finances"
            />
            <label className="qa-label" htmlFor="sub-location">Location</label>
            <input
              id="sub-location"
              type="text"
              value={createSubData.location}
              onChange={(e) => handleSubFieldChange('location', e.target.value)}
            />
            <label className="qa-label" htmlFor="sub-website">Website</label>
            <input
              id="sub-website"
              type="url"
              value={createSubData.website}
              onChange={(e) => handleSubFieldChange('website', e.target.value)}
            />
            <label className="qa-label" htmlFor="sub-primary-color">Primary Color</label>
            <input
              id="sub-primary-color"
              type="color"
              value={createSubData.primary_color || '#0077B5'}
              onChange={(e) => handleSubFieldChange('primary_color', e.target.value)}
            />
            <label className="qa-label" htmlFor="sub-secondary-color">Secondary Color</label>
            <input
              id="sub-secondary-color"
              type="color"
              value={createSubData.secondary_color || '#005f8d'}
              onChange={(e) => handleSubFieldChange('secondary_color', e.target.value)}
            />
            <div className="qa-actions">
              <button
                type="submit"
                className="pill-button"
                disabled={isCreatingSub}
              >
                {isCreatingSub ? 'Creating…' : 'Create sub-community'}
              </button>
              <button
                type="button"
                className="pill-button secondary"
                onClick={() => {
                  setShowCreateSubModal(false);
                  setCreateSubStatus('');
                }}
              >
                Cancel
              </button>
            </div>
            {createSubStatus && <p className="muted" style={{ marginTop: 6 }}>{createSubStatus}</p>}
            <p className="muted" style={{ marginTop: 6 }}>
              Type is locked to <strong>group</strong> so it appears as a child of this university.
            </p>
          </form>
        </div>
      </ModalOverlay>

      {/* Ambassador Overlay */}
      {showAmbassadorOverlay && userData && (
        <div className="overlay">
          <div className="overlay-content">
            <div className="qa-header">
              <div>
                <h2>Ambassador List</h2>
                <p className="muted">
                  Ambassador status is earned by applying and verifying your school affiliation. Admins can only promote existing ambassadors.
                </p>
              </div>
              {canApplyForAmbassador && (
                <button
                  type="button"
                  className="pill-button"
                  onClick={() =>
                    alert('Ambassador applications will guide you through school verification. This flow is coming soon.')
                  }
                >
                  Apply to be an Ambassador
                </button>
              )}
            </div>
            {loadingAmbassadors ? (
              <p>Loading ambassadors...</p>
            ) : errorAmbassadors ? (
              <p>{errorAmbassadors}</p>
            ) : ambassadors.length === 0 ? (
              <p>No current ambassadors.</p>
            ) : (
              <ul className="ambassador-list">
                {ambassadors.map((amb) => {
                  const initials = getInitials(amb.first_name, amb.last_name);
                  const avatarKey = amb.user_id || amb.id || initials;
                  const isOnline = Number(amb.show_online ?? 1) === 1 && Boolean(amb.is_online);
                  const avatarNode = amb.avatar_path ? (
                            <img
                              src={amb.avatar_path}
                              alt={`${amb.first_name} ${amb.last_name}`}
                              className="ambassador-avatar"
                            />
                  ) : (
                    <div
                      className="ambassador-avatar ambassador-avatar--initial"
                      aria-label={`${amb.first_name} ${amb.last_name}`}
                    >
                      {initials}
                    </div>
                  );

                  const isMenuOpen = menuOpenFor === amb.user_id;
                  const isSelf = userData && String(userData.user_id) === String(amb.user_id);

                  return (
                    <li key={avatarKey} className="ambassador-item">
                      <div className="presence-avatar">
                        {avatarNode}
                        {isOnline && <span className="presence-dot presence-dot--online" title="Online" />}
                      </div>
                      <div className="ambassador-info" style={{ textAlign: 'left' }}>
                        <p className="ambassador-name">
                          <RouterLink to={`/user/${amb.user_id}`}>
                            {amb.first_name} {amb.last_name}
                          </RouterLink>
                          {(() => {
                            if (userData && Number(userData.user_id) === Number(amb.user_id)) {
                              console.log("This ambassador is the logged-in user:", amb);
                              return <span><small> (Me!)</small></span>;
                            }
                            return null;
                          })()}
                          {(() => {
                            if (
                              connections.followers &&
                              connections.followers.includes(Number(amb.user_id))
                            ) {
                              console.log("This ambassador follows you:", amb);
                              return <span className="follows-you"> (Follows you)</span>;
                            }
                            return null;
                          })()}
                        </p>
                        <p className="ambassador-headline">{amb.headline}</p>
                      </div>
                      {!isSelf && (
                        <div className="ambassador-actions">
                          <button
                            className="pill-button secondary"
                            type="button"
                            onClick={() => setMenuOpenFor(isMenuOpen ? null : amb.user_id)}
                          >
                            ⋯
                          </button>
                          {isMenuOpen && (
                            <div className="ambassador-menu">
                              <RouterLink to={`/messages?user=${amb.user_id}`} className="menu-item">
                                Message
                              </RouterLink>
                              <button
                                type="button"
                                className="menu-item"
                                disabled={!canEditCommunity || String(amb.role).toLowerCase() === 'admin'}
                                onClick={() => {
                                  setMenuOpenFor(null);
                                  handlePromoteAdmin(amb.email, amb.user_id);
                                }}
                              >
                                Promote to Admin
                              </button>
                              <button
                                type="button"
                                className="menu-item"
                                disabled={!canRemoveAmbassador || String(amb.role).toLowerCase() === 'admin'}
                                onClick={() => {
                                  setMenuOpenFor(null);
                                  handleRemoveAmbassador(amb);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <button onClick={() => {
              setShowAmbassadorOverlay(false);
              setMenuOpenFor(null);
            }}>
              Close
            </button>
          </div>
        </div>
      )}

      <ModalOverlay
        isOpen={showQuestionModal}
        onClose={() => {
          setShowQuestionModal(false);
          setStatusMessage('');
        }}
      >
        <div className="content-card">
          <div className="qa-header">
            <div>
              <h3>Ask a question</h3>
              <p className="muted">Your question will be sent to ambassadors for review.</p>
            </div>
          </div>
          <form className="qa-form" onSubmit={handleSubmitQuestion}>
            <label className="qa-label" htmlFor="qa-title">Question title</label>
            <input
              id="qa-title"
              type="text"
              value={questionTitle}
              onChange={(e) => setQuestionTitle(e.target.value)}
              placeholder="What would you like to know?"
              required
              disabled={!userData || isSubmittingQuestion}
            />
            <label className="qa-label" htmlFor="qa-body">Details</label>
            <textarea
              id="qa-body"
              value={questionBody}
              onChange={(e) => setQuestionBody(e.target.value)}
              placeholder="Add context so ambassadors can help quickly."
              required
              disabled={!userData || isSubmittingQuestion}
            />
            <div className="qa-actions">
              <button
                type="submit"
                className="pill-button"
                disabled={!userData || isSubmittingQuestion}
                onClick={() => {
                  if (!userData) {
                    onRequireAuth?.();
                  }
                }}
              >
                {isSubmittingQuestion ? 'Submitting…' : 'Submit question'}
              </button>
              <button
                type="button"
                className="pill-button secondary"
                onClick={() => setShowQuestionModal(false)}
              >
                Cancel
              </button>
            </div>
            {statusMessage && <p className="muted" style={{ marginTop: 6 }}>{statusMessage}</p>}
            {!userData && (
              <p className="muted" style={{ marginTop: 8 }}>
                Log in to submit a question.
              </p>
            )}
          </form>
        </div>
      </ModalOverlay>
    </div>
  );
}

export default UniversityProfile;
